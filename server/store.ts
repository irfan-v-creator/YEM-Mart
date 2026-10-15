import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  Product, 
  Order, 
  StoreSettings, 
  Coupon, 
  AuditLog, 
  StockAdjustmentLog, 
  CartItem, 
  CustomerDetails,
  OrderStatus,
  PaymentStatus
} from '../src/types/index';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SETTINGS, 
  INITIAL_ORDERS, 
  INITIAL_COUPONS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_STOCK_LOGS 
} from '../src/data/initialData';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'yem_database.json');

export interface DatabaseSchema {
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
  coupons: Coupon[];
  auditLogs: AuditLog[];
  stockLogs: StockAdjustmentLog[];
}

class Store {
  private data: DatabaseSchema;
  private isWriting = false;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadDatabase();

    // Ensure default supportPhone is strictly 7510447887
    if (this.data.settings && (!this.data.settings.supportPhone || this.data.settings.supportPhone.includes('94000'))) {
      this.data.settings.supportPhone = '7510447887';
      this.saveDatabaseSync();
    }

    // Hydrate from Supabase PostgreSQL if credentials configured
    if (isSupabaseConfigured()) {
      this.hydrateFromSupabase().catch(err => {
        console.warn('Supabase initial hydration notice (using local storage):', err?.message || err);
      });
    }
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS,
          orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_ORDERS,
          settings: parsed.settings && parsed.settings.storeName ? parsed.settings : INITIAL_SETTINGS,
          coupons: Array.isArray(parsed.coupons) ? parsed.coupons : INITIAL_COUPONS,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : INITIAL_AUDIT_LOGS,
          stockLogs: Array.isArray(parsed.stockLogs) ? parsed.stockLogs : INITIAL_STOCK_LOGS,
        };
      }
    } catch (err) {
      console.error('Failed to read database file, initializing defaults:', err);
    }

    const defaultData: DatabaseSchema = {
      products: INITIAL_PRODUCTS,
      orders: INITIAL_ORDERS,
      settings: INITIAL_SETTINGS,
      coupons: INITIAL_COUPONS,
      auditLogs: INITIAL_AUDIT_LOGS,
      stockLogs: INITIAL_STOCK_LOGS,
    };
    this.saveDatabaseSync(defaultData);
    return defaultData;
  }

  private saveDatabaseSync(dataToSave = this.data) {
    try {
      this.ensureDataDirectory();
      const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
      const jsonStr = JSON.stringify(dataToSave, null, 2);
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error writing to atomic database file:', err);
    }
  }

  private logAudit(action: string, actor: string, details: string, targetId?: string) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      actor,
      details,
      targetId,
    };
    this.data.auditLogs.unshift(log);
    // Keep max 200 audit logs
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 200);
    }
    this.syncAuditLogToSupabase(log).catch(() => {});
  }

  // --- SUPABASE HYBRID REPOSITORY SYNC METHODS ---
  public async hydrateFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      // 1. Settings
      const { data: sRow, error: sErr } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!sErr && sRow) {
        this.data.settings = {
          storeName: sRow.store_name || this.data.settings.storeName,
          tagline: sRow.tagline || this.data.settings.tagline,
          whatsappNumber: sRow.whatsapp_number || '917510447887',
          supportPhone: sRow.support_phone || '7510447887',
          upiId: sRow.upi_id || this.data.settings.upiId,
          deliveryFee: Number(sRow.delivery_fee ?? this.data.settings.deliveryFee),
          freeDeliveryThreshold: Number(sRow.free_delivery_threshold ?? this.data.settings.freeDeliveryThreshold),
          lowStockThreshold: Number(sRow.low_stock_threshold ?? this.data.settings.lowStockThreshold),
          announcementText: sRow.announcement_text || this.data.settings.announcementText,
          coverageArea: sRow.coverage_area || this.data.settings.coverageArea,
          officeCity: sRow.office_city || this.data.settings.officeCity,
        };
      }

      // 2. Products & Variants
      const { data: pRows, error: pErr } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!pErr && pRows && pRows.length > 0) {
        const { data: vRows } = await supabase.from('product_variants').select('*');
        const varMap = new Map<string, any[]>();
        if (vRows) {
          for (const v of vRows) {
            const list = varMap.get(v.product_id) || [];
            list.push({
              id: v.id,
              name: v.title,
              type: v.type || 'size',
              sku: v.sku || '',
              price: Number(v.price),
              originalPrice: v.original_price ? Number(v.original_price) : undefined,
              stock: Number(v.stock_count ?? 0),
              image: v.image || undefined,
            });
            varMap.set(v.product_id, list);
          }
        }

        this.data.products = pRows.map((r: any) => ({
          id: r.id,
          name: r.name,
          brand: r.brand || 'YEM MART',
          category: r.category,
          shortSummary: r.short_summary || '',
          description: r.description || '',
          highlights: Array.isArray(r.highlights) ? r.highlights : [],
          specs: r.specs && typeof r.specs === 'object' ? r.specs : {},
          price: Number(r.price),
          originalPrice: r.mrp ? Number(r.mrp) : undefined,
          discountPercent: r.discount_percentage ? Number(r.discount_percentage) : 0,
          rating: r.rating ? Number(r.rating) : 4.5,
          reviewCount: r.review_count ? Number(r.review_count) : 0,
          images: Array.isArray(r.images) && r.images.length > 0 ? r.images : [r.main_image || ''],
          mainImage: r.main_image || (r.images && r.images[0]) || '',
          status: r.status || 'published',
          scheduledPublishDate: r.scheduled_publish_date || undefined,
          stock: Number(r.stock_count ?? 0),
          lowStockThreshold: Number(r.low_stock_threshold ?? 5),
          isFeatured: Boolean(r.is_featured),
          isBestDeal: Boolean(r.is_best_deal),
          isNewArrival: Boolean(r.is_new_arrival),
          requiredVariantType: r.required_variant_type || undefined,
          sku: r.sku || '',
          tags: Array.isArray(r.tags) ? r.tags : [],
          variants: varMap.get(r.id) || [],
        }));
      }

      // 3. Coupons
      const { data: cRows, error: cErr } = await supabase.from('coupons').select('*');
      if (!cErr && cRows && cRows.length > 0) {
        this.data.coupons = cRows.map((c: any) => ({
          id: c.id,
          code: c.code,
          description: c.description || '',
          discountType: c.discount_type === 'percentage' ? 'percentage' : 'flat',
          discountValue: Number(c.discount_value),
          minPurchase: Number(c.min_order_amount ?? 0),
          maxDiscount: c.max_discount_amount ? Number(c.max_discount_amount) : undefined,
          startDate: c.valid_from || new Date().toISOString(),
          endDate: c.valid_until || '2030-12-31T23:59:59Z',
          usageLimit: c.usage_limit ? Number(c.usage_limit) : 9999,
          usedCount: Number(c.times_used ?? 0),
          isActive: Boolean(c.is_active),
        }));
      }

      this.saveDatabaseSync();
      return true;
    } catch (err) {
      console.error('Error during Supabase hydration:', err);
      return false;
    }
  }

  private async syncProductToSupabase(p: Product) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('products').upsert({
        id: p.id,
        name: p.name,
        brand: p.brand || null,
        category: p.category,
        short_summary: p.shortSummary || null,
        description: p.description || '',
        highlights: p.highlights || [],
        specs: p.specs || {},
        rating: p.rating ?? 4.5,
        review_count: p.reviewCount ?? 0,
        mrp: p.originalPrice || p.price,
        price: p.price,
        discount_percentage: p.discountPercent ?? 0,
        images: p.images || [],
        main_image: p.mainImage || (p.images?.[0] ?? null),
        tags: p.tags || [],
        is_in_stock: (p.stock ?? 0) > 0,
        stock_count: p.stock ?? 0,
        low_stock_threshold: p.lowStockThreshold ?? 5,
        sku: p.sku || null,
        badge: (p as any).badge || null,
        is_featured: Boolean(p.isFeatured),
        is_best_deal: Boolean(p.isBestDeal),
        is_new_arrival: Boolean(p.isNewArrival),
        required_variant_type: p.requiredVariantType || null,
        status: p.status || 'published',
        scheduled_publish_date: p.scheduledPublishDate || null,
        updated_at: new Date().toISOString(),
      });

      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          await supabase.from('product_variants').upsert({
            id: v.id,
            product_id: p.id,
            title: v.name,
            type: v.type || 'size',
            sku: v.sku || null,
            size: v.type === 'size' ? v.name : null,
            color: v.type === 'color' ? v.name : null,
            price: v.price,
            original_price: v.originalPrice || null,
            stock_count: v.stock ?? 0,
            image: v.image || null,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error(`Failed to sync product ${p.id} to Supabase:`, err);
    }
  }

  private async deleteProductFromSupabase(id: string) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch (err) {
      console.error(`Failed to delete product ${id} from Supabase:`, err);
    }
  }

  private async syncSettingsToSupabase(s: StoreSettings) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('store_settings').upsert({
        id: 'default',
        store_name: s.storeName,
        tagline: s.tagline,
        whatsapp_number: s.whatsappNumber || '917510447887',
        support_phone: s.supportPhone || '7510447887',
        upi_id: s.upiId,
        delivery_fee: s.deliveryFee,
        free_delivery_threshold: s.freeDeliveryThreshold,
        low_stock_threshold: s.lowStockThreshold ?? 5,
        announcement_text: s.announcementText || '',
        coverage_area: s.coverageArea || '',
        office_city: s.officeCity || 'Kozhikode',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to sync settings to Supabase:', err);
    }
  }

  private async syncOrderToSupabase(o: Order) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('orders').upsert({
        id: o.id,
        customer_name: o.customer.fullName,
        phone: o.customer.phone,
        email: (o.customer as any).email || null,
        address: `${o.customer.address}${o.customer.landmark ? ` (Landmark: ${o.customer.landmark})` : ''}`,
        city: (o.customer as any).city || o.customer.district || null,
        pincode: o.customer.pincode,
        subtotal: o.subtotal,
        delivery_fee: o.deliveryFee,
        discount: o.discountAmount,
        coupon_code: o.couponCode || null,
        total: o.grandTotal,
        payment_method: (o.customer as any).paymentMethod || (o.paymentStatus ? 'upi' : 'cod'),
        payment_status: o.paymentStatus,
        order_status: o.status,
        utr_number: o.utrNumber || null,
        payment_submitted_at: o.paymentSubmittedAt || null,
        cancellation_reason: o.cancellationReason || null,
        cancelled_at: o.cancelledAt || null,
        is_restocked_on_cancellation: Boolean(o.isRestockedOnCancellation),
        tracking_number: (o as any).trackingNumber || null,
        notes: o.customer.orderNotes || null,
        created_at: o.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (o.items && o.items.length > 0) {
        for (const item of o.items) {
          await supabase.from('order_items').insert({
            order_id: o.id,
            product_id: item.productId,
            variant_name: item.variantName || null,
            variant_sku: item.variantSku || null,
            product_name: item.productName,
            quantity: item.quantity,
            price_at_purchase: item.unitPrice,
            total_price: item.totalPrice,
            image_url: item.image || null,
          });
        }
      }
    } catch (err) {
      console.error(`Failed to sync order ${o.id} to Supabase:`, err);
    }
  }

  private async syncOrderStatusToSupabase(orderId: string, status: OrderStatus, note?: string, actor = 'Admin') {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('orders').update({
        order_status: status,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);

      await supabase.from('order_status_history').insert({
        order_id: orderId,
        new_status: status,
        changed_by: actor,
        note: note || `Status updated to ${status}`,
      });
    } catch (err) {
      console.error(`Failed to sync order status for ${orderId}:`, err);
    }
  }

  private async syncUtrToSupabase(orderId: string, utrNumber: string) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('orders').update({
        utr_number: utrNumber,
        payment_status: 'submitted',
        order_status: 'payment_submitted',
        payment_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);
    } catch (err) {
      console.error(`Failed to sync UTR for order ${orderId}:`, err);
    }
  }

  private async syncCouponToSupabase(c: Coupon) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('coupons').upsert({
        id: c.id,
        code: c.code,
        description: c.description || null,
        discount_type: c.discountType,
        discount_value: c.discountValue,
        min_order_amount: c.minPurchase || 0,
        max_discount_amount: c.maxDiscount || null,
        usage_limit: c.usageLimit || null,
        times_used: c.usedCount || 0,
        is_active: c.isActive !== false,
        valid_until: c.endDate || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to sync coupon ${c.code} to Supabase:`, err);
    }
  }

  private async deleteCouponFromSupabase(id: string) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('coupons').delete().eq('id', id);
    } catch (err) {
      console.error(`Failed to delete coupon ${id} from Supabase:`, err);
    }
  }

  private async syncStockLogToSupabase(log: StockAdjustmentLog) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('stock_adjustment_logs').upsert({
        id: log.id,
        product_id: log.productId,
        product_name: log.productName,
        variant_sku: log.variantSku || null,
        previous_stock: log.previousStock,
        new_stock: log.newStock,
        delta: log.difference,
        reason: log.reason,
        actor: log.actor || 'admin',
        created_at: log.timestamp || new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to sync stock log ${log.id} to Supabase:`, err);
    }
  }

  private async syncAuditLogToSupabase(log: AuditLog) {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase.from('audit_logs').upsert({
        id: log.id,
        action: log.action,
        actor: log.actor || 'admin',
        details: { detail: log.details, targetId: log.targetId },
        created_at: log.timestamp || new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to sync audit log ${log.id} to Supabase:`, err);
    }
  }

  // --- PRODUCTS ---
  public getProducts(options?: { category?: string; status?: string; search?: string; isAdmin?: boolean }): Product[] {
    let result = [...this.data.products];
    if (!options?.isAdmin) {
      // Public customer store only sees published products
      result = result.filter(p => p.status === 'published');
    } else if (options?.status) {
      result = result.filter(p => p.status === options.status);
    }

    if (options?.category && options.category !== 'All') {
      result = result.filter(p => p.category === options.category);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }

  public getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  public saveProduct(product: Partial<Product> & { id: string }, actor = 'Admin'): { success: boolean; product?: Product; error?: string } {
    // Validation
    if (!product.name || product.name.trim().length === 0) {
      return { success: false, error: 'Product name is required.' };
    }
    if (!product.category) {
      return { success: false, error: 'Category is required.' };
    }
    if (product.price === undefined || product.price < 0) {
      return { success: false, error: 'Valid price is required.' };
    }

    // Publication check: Incomplete product cannot be published
    const isIncomplete = !product.mainImage || product.price <= 0 || !product.sku;
    if (product.status === 'published' && isIncomplete) {
      return { success: false, error: 'Incomplete product cannot be published. Please provide image, SKU, and price.' };
    }

    const existingIdx = this.data.products.findIndex(p => p.id === product.id);
    const existing = existingIdx >= 0 ? this.data.products[existingIdx] : undefined;

    // Auto-generate SKU if missing
    const sku = product.sku?.trim() || existing?.sku || `YM-${product.category.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const fullProduct: Product = {
      id: product.id,
      name: product.name.trim(),
      brand: product.brand?.trim() || 'YEM MART',
      category: product.category,
      description: product.description || '',
      shortSummary: product.shortSummary || product.description?.slice(0, 100) || '',
      highlights: product.highlights || ['100% Genuine Quality Guarantee'],
      specs: product.specs || {},
      price: Number(product.price),
      originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
      discountPercent: product.discountPercent,
      rating: product.rating || 4.8,
      reviewCount: product.reviewCount || 1,
      images: product.images && product.images.length > 0 ? product.images : [product.mainImage || ''],
      mainImage: product.mainImage || (product.images && product.images[0]) || '',
      status: product.status || 'published',
      scheduledPublishDate: product.scheduledPublishDate,
      stock: Number(product.stock ?? 10),
      lowStockThreshold: Number(product.lowStockThreshold ?? 4),
      isFeatured: Boolean(product.isFeatured),
      isBestDeal: Boolean(product.isBestDeal),
      isNewArrival: Boolean(product.isNewArrival),
      variants: product.variants || [],
      requiredVariantType: product.requiredVariantType,
      sku,
      tags: product.tags || [],
    };

    if (existingIdx >= 0) {
      this.data.products[existingIdx] = fullProduct;
      this.logAudit('PRODUCT_UPDATED', actor, `Updated product: ${fullProduct.name} (${fullProduct.sku})`, fullProduct.id);
    } else {
      this.data.products.unshift(fullProduct);
      this.logAudit('PRODUCT_CREATED', actor, `Created new product: ${fullProduct.name} (${fullProduct.sku})`, fullProduct.id);
    }

    this.saveDatabaseSync();
    this.syncProductToSupabase(fullProduct).catch(() => {});
    return { success: true, product: fullProduct };
  }

  public deleteProduct(id: string, actor = 'Admin'): boolean {
    const prod = this.data.products.find(p => p.id === id);
    if (!prod) return false;

    this.data.products = this.data.products.filter(p => p.id !== id);
    this.logAudit('PRODUCT_DELETED', actor, `Deleted product: ${prod.name} (${prod.sku})`, id);
    this.saveDatabaseSync();
    this.deleteProductFromSupabase(id).catch(() => {});
    return true;
  }

  public bulkImportProducts(rows: any[], actor = 'Admin'): { successCount: number; errorCount: number; errors: string[]; imported: Product[] } {
    const errors: string[] = [];
    const imported: Product[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      if (!row.name || !row.category || row.price === undefined) {
        errors.push(`Row ${rowNum}: Missing required fields (name, category, or price).`);
        return;
      }

      const price = Number(row.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowNum} (${row.name}): Invalid price value.`);
        return;
      }

      const id = row.id?.trim() || `prod-imp-${Date.now()}-${idx}`;
      const res = this.saveProduct({
        id,
        name: row.name,
        brand: row.brand || 'YEM MART',
        category: row.category,
        description: row.description || '',
        price,
        originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
        stock: row.stock ? Number(row.stock) : 10,
        sku: row.sku,
        mainImage: row.mainImage || row.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
        status: (row.status === 'draft' || row.status === 'scheduled') ? row.status : 'published',
      }, actor);

      if (res.success && res.product) {
        imported.push(res.product);
      } else if (res.error) {
        errors.push(`Row ${rowNum} (${row.name}): ${res.error}`);
      }
    });

    this.logAudit('BULK_IMPORT', actor, `Imported ${imported.length} products, ${errors.length} failed rows.`);
    this.saveDatabaseSync();
    return { successCount: imported.length, errorCount: errors.length, errors, imported };
  }

  // --- CART & ORDER VALIDATION (TRUSTED SERVER-SIDE) ---
  public validateCart(items: Array<{ productId: string; variantSku?: string; quantity: number }>, couponCode?: string) {
    const errors: string[] = [];
    let subtotal = 0;
    const validatedItems: Array<{
      product: Product;
      variant?: any;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const product = this.getProductById(item.productId);
      if (!product) {
        errors.push(`Product ID ${item.productId} is no longer available.`);
        continue;
      }

      if (product.status !== 'published') {
        errors.push(`Product "${product.name}" is not currently available for ordering.`);
        continue;
      }

      let unitPrice = product.price;
      let availableStock = product.stock;
      let matchedVariant: any = undefined;

      if (item.variantSku && product.variants && product.variants.length > 0) {
        matchedVariant = product.variants.find(v => v.sku === item.variantSku);
        if (matchedVariant) {
          unitPrice = matchedVariant.price;
          availableStock = matchedVariant.stock;
        } else {
          errors.push(`Selected option for "${product.name}" is invalid.`);
          continue;
        }
      }

      if (availableStock <= 0) {
        errors.push(`"${product.name}" ${matchedVariant ? `(${matchedVariant.name})` : ''} is out of stock.`);
        continue;
      }

      if (item.quantity > availableStock) {
        errors.push(`Only ${availableStock} units available for "${product.name}". Please adjust quantity.`);
        continue;
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      validatedItems.push({
        product,
        variant: matchedVariant,
        unitPrice,
        quantity: item.quantity,
        totalPrice: lineTotal,
      });
    }

    // Coupon validation
    let discountAmount = 0;
    let validatedCoupon: Coupon | undefined = undefined;

    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.trim().toUpperCase();
      const cpn = this.data.coupons.find(c => c.code.toUpperCase() === cleanCode && c.isActive);
      const now = new Date();

      if (!cpn) {
        errors.push(`Coupon code "${couponCode}" is invalid or inactive.`);
      } else if (now < new Date(cpn.startDate) || now > new Date(cpn.endDate)) {
        errors.push(`Coupon code "${cpn.code}" has expired.`);
      } else if (cpn.usedCount >= cpn.usageLimit) {
        errors.push(`Coupon code "${cpn.code}" usage limit has been reached.`);
      } else if (subtotal < cpn.minPurchase) {
        errors.push(`Coupon "${cpn.code}" requires minimum purchase of ₹${cpn.minPurchase}.`);
      } else {
        if (cpn.discountType === 'flat') {
          discountAmount = Math.min(subtotal, cpn.discountValue);
        } else {
          const calculated = (subtotal * cpn.discountValue) / 100;
          discountAmount = cpn.maxDiscount ? Math.min(calculated, cpn.maxDiscount) : calculated;
        }
        discountAmount = Math.round(discountAmount);
        validatedCoupon = cpn;
      }
    }

    // Delivery calculation
    const freeThreshold = this.data.settings.freeDeliveryThreshold;
    const deliveryFee = subtotal >= freeThreshold || validatedItems.length === 0 ? 0 : this.data.settings.deliveryFee;
    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);

    return {
      isValid: errors.length === 0 && validatedItems.length > 0,
      errors,
      subtotal,
      deliveryFee,
      discountAmount,
      grandTotal,
      coupon: validatedCoupon,
      validatedItems,
    };
  }

  // --- ORDERS ---
  public getOrders(filter?: { status?: string; search?: string }): Order[] {
    let list = [...this.data.orders];
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(o => o.status === filter.status || o.paymentStatus === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.customer.fullName.toLowerCase().includes(q) ||
        o.customer.phone.includes(q) ||
        (o.utrNumber && o.utrNumber.includes(q))
      );
    }
    return list;
  }

  public getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id);
  }

  public createOrder(customer: CustomerDetails, items: Array<{ productId: string; variantSku?: string; quantity: number }>, couponCode?: string): { success: boolean; order?: Order; error?: string } {
    // 1. Server-side validation
    const validation = this.validateCart(items, couponCode);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    // 2. Concurrency-safe stock deduction
    for (const line of validation.validatedItems) {
      const prod = this.data.products.find(p => p.id === line.product.id);
      if (!prod) continue;

      const prevStock = prod.stock;
      prod.stock = Math.max(0, prod.stock - line.quantity);

      if (line.variant && prod.variants) {
        const v = prod.variants.find(vr => vr.sku === line.variant.sku);
        if (v) {
          v.stock = Math.max(0, v.stock - line.quantity);
        }
      }

      this.data.stockLogs.unshift({
        id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        productId: prod.id,
        productName: prod.name,
        variantSku: line.variant?.sku,
        previousStock: prevStock,
        newStock: prod.stock,
        difference: -line.quantity,
        reason: 'Customer order allocation',
        actor: customer.fullName,
      });
    }

    // 3. Increment coupon usage
    if (validation.coupon) {
      const cpn = this.data.coupons.find(c => c.id === validation.coupon!.id);
      if (cpn) cpn.usedCount += 1;
    }

    // 4. Generate unique Order ID
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `YEM-${dateStr}-${randomSuffix}`;

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customer,
      items: validation.validatedItems.map(it => ({
        productId: it.product.id,
        productName: it.product.name,
        variantName: it.variant?.name,
        variantSku: it.variant?.sku || it.product.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        image: it.product.mainImage,
      })),
      subtotal: validation.subtotal,
      deliveryFee: validation.deliveryFee,
      discountAmount: validation.discountAmount,
      couponCode: validation.coupon?.code,
      grandTotal: validation.grandTotal,
      status: 'whatsapp_pending',
      paymentStatus: 'pending',
      isRestockedOnCancellation: false,
      statusTimeline: [
        {
          status: 'prepared',
          timestamp: new Date().toISOString(),
          note: 'Order ID generated on website. Awaiting manual WhatsApp dispatch by customer.',
        },
      ],
    };

    this.data.orders.unshift(newOrder);
    this.logAudit('ORDER_CREATED', 'Customer', `Order ${orderId} placed (₹${newOrder.grandTotal})`, orderId);
    this.saveDatabaseSync();
    this.syncOrderToSupabase(newOrder).catch(() => {});

    return { success: true, order: newOrder };
  }

  public updateOrderStatus(orderId: string, status: OrderStatus, note?: string, actor = 'Admin'): boolean {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return false;

    // Concurrency safe & IDEMPOTENT RESTOCKING ON CANCELLATION
    if (status === 'cancelled' && !order.isRestockedOnCancellation) {
      for (const line of order.items) {
        const prod = this.data.products.find(p => p.id === line.productId);
        if (!prod) continue;

        const prevStock = prod.stock;
        prod.stock += line.quantity;

        if (line.variantSku && prod.variants) {
          const v = prod.variants.find(vr => vr.sku === line.variantSku);
          if (v) v.stock += line.quantity;
        }

        const stockLog: StockAdjustmentLog = {
          id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          productId: prod.id,
          productName: prod.name,
          variantSku: line.variantSku,
          previousStock: prevStock,
          newStock: prod.stock,
          difference: line.quantity,
          reason: `Order ${orderId} cancellation restock`,
          actor,
        };
        this.data.stockLogs.unshift(stockLog);
        this.syncStockLogToSupabase(stockLog).catch(() => {});
        this.syncProductToSupabase(prod).catch(() => {});
      }
      order.isRestockedOnCancellation = true;
      order.cancelledAt = new Date().toISOString();
      if (note) order.cancellationReason = note;
    }

    order.status = status;
    order.statusTimeline.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Order status updated to ${status} by ${actor}`,
    });

    this.logAudit('ORDER_STATUS_UPDATE', actor, `Order ${orderId} status set to ${status}`, orderId);
    this.saveDatabaseSync();
    this.syncOrderStatusToSupabase(orderId, status, note, actor).catch(() => {});
    return true;
  }

  public verifyPayment(orderId: string, actor = 'Admin'): boolean {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return false;

    order.paymentStatus = 'verified';
    order.status = 'confirmed';
    order.statusTimeline.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Admin verified UPI bank credit for UTR: ${order.utrNumber || 'N/A'}. Order confirmed.`,
    });

    this.logAudit('PAYMENT_VERIFIED', actor, `Verified payment for Order ${orderId}`, orderId);
    this.saveDatabaseSync();
    this.syncOrderStatusToSupabase(orderId, 'confirmed', 'Admin verified UPI bank credit', actor).catch(() => {});
    return true;
  }

  public submitUtr(orderId: string, utrNumber: string): boolean {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return false;

    order.utrNumber = utrNumber.trim();
    order.paymentStatus = 'submitted';
    order.paymentSubmittedAt = new Date().toISOString();
    order.status = 'payment_submitted';
    order.statusTimeline.push({
      status: 'payment_submitted',
      timestamp: new Date().toISOString(),
      note: `Customer submitted 12-digit UPI UTR: ${utrNumber.trim()}. Admin verification pending.`,
    });

    this.logAudit('UTR_SUBMITTED', 'Customer', `Submitted UTR ${utrNumber} for Order ${orderId}`, orderId);
    this.saveDatabaseSync();
    this.syncUtrToSupabase(orderId, utrNumber).catch(() => {});
    return true;
  }

  public trackOrder(orderId: string, phone: string): { success: boolean; order?: Order; error?: string } {
    const cleanOid = orderId.trim().toUpperCase();
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 4) {
      return { success: false, error: 'Please enter at least 4 digits of the phone number used when placing the order.' };
    }

    const found = this.data.orders.find(o => {
      const orderPhone = o.customer.phone.replace(/[^0-9]/g, '');
      return o.id.toUpperCase() === cleanOid && 
        (orderPhone.endsWith(cleanPhone) || orderPhone === cleanPhone);
    });

    if (!found) {
      return { success: false, error: 'No matching order found with this Order ID and Phone combination.' };
    }

    // Mask sensitive personal information to prevent data exposure
    const maskedCustomer: CustomerDetails = {
      ...found.customer,
      fullName: found.customer.fullName.split(' ').map(p => p.length > 1 ? p[0] + '***' : p).join(' '),
      phone: found.customer.phone.length >= 6 
        ? found.customer.phone.slice(0, 3) + '****' + found.customer.phone.slice(-3)
        : '******',
      address: 'Masked for security',
      landmark: undefined,
      orderNotes: undefined,
    };

    const sanitizedOrder: Order = {
      ...found,
      customer: maskedCustomer,
    };

    return { success: true, order: sanitizedOrder };
  }

  // --- INVENTORY ADJUSTMENT ---
  public adjustStock(productId: string, variantSku: string | undefined, newStock: number, reason: string, actor = 'Admin'): boolean {
    const prod = this.data.products.find(p => p.id === productId);
    if (!prod) return false;

    let previousStock = prod.stock;
    if (variantSku && prod.variants) {
      const v = prod.variants.find(vr => vr.sku === variantSku);
      if (v) {
        previousStock = v.stock;
        v.stock = Math.max(0, newStock);
        prod.stock = prod.variants.reduce((acc, item) => acc + item.stock, 0);
      }
    } else {
      prod.stock = Math.max(0, newStock);
    }

    const stockLog: StockAdjustmentLog = {
      id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      productId: prod.id,
      productName: prod.name,
      variantSku,
      previousStock,
      newStock,
      difference: newStock - previousStock,
      reason: reason || 'Manual stock adjustment',
      actor,
    };
    this.data.stockLogs.unshift(stockLog);

    this.logAudit('STOCK_ADJUSTED', actor, `Adjusted stock for ${prod.name} (${previousStock} -> ${newStock})`, prod.id);
    this.saveDatabaseSync();
    this.syncStockLogToSupabase(stockLog).catch(() => {});
    this.syncProductToSupabase(prod).catch(() => {});
    return true;
  }

  // --- SETTINGS ---
  public getSettings(): StoreSettings {
    return { ...this.data.settings };
  }

  public updateSettings(newSettings: Partial<StoreSettings>, actor = 'Admin'): StoreSettings {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
    };
    this.logAudit('SETTINGS_UPDATED', actor, 'Updated storefront settings & delivery rules');
    this.saveDatabaseSync();
    this.syncSettingsToSupabase(this.data.settings).catch(() => {});
    return this.data.settings;
  }

  // --- COUPONS ---
  public getCoupons(): Coupon[] {
    return [...this.data.coupons];
  }

  public saveCoupon(coupon: Coupon, actor = 'Admin'): Coupon {
    const existingIdx = this.data.coupons.findIndex(c => c.id === coupon.id || c.code.toUpperCase() === coupon.code.toUpperCase());
    if (existingIdx >= 0) {
      this.data.coupons[existingIdx] = coupon;
      this.logAudit('COUPON_UPDATED', actor, `Updated coupon ${coupon.code}`, coupon.id);
    } else {
      this.data.coupons.unshift(coupon);
      this.logAudit('COUPON_CREATED', actor, `Created coupon ${coupon.code}`, coupon.id);
    }
    this.saveDatabaseSync();
    this.syncCouponToSupabase(coupon).catch(() => {});
    return coupon;
  }

  public deleteCoupon(id: string, actor = 'Admin'): boolean {
    const cpn = this.data.coupons.find(c => c.id === id);
    if (!cpn) return false;
    this.data.coupons = this.data.coupons.filter(c => c.id !== id);
    this.logAudit('COUPON_DELETED', actor, `Deleted coupon ${cpn.code}`, id);
    this.saveDatabaseSync();
    this.deleteCouponFromSupabase(id).catch(() => {});
    return true;
  }

  // --- LOGS ---
  public getAuditLogs(): AuditLog[] {
    return [...this.data.auditLogs];
  }

  public getStockLogs(): StockAdjustmentLog[] {
    return [...this.data.stockLogs];
  }
}

export const store = new Store();
