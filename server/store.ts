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
    return { success: true, product: fullProduct };
  }

  public deleteProduct(id: string, actor = 'Admin'): boolean {
    const prod = this.data.products.find(p => p.id === id);
    if (!prod) return false;

    this.data.products = this.data.products.filter(p => p.id !== id);
    this.logAudit('PRODUCT_DELETED', actor, `Deleted product: ${prod.name} (${prod.sku})`, id);
    this.saveDatabaseSync();
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

        this.data.stockLogs.unshift({
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

    this.data.stockLogs.unshift({
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
    });

    this.logAudit('STOCK_ADJUSTED', actor, `Adjusted stock for ${prod.name} (${previousStock} -> ${newStock})`, prod.id);
    this.saveDatabaseSync();
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
    return coupon;
  }

  public deleteCoupon(id: string, actor = 'Admin'): boolean {
    const cpn = this.data.coupons.find(c => c.id === id);
    if (!cpn) return false;
    this.data.coupons = this.data.coupons.filter(c => c.id !== id);
    this.logAudit('COUPON_DELETED', actor, `Deleted coupon ${cpn.code}`, id);
    this.saveDatabaseSync();
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
