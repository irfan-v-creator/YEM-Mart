import { Product, Order, StoreSettings, Coupon, AuditLog, StockAdjustmentLog, CustomerDetails, OrderStatus } from '../types';

// Safe multi-tier token persistence (In-memory -> SessionStorage -> LocalStorage -> Cookie)
let currentAdminToken = '';

function safeGetStorage(key: string): string {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const val = window.sessionStorage.getItem(key);
      if (val) return val;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val) return val;
    }
  } catch {}
  try {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + key + '=([^;]+)'));
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  } catch {}
  return '';
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=28800; SameSite=Lax`;
    }
  } catch {}
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {}
}

// Initialize token on bundle execution
currentAdminToken = safeGetStorage('yem_admin_token');

function getAdminHeaders(): Record<string, string> {
  const token = currentAdminToken || safeGetStorage('yem_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }
  return headers;
}

export function extractErrorMessage(err: any, fallback = 'Invalid admin passkey or unauthorized role.'): string {
  if (!err) return fallback;

  // 1. Direct string
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (trimmed && trimmed !== '[object Object]' && trimmed !== 'null' && trimmed !== 'undefined') {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          return extractErrorMessage(parsed, fallback);
        } catch {}
      }
      return trimmed;
    }
    return fallback;
  }

  // 2. Axios-style err.response?.data
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return extractErrorMessage(d, fallback);
    if (typeof d === 'object') {
      if (typeof d.error === 'string') return extractErrorMessage(d.error, fallback);
      if (typeof d.message === 'string') return extractErrorMessage(d.message, fallback);
      if (d.error && typeof d.error === 'object') return extractErrorMessage(d.error, fallback);
    }
  }

  // 3. Generic object err.data
  if (err.data) {
    const d = err.data;
    if (typeof d === 'string') return extractErrorMessage(d, fallback);
    if (typeof d === 'object') {
      if (typeof d.error === 'string') return extractErrorMessage(d.error, fallback);
      if (typeof d.message === 'string') return extractErrorMessage(d.message, fallback);
      if (d.error && typeof d.error === 'object') return extractErrorMessage(d.error, fallback);
    }
  }

  // 4. err.error
  if (err.error) {
    if (typeof err.error === 'string') return extractErrorMessage(err.error, fallback);
    if (typeof err.error === 'object') return extractErrorMessage(err.error, fallback);
  }

  // 5. err.message
  if (typeof err.message === 'string') {
    const msg = err.message.trim();
    if (msg && msg !== '[object Object]' && msg !== 'null' && msg !== 'undefined') {
      if (msg.startsWith('{') && msg.endsWith('}')) {
        try {
          const parsed = JSON.parse(msg);
          return extractErrorMessage(parsed, fallback);
        } catch {}
      }
      return msg;
    }
  }

  // 6. err.statusText
  if (typeof err.statusText === 'string' && err.statusText) {
    return `Server error: ${err.statusText}`;
  }

  return fallback;
}

function notifyStoreUpdated(entity = 'store'): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('yem:store-updated', { detail: { entity, timestamp: Date.now() } }));
    } catch {}
  }
}

export const api = {
  // Admin Authentication
  async loginAdmin(password: string, role = 'owner'): Promise<{ token: string; role: string; actorName: string }> {
    const cleanPassword = (password || '').trim();
    const cleanRole = role || 'owner';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ password: cleanPassword, role: cleanRole }),
      });

      if (res.ok) {
        const data = await res.json();
        currentAdminToken = data.token;
        safeSetStorage('yem_admin_token', data.token);
        safeSetStorage('yem_admin_role', data.role || cleanRole);
        return data;
      }

      // If server returned non-200 with an error JSON, extract it
      let errPayload: any = null;
      try {
        errPayload = await res.json();
      } catch {
        try {
          const text = await res.text();
          if (text) errPayload = { error: text };
        } catch {}
      }

      const defaultMsg = res.status === 401
        ? 'Invalid admin passkey or unauthorized role. Please check your credentials.'
        : res.status === 429
          ? 'Too many login attempts. Please wait a moment and try again.'
          : `Authentication failed (Status ${res.status}).`;

      const cleanMessage = extractErrorMessage(errPayload, defaultMsg);
      throw new Error(cleanMessage);
    } catch (networkErr: any) {
      if (networkErr instanceof Error && networkErr.message && networkErr.message !== '[object Object]') {
        throw networkErr;
      }
      const msg = extractErrorMessage(
        networkErr,
        'Authentication failed. Please verify your admin passkey and network connection.'
      );
      throw new Error(msg);
    }
  },

  async logoutAdmin(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAdminHeaders(),
        credentials: 'same-origin',
      });
    } catch {}
    currentAdminToken = '';
    safeRemoveStorage('yem_admin_token');
    safeRemoveStorage('yem_admin_role');
  },

  async checkAdminAuth(): Promise<{ authenticated: boolean; role?: string; actorName?: string }> {
    const token = currentAdminToken || safeGetStorage('yem_admin_token');
    if (!token) return { authenticated: false };

    try {
      const res = await fetch('/api/admin/me', {
        headers: getAdminHeaders(),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        currentAdminToken = '';
        safeRemoveStorage('yem_admin_token');
        safeRemoveStorage('yem_admin_role');
        return { authenticated: false };
      }
      const data = await res.json();
      if (data && data.authenticated && data.role) {
        currentAdminToken = token;
        safeSetStorage('yem_admin_role', data.role);
        return data;
      }
      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  },

  hasStoredAdminToken(): boolean {
    return Boolean(currentAdminToken || safeGetStorage('yem_admin_token'));
  },

  // Products
  async getProducts(params?: { category?: string; status?: string; search?: string; fresh?: boolean }): Promise<Product[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.fresh) q.set('fresh', 'true');

    const res = await fetch(`/api/products?${q.toString()}`, {
      headers: getAdminHeaders(),
      credentials: 'same-origin',
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
      credentials: 'same-origin',
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save product');
    }
    const saved = await res.json();
    notifyStoreUpdated('product');
    return saved;
  },

  async deleteProduct(id: string, actor = 'Admin'): Promise<void> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete product');
    }
    notifyStoreUpdated('product');
  },

  async bulkImportProducts(rows: any[], actor = 'Admin') {
    const res = await fetch('/api/products/bulk-import', {
      method: 'POST',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to import products');
    }
    const result = await res.json();
    notifyStoreUpdated('product');
    return result;
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
      credentials: 'same-origin',
      body: JSON.stringify({ productId, variantSku, newStock, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to adjust stock');
    }
    const result = await res.json();
    notifyStoreUpdated('stock');
    return result;
  },

  // Settings
  async getSettings(params?: { fresh?: boolean }): Promise<StoreSettings> {
    const q = params?.fresh ? '?fresh=true' : '';
    const res = await fetch(`/api/settings${q}`, {
      credentials: 'same-origin',
    });
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
      credentials: 'same-origin',
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update settings');
    }
    const updated = await res.json();
    notifyStoreUpdated('settings');
    return updated;
  },

  // Re-hydration
  async rehydrateStore(): Promise<{ success: boolean; lastHydratedAt: number; productsCount: number }> {
    const res = await fetch('/api/store/rehydrate', {
      method: 'POST',
      headers: getAdminHeaders(),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({ success: false, lastHydratedAt: Date.now(), productsCount: 0 }));
    notifyStoreUpdated('all');
    return data;
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const res = await fetch('/api/coupons', {
      headers: getAdminHeaders(),
      credentials: 'same-origin',
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
      credentials: 'same-origin',
      body: JSON.stringify(coupon),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save coupon');
    }
    const saved = await res.json();
    notifyStoreUpdated('coupon');
    return saved;
  },

  async deleteCoupon(id: string, actor = 'Admin'): Promise<void> {
    const res = await fetch(`/api/coupons/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeaders(),
        'x-admin-actor': actor,
      },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete coupon');
    }
    notifyStoreUpdated('coupon');
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

