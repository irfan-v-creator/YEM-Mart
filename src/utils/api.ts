import { Product, Order, StoreSettings, Coupon, AuditLog, StockAdjustmentLog, CustomerDetails, OrderStatus } from '../types';

let currentAdminToken = typeof window !== 'undefined' ? sessionStorage.getItem('yem_admin_token') || '' : '';

function getAdminHeaders(): Record<string, string> {
  const token = currentAdminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('yem_admin_token') || '' : '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Admin Authentication
  async loginAdmin(password: string, role = 'owner'): Promise<{ token: string; role: string; actorName: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to authenticate admin');
    }
    const data = await res.json();
    currentAdminToken = data.token;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('yem_admin_token', data.token);
      sessionStorage.setItem('yem_admin_role', data.role);
    }
    return data;
  },

  async logoutAdmin(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
    } catch {}
    currentAdminToken = '';
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('yem_admin_token');
      sessionStorage.removeItem('yem_admin_role');
    }
  },

  async checkAdminAuth(): Promise<{ authenticated: boolean; role?: string; actorName?: string }> {
    const token = currentAdminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('yem_admin_token') || '' : '');
    if (!token) return { authenticated: false };
    try {
      const res = await fetch('/api/admin/me', {
        headers: getAdminHeaders(),
      });
      if (!res.ok) {
        currentAdminToken = '';
        if (typeof window !== 'undefined') sessionStorage.removeItem('yem_admin_token');
        return { authenticated: false };
      }
      return await res.json();
    } catch {
      return { authenticated: false };
    }
  },

  hasStoredAdminToken(): boolean {
    return Boolean(currentAdminToken || (typeof window !== 'undefined' && sessionStorage.getItem('yem_admin_token')));
  },

  // Products
  async getProducts(params?: { category?: string; status?: string; search?: string }): Promise<Product[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);

    const res = await fetch(`/api/products?${q.toString()}`, {
      headers: getAdminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async saveProduct(product: Partial<Product> & { id: string }, actor = 'Admin'): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 
        ...getAdminHeaders(),
        'x-admin-actor': actor
      },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save product');
    }
    return res.json();
  },

  async deleteProduct(id: string, actor = 'Admin'): Promise<void> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete product');
    }
  },

  async bulkImportProducts(rows: any[], actor = 'Admin') {
    const res = await fetch('/api/products/bulk-import', {
      method: 'POST',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to import products');
    }
    return res.json();
  },

  // Cart Validation (Trusted Server-Side)
  async validateCart(items: Array<{ productId: string; variantSku?: string; quantity: number }>, couponCode?: string) {
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, couponCode }),
    });
    if (!res.ok) throw new Error('Failed to validate cart');
    return res.json();
  },

  // Orders
  async getOrders(params?: { status?: string; search?: string }): Promise<Order[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);

    const res = await fetch(`/api/orders?${q.toString()}`, {
      headers: getAdminHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch orders (Admin authorization required)');
    }
    return res.json();
  },

  async createOrder(customer: CustomerDetails, items: Array<{ productId: string; variantSku?: string; quantity: number }>, couponCode?: string): Promise<Order> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items, couponCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create order');
    }
    return res.json();
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string, actor = 'Admin') {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      body: JSON.stringify({ status, note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update status');
    }
    return res.json();
  },

  async verifyPayment(orderId: string, actor = 'Admin') {
    const res = await fetch(`/api/orders/${orderId}/verify-payment`, {
      method: 'PUT',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to verify payment');
    }
    return res.json();
  },

  async submitUtr(orderId: string, utrNumber: string) {
    const res = await fetch(`/api/orders/${orderId}/submit-utr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utrNumber }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit UTR');
    }
    return res.json();
  },

  async trackOrder(orderId: string, phone: string): Promise<Order> {
    const res = await fetch('/api/orders/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Order lookup failed');
    }
    return res.json();
  },

  // Stock Adjustment
  async adjustStock(productId: string, variantSku: string | undefined, newStock: number, reason: string, actor = 'Admin') {
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      body: JSON.stringify({ productId, variantSku, newStock, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to adjust stock');
    }
    return res.json();
  },

  // Settings
  async getSettings(): Promise<StoreSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: Partial<StoreSettings>, actor = 'Admin'): Promise<StoreSettings> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update settings');
    }
    return res.json();
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const res = await fetch('/api/coupons', {
      headers: getAdminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch coupons');
    return res.json();
  },

  async saveCoupon(coupon: Coupon, actor = 'Admin'): Promise<Coupon> {
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      body: JSON.stringify(coupon),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save coupon');
    }
    return res.json();
  },

  async deleteCoupon(id: string, actor = 'Admin'): Promise<void> {
    const res = await fetch(`/api/coupons/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete coupon');
    }
  },

  // Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs', {
      headers: getAdminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  async getStockLogs(): Promise<StockAdjustmentLog[]> {
    const res = await fetch('/api/stock-logs', {
      headers: getAdminHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stock logs');
    return res.json();
  },
};

