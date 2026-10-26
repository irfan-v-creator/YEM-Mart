import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { 
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
} from '../src/types/index.js';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SETTINGS, 
  INITIAL_ORDERS, 
  INITIAL_COUPONS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_STOCK_LOGS 
} from '../src/data/initialData.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'yem_database.json');

// Vercel Serverless and AWS Lambda execution environment detection
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

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
  private lastHydratedAt = 0;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadDatabase();

    // Ensure default supportPhone is strictly 7510447887
    if (this.data.settings && (!this.data.settings.supportPhone || this.data.settings.supportPhone.includes('94000'))) {
      this.data.settings.supportPhone = '7510447887';
      if (!isServerless) {
        this.saveDatabaseSync();
      }
    }

    // Hydrate from Supabase PostgreSQL if credentials configured
    if (isSupabaseConfigured()) {
      this.hydrateFromSupabase().catch(err => {
        console.warn('Supabase initial hydration notice:', err?.message || err);
      });
    }
  }

  public getLastHydratedAt(): number {
    return this.lastHydratedAt;
  }

  private ensureDataDirectory(): boolean {
    if (isServerless) return false;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      return true;
    } catch (err) {
      // In serverless / read-only filesystem, directory creation is safely skipped
      return false;
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!isServerless && fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS,
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          settings: parsed.settings && parsed.settings.storeName ? parsed.settings : INITIAL_SETTINGS,
          coupons: Array.isArray(parsed.coupons) ? parsed.coupons : INITIAL_COUPONS,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : INITIAL_AUDIT_LOGS,
          stockLogs: Array.isArray(parsed.stockLogs) ? parsed.stockLogs : INITIAL_STOCK_LOGS,
        };
      }
    } catch (err) {
      console.warn('Notice reading local database file, using defaults:', (err as any)?.message || err);
    }

    const defaultData: DatabaseSchema = {
      products: INITIAL_PRODUCTS,
      orders: [],
      settings: INITIAL_SETTINGS,
      coupons: INITIAL_COUPONS,
      auditLogs: INITIAL_AUDIT_LOGS,
      stockLogs: INITIAL_STOCK_LOGS,
    };
    if (!isServerless) {
      this.saveDatabaseSync(defaultData);
    }
    return defaultData;
  }

  private saveDatabaseSync(dataToSave = this.data) {
    if (isServerless) {
      // In Vercel serverless, Supabase is the persistent store; skip immutable /var/task filesystem writes
      return;
    }
    try {
      const ready = this.ensureDataDirectory();
      if (!ready) return;
      const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
      const jsonStr = JSON.stringify(dataToSave, null, 2);
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.warn('Notice writing to local database file (relying on Supabase):', (err as any)?.message || err);
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
          originalPrice: r.original_price ? Number(r.original_price) : (r.mrp ? Number(r.mrp) : undefined),
          discountPercent: r.discount_percent !== undefined ? Number(r.discount_percent) : (r.discount_percentage ? Number(r.discount_percentage) : 0),
          rating: r.rating ? Number(r.rating) : 4.5,
          reviewCount: r.review_count ? Number(r.review_count) : 0,
          images: Array.isArray(r.images) && r.images.length > 0 ? r.images : [r.main_image || ''],
          mainImage: r.main_image || (r.images && r.images[0]) || '',
          status: r.status || 'published',
          scheduledPublishDate: r.scheduled_publish_date || undefined,
          stock: Number(r.stock ?? r.stock_count ?? 0),
          lowStockThreshold: Number(r.low_stock_threshold ?? 5),
          isFeatured: Boolean(r.is_featured),
          isBestDeal: Boolean(r.is_best_deal),
          isNewArrival: Boolean(r.is_new_arrival),
          requiredVariantType: r.required_variant_type || undefined,
          sku: r.sku || '',
          tags: Array.isArray(r.tags) ? r.tags : [],
          variants: Array.isArray(r.variants) ? r.variants : [],
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
          minPurchase: Number(c.min_purchase ?? c.min_order_amount ?? 0),
          maxDiscount: c.max_discount ? Number(c.max_discount) : (c.max_discount_amount ? Number(c.max_discount_amount) : undefined),
          startDate: c.start_date || c.valid_from || new Date().toISOString(),
          endDate: c.end_date || c.valid_until || '2030-12-31T23:59:59Z',
          usageLimit: c.usage_limit ? Number(c.usage_limit) : 9999,
          usedCount: Number(c.used_count ?? c.times_used ?? 0),
          isActive: Boolean(c.is_active),
        }));
      }

      // 4. Orders
      const { data: oRows, error: oErr } = await supabase.from('orders').select('*');
      if (!oErr && oRows && oRows.length > 0) {
        this.data.orders = oRows.map((o: any) => ({
          id: o.id,
          createdAt: o.created_at,
          customer: o.customer || {
            fullName: o.customer_name || 'Customer',
            phone: o.phone || '',
            address: o.address || '',
            pincode: o.pincode || '',
          },
          items: Array.isArray(o.items) ? o.items : [],
          subtotal: Number(o.subtotal || 0),
          deliveryFee: Number(o.delivery_fee || 0),
          discountAmount: Number(o.discount_amount || o.discount || 0),
          couponCode: o.coupon_code || undefined,
          grandTotal: Number(o.grand_total || o.total || 0),
          status: o.status || o.order_status || 'prepared',
          paymentStatus: o.payment_status || 'pending',
          utrNumber: o.utr_number || undefined,
          paymentSubmittedAt: o.payment_submitted_at || undefined,
          cancellationReason: o.cancellation_reason || undefined,
          cancelledAt: o.cancelled_at || undefined,
          isRestockedOnCancellation: Boolean(o.is_restocked_on_cancellation),
          statusTimeline: Array.isArray(o.status_timeline) ? o.status_timeline : [],
          updatedAt: o.updated_at,
        }));
      }

      this.lastHydratedAt = Date.now();
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
        original_price: p.originalPrice || p.price,
        price: p.price,
        discount_percent: p.discountPercent ?? 0,
        images: p.images || [],
        main_image: p.mainImage || (p.images?.[0] ?? null),
        tags: p.tags || [],
        stock: p.stock ?? 0,
        low_stock_threshold: p.lowStockThreshold ?? 5,
        sku: p.sku || null,
        is_featured: Boolean(p.isFeatured),
        is_best_deal: Boolean(p.isBestDeal),
        is_new_arrival: Boolean(p.isNewArrival),
        required_variant_type: p.requiredVariantType || null,
        status: p.status || 'published',
        scheduled_publish_date: p.scheduledPublishDate || null,
        variants: p.variants || [],
        updated_at: new Date().toISOString(),
      });
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
        created_at: o.createdAt || new Date().toISOString(),
        customer: o.customer,
        items: o.items || [],
        subtotal: o.subtotal,
        delivery_fee: o.deliveryFee,
        discount_amount: o.discountAmount,
        coupon_code: o.couponCode || null,
        grand_total: o.grandTotal,
        status: o.status,
        payment_status: o.paymentStatus || 'pending',
        utr_number: o.utrNumber || null,
        payment_submitted_at: o.paymentSubmittedAt || null,
        cancellation_reason: o.cancellationReason || null,
        cancelled_at: o.cancelledAt || null,
        is_restocked_on_cancellation: Boolean(o.isRestockedOnCancellation),
        status_timeline: o.statusTimeline || [],
        updated_at: new Date().toISOString(),
      });
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
        status: status,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);
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
        status: 'payment_submitted',
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
        min_purchase: c.minPurchase || 0,
        max_discount: c.maxDiscount || null,
        usage_limit: c.usageLimit || null,
        used_count: c.usedCount || 0,
        is_active: c.isActive !== false,
        end_date: c.endDate || null,
        created_at: new Date().toISOString(),
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
        timestamp: log.timestamp || new Date().toISOString(),
        product_id: log.productId,
        product_name: log.productName,
        variant_sku: log.variantSku || null,
        previous_stock: log.previousStock,
        new_stock: log.newStock,
        difference: log.difference,
        reason: log.reason,
        actor: log.actor || 'admin',
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
        timestamp: log.timestamp || new Date().toISOString(),
        action: log.action,
        actor: log.actor || 'admin',
        details: { detail: log.details, targetId: log.targetId },
        target_id: log.targetId || null,
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
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();
    return this.data.products.find(p => p.id.toLowerCase() === clean || (p.sku && p.sku.toLowerCase() === clean));
  }

  public async saveProduct(product: Partial<Product> & { id: string }, actor = 'Admin'): Promise<{ success: boolean; product?: Product; error?: string }> {
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
    await this.syncProductToSupabase(fullProduct);
    await this.hydrateFromSupabase().catch(() => {});
    return { success: true, product: this.getProductById(fullProduct.id) || fullProduct };
  }

  public async deleteProduct(id: string, actor = 'Admin'): Promise<boolean> {
    const prod = this.data.products.find(p => p.id === id);
    if (!prod) return false;

    this.data.products = this.data.products.filter(p => p.id !== id);
    this.logAudit('PRODUCT_DELETED', actor, `Deleted product: ${prod.name} (${prod.sku})`, id);
    this.saveDatabaseSync();
    await this.deleteProductFromSupabase(id);
    await this.hydrateFromSupabase().catch(() => {});
    return true;
  }

  public async bulkImportProducts(rows: any[], actor = 'Admin'): Promise<{ successCount: number; errorCount: number; errors: string[]; imported: Product[] }> {
    const errors: string[] = [];
    const imported: Product[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 1;
      if (!row.name || !row.category || row.price === undefined) {
        errors.push(`Row ${rowNum}: Missing required fields (name, category, or price).`);
        continue;
      }

      const price = Number(row.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowNum} (${row.name}): Invalid price value.`);
        continue;
      }

      const id = row.id?.trim() || `prod-imp-${Date.now()}-${idx}`;
      const res = await this.saveProduct({
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
    }

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
  private toOrderSummary(o: Order) {
    const totalUnits = Array.isArray(o.items)
      ? o.items.reduce((sum, it) => sum + (it.quantity || 1), 0)
      : 0;
    const preview = Array.isArray(o.items) && o.items.length > 0
      ? o.items.slice(0, 2).map(it => `${it.productName}${it.quantity > 1 ? ` (×${it.quantity})` : ''}`).join(', ') + (o.items.length > 2 ? ` +${o.items.length - 2} more` : '')
      : 'Items logged';

    return {
      id: o.id,
      createdAt: o.createdAt,
      customer: {
        fullName: o.customer?.fullName || 'Customer',
        phone: o.customer?.phone || '',
        district: o.customer?.district || 'Kerala',
        pincode: o.customer?.pincode || '',
      },
      itemsCount: totalUnits,
      itemsSummary: preview,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      discountAmount: o.discountAmount,
      grandTotal: o.grandTotal,
      status: o.status,
      paymentStatus: o.paymentStatus,
      utrNumber: o.utrNumber,
      paymentSubmittedAt: o.paymentSubmittedAt,
      cancellationReason: o.cancellationReason,
    };
  }

  public getOrders(options?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    summary?: boolean;
  }): any {
    let list = [...this.data.orders];

    // Status filter
    if (options?.status && options.status !== 'all') {
      list = list.filter(o => o.status === options.status || o.paymentStatus === options.status);
    }

    // Search query
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(o => 
        o.id.toLowerCase().includes(q) ||
        (o.customer?.fullName && o.customer.fullName.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        (o.utrNumber && o.utrNumber.includes(q))
      );
    }

    // Sort newest orders first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // If pagination requested
    if (options?.page || options?.limit) {
      const totalCount = list.length;
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 25));
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedSlice = list.slice(startIndex, startIndex + limit);

      return {
        orders: options.summary ? paginatedSlice.map(o => this.toOrderSummary(o)) : paginatedSlice,
        totalCount,
        page,
        limit,
        totalPages,
      };
    }

    // Default backward compatible array
    if (options?.summary) {
      return list.map(o => this.toOrderSummary(o));
    }

    return list;
  }

  public getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id);
  }

  public createOrder(customer: CustomerDetails, items: Array<{ productId: string; variantSku?: string; quantity: number }>, couponCode?: string): { success: boolean; order?: Order; error?: string } {
    // 1. Server-side customer input validation
    if (!customer || typeof customer !== 'object') {
      return { success: false, error: 'Customer details are required.' };
    }
    const fullName = (customer.fullName || '').trim();
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    const address = (customer.address || '').trim();
    const pincode = (customer.pincode || '').trim();
    const district = (customer.district || '').trim();

    if (fullName.length < 2 || fullName.length > 100) {
      return { success: false, error: 'Please provide a valid customer full name (2-100 characters).' };
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return { success: false, error: 'Please provide a valid 10-digit Indian mobile number starting with 6-9.' };
    }
    if (!/^\d{6}$/.test(pincode) || (!pincode.startsWith('67') && !pincode.startsWith('68') && !pincode.startsWith('69'))) {
      return { success: false, error: 'Please provide a valid 6-digit Kerala PIN code (starting with 67, 68, or 69).' };
    }
    if (address.length < 5 || address.length > 300) {
      return { success: false, error: 'Please provide a complete delivery street address (5-300 characters).' };
    }
    if (!district) {
      return { success: false, error: 'Delivery district is required.' };
    }

    // 2. Server-side cart validation
    const validation = this.validateCart(items, couponCode);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    // 3. Concurrency-safe stock deduction
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
        id: `stk-${Date.now()}-${crypto.randomInt(100, 999)}`,
        timestamp: new Date().toISOString(),
        productId: prod.id,
        productName: prod.name,
        variantSku: line.variant?.sku,
        previousStock: prevStock,
        newStock: prod.stock,
        difference: -line.quantity,
        reason: 'Customer order allocation',
        actor: fullName,
      });
    }

    // 4. Increment coupon usage
    if (validation.coupon) {
      const cpn = this.data.coupons.find(c => c.id === validation.coupon!.id);
      if (cpn) cpn.usedCount += 1;
    }

    // 5. Generate high-entropy cryptographic Order ID
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // 16.7M unique keys
    const orderId = `YEM-${dateStr}-${randomSuffix}`;

    const sanitizedCustomer: CustomerDetails = {
      fullName,
      phone,
      address,
      pincode,
      district,
      landmark: customer.landmark ? customer.landmark.trim() : undefined,
      orderNotes: customer.orderNotes ? customer.orderNotes.trim() : undefined,
    };

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customer: sanitizedCustomer,
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
    this.syncOrderToSupabase(newOrder).catch((err) => {
      console.error('[Supabase Sync Error] createOrder:', err);
    });

    return { success: true, order: newOrder };
  }

  public updateOrderStatus(orderId: string, status: OrderStatus, note?: string, actor = 'Admin'): { success: boolean; error?: string } {
    const validStatuses: OrderStatus[] = [
      'prepared',
      'whatsapp_pending',
      'payment_submitted',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid order status: ${status}` };
    }

    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    // Disallow reopening delivered or cancelled orders
    if (order.status === 'delivered' && status !== 'delivered') {
      return { success: false, error: 'Delivered orders cannot transition back to an earlier status.' };
    }
    if (order.status === 'cancelled' && status !== 'cancelled') {
      return { success: false, error: 'Cancelled orders cannot be reopened.' };
    }

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
          id: `stk-${Date.now()}-${crypto.randomInt(100, 999)}`,
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
        this.syncStockLogToSupabase(stockLog).catch((err) => {
          console.error('[Supabase Sync Error] restockLog:', err);
        });
        this.syncProductToSupabase(prod).catch((err) => {
          console.error('[Supabase Sync Error] restockProduct:', err);
        });
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
    this.syncOrderStatusToSupabase(orderId, status, note, actor).catch((err) => {
      console.error('[Supabase Sync Error] updateOrderStatus:', err);
    });
    return { success: true };
  }

  public verifyPayment(orderId: string, actor = 'Admin'): { success: boolean; error?: string } {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    if (order.status === 'cancelled') {
      return { success: false, error: 'Cannot verify payment for a cancelled order.' };
    }
    if (order.status === 'delivered') {
      return { success: false, error: 'Order is already marked as delivered.' };
    }
    if (order.paymentStatus === 'verified' && order.status === 'confirmed') {
      return { success: true }; // Idempotent
    }
    if (!order.utrNumber && order.paymentMethod !== 'cod') {
      return { success: false, error: 'Cannot verify payment: No customer UTR number has been submitted yet.' };
    }

    order.paymentStatus = 'verified';
    order.status = 'confirmed';
    order.statusTimeline.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Admin verified payment for UTR: ${order.utrNumber || 'COD Doorstep'}. Order confirmed.`,
    });

    this.logAudit('PAYMENT_VERIFIED', actor, `Verified payment for Order ${orderId}`, orderId);
    this.saveDatabaseSync();
    this.syncOrderStatusToSupabase(orderId, 'confirmed', 'Admin verified UPI bank credit', actor).catch((err) => {
      console.error('[Supabase Sync Error] verifyPayment:', err);
    });
    return { success: true };
  }

  public submitUtr(orderId: string, utrNumber: string): { success: boolean; error?: string } {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    const cleanUtr = utrNumber.trim();
    if (!/^[a-zA-Z0-9]{6,24}$/.test(cleanUtr)) {
      return { success: false, error: 'Invalid UTR format. Expected 6-to-24 alphanumeric characters.' };
    }

    // State machine guard: UTR can only be submitted for pending orders
    if (order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
      return { success: false, error: `Order is already ${order.status}. Payment has already been verified.` };
    }
    if (order.status === 'cancelled') {
      return { success: false, error: 'Cannot submit UTR for a cancelled order.' };
    }
    if (order.paymentStatus === 'verified') {
      return { success: false, error: 'Payment is already verified for this order.' };
    }

    order.utrNumber = cleanUtr;
    order.paymentStatus = 'submitted';
    order.paymentSubmittedAt = new Date().toISOString();
    order.status = 'payment_submitted';
    order.statusTimeline.push({
      status: 'payment_submitted',
      timestamp: new Date().toISOString(),
      note: `Customer submitted UPI UTR: ${cleanUtr}. Admin verification pending.`,
    });

    this.logAudit('UTR_SUBMITTED', 'Customer', `Submitted UTR for Order ${orderId}`, orderId);
    this.saveDatabaseSync();
    this.syncUtrToSupabase(orderId, cleanUtr).catch((err) => {
      console.error('[Supabase Sync Error] submitUtr:', err);
    });
    return { success: true };
  }

  public trackOrder(orderId: string, phone: string): { success: boolean; order?: Order; error?: string } {
    const cleanOid = orderId.trim().toUpperCase();
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    // Require full 10-digit phone match to prevent brute-force enumeration
    if (cleanPhone.length !== 10) {
      return { success: false, error: 'Please enter your complete 10-digit mobile number used when placing the order.' };
    }

    const found = this.data.orders.find(o => {
      const orderPhone = o.customer.phone.replace(/[^0-9]/g, '');
      return o.id.toUpperCase() === cleanOid && orderPhone === cleanPhone;
    });

    if (!found) {
      return { success: false, error: 'No matching order found with this Order ID and 10-digit Phone combination.' };
    }

    // Deep mask sensitive personal information to prevent PII harvesting
    const maskedCustomer: CustomerDetails = {
      fullName: found.customer.fullName.split(' ').map(p => p.length > 1 ? p[0] + '***' : p).join(' '),
      phone: found.customer.phone.slice(0, 3) + '*****' + found.customer.phone.slice(-2),
      address: 'Protected Destination, ' + (found.customer.district || 'Kerala'),
      pincode: found.customer.pincode.slice(0, 3) + '***',
      district: found.customer.district,
      landmark: found.customer.landmark ? 'Protected Landmark' : undefined,
      orderNotes: undefined,
    };

    const sanitizedOrder: Order = {
      ...found,
      customer: maskedCustomer,
      utrNumber: found.utrNumber ? found.utrNumber.slice(0, 4) + '******' : undefined,
    };

    return { success: true, order: sanitizedOrder };
  }

  // --- INVENTORY ADJUSTMENT ---
  public async adjustStock(productId: string, variantSku: string | undefined, newStock: number, reason: string, actor = 'Admin'): Promise<boolean> {
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
    await Promise.all([
      this.syncStockLogToSupabase(stockLog).catch(() => {}),
      this.syncProductToSupabase(prod).catch(() => {}),
    ]);
    await this.hydrateFromSupabase().catch(() => {});
    return true;
  }

  // --- SETTINGS ---
  public getSettings(): StoreSettings {
    return { ...this.data.settings };
  }

  public async updateSettings(newSettings: Partial<StoreSettings>, actor = 'Admin'): Promise<StoreSettings> {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings,
    };
    this.logAudit('SETTINGS_UPDATED', actor, 'Updated storefront settings & delivery rules');
    this.saveDatabaseSync();
    await this.syncSettingsToSupabase(this.data.settings);
    await this.hydrateFromSupabase().catch(() => {});
    return this.data.settings;
  }

  // --- COUPONS ---
  public getCoupons(): Coupon[] {
    return [...this.data.coupons];
  }

  public async saveCoupon(coupon: Coupon, actor = 'Admin'): Promise<Coupon> {
    const existingIdx = this.data.coupons.findIndex(c => c.id === coupon.id || c.code.toUpperCase() === coupon.code.toUpperCase());
    if (existingIdx >= 0) {
      this.data.coupons[existingIdx] = coupon;
      this.logAudit('COUPON_UPDATED', actor, `Updated coupon ${coupon.code}`, coupon.id);
    } else {
      this.data.coupons.unshift(coupon);
      this.logAudit('COUPON_CREATED', actor, `Created coupon ${coupon.code}`, coupon.id);
    }
    this.saveDatabaseSync();
    await this.syncCouponToSupabase(coupon);
    await this.hydrateFromSupabase().catch(() => {});
    return coupon;
  }

  public async deleteCoupon(id: string, actor = 'Admin'): Promise<boolean> {
    const cpn = this.data.coupons.find(c => c.id === id);
    if (!cpn) return false;
    this.data.coupons = this.data.coupons.filter(c => c.id !== id);
    this.logAudit('COUPON_DELETED', actor, `Deleted coupon ${cpn.code}`, id);
    this.saveDatabaseSync();
    await this.deleteCouponFromSupabase(id);
    await this.hydrateFromSupabase().catch(() => {});
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
