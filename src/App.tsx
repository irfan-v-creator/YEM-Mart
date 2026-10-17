/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  HeroCarousel 
} from './components/HeroCarousel';
import { 
  CategoryGrid 
} from './components/CategoryGrid';
import { 
  ProductCard 
} from './components/ProductCard';
import { 
  ProductDetailModal 
} from './components/ProductDetailModal';
import { 
  CartDrawer 
} from './components/CartDrawer';
import { 
  CheckoutModal 
} from './components/CheckoutModal';
import { 
  OrderTrackingModal 
} from './components/OrderTrackingModal';
import { 
  MyOrdersModal 
} from './components/MyOrdersModal';
import { 
  WishlistDrawer 
} from './components/WishlistDrawer';
import { 
  GeminiChatbot 
} from './components/GeminiChatbot';
import { 
  AdminPanel 
} from './components/AdminPanel';
import {
  AdminAuthModal
} from './components/AdminAuthModal';
import { 
  Footer 
} from './components/Footer';
import { 
  SeoStructuredData 
} from './components/SeoStructuredData';

import { 
  Product, 
  ProductVariant, 
  CartItem, 
  Order, 
  StoreSettings, 
  Category, 
  OrderStatus,
  Coupon,
  AuditLog,
  StockAdjustmentLog
} from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SETTINGS, 
  INITIAL_BANNERS, 
  INITIAL_ORDERS,
  INITIAL_COUPONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STOCK_LOGS
} from './data/initialData';
import { formatCurrency } from './utils/formatters';
import { api } from './utils/api';
import { categoryToSlug, slugToCategory } from './utils/seo';

import { 
  Sparkles, 
  ShoppingBag, 
  Heart, 
  Home, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Truck, 
  MessageCircle, 
  PackageCheck,
  Check,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronDown,
  Package
} from 'lucide-react';

export default function App() {
  // Persistence state
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('yem_mart_products');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  // Orders, audit logs, and stock logs are protected administrative datasets
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stockLogs, setStockLogs] = useState<StockAdjustmentLog[]>([]);

  const parseRouteFromLocation = useCallback(() => {
    if (typeof window === 'undefined') return { type: 'home' as const };
    const path = window.location.pathname;
    if (path.toLowerCase() === '/admin' || path.toLowerCase() === '/admin/') {
      return { type: 'admin' as const };
    }
    const prodMatch = path.match(/^\/product\/([^/?#]+)/i);
    if (prodMatch) {
      return { type: 'product' as const, idOrSlug: decodeURIComponent(prodMatch[1]) };
    }
    const catMatch = path.match(/^\/category\/([^/?#]+)/i);
    if (catMatch) {
      return { type: 'category' as const, idOrSlug: decodeURIComponent(catMatch[1]) };
    }
    return { type: 'home' as const };
  }, []);

  const checkIsAdminPath = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    return path === '/admin' || path === '/admin/';
  }, []);

  // Admin routing & authentication state
  const [isAdminPath, setIsAdminPath] = useState<boolean>(checkIsAdminPath);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => api.hasStoredAdminToken());
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem('yem_mart_settings');
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('yem_mart_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('yem_mart_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Coupons on cart
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);

  // Track if there's a pending product to open once store products finish loading
  const [pendingProductId, setPendingProductId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/product\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  });

  // Synchronize storefront products and settings fresh from Supabase
  const refreshStoreData = useCallback(async (isFresh = true) => {
    try {
      const [prodList, setList] = await Promise.all([
        api.getProducts({ fresh: isFresh }),
        api.getSettings({ fresh: isFresh }),
      ]);
      setProducts(prodList);
      setSettings(setList);
      try {
        localStorage.setItem('yem_mart_products', JSON.stringify(prodList));
        localStorage.setItem('yem_mart_settings', JSON.stringify(setList));
      } catch {}
    } catch (err) {
      console.warn('Store refresh notice:', err);
    }
  }, []);

  // Sync with server on initial mount, window focus, route changes, & admin auth
  useEffect(() => {
    // 1. Fetch fresh products and store settings from Supabase
    refreshStoreData(true);

    const onAdmin = checkIsAdminPath();
    if (api.hasStoredAdminToken()) {
      api.checkAdminAuth().then((res) => {
        if (res.authenticated) {
          setIsAdminAuthenticated(true);
          loadAdminData();
          if (onAdmin) {
            setIsAdminOpen(true);
          }
        } else {
          setIsAdminAuthenticated(false);
          if (onAdmin) {
            setIsAdminOpen(false);
            setIsAdminAuthModalOpen(true);
          }
        }
      });
    } else if (onAdmin) {
      setIsAdminAuthenticated(false);
      setIsAdminOpen(false);
      setIsAdminAuthModalOpen(true);
    }

    // 2. Auto-refetch when user returns to tab / window regains focus
    const handleFocus = () => {
      refreshStoreData(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStoreData(true);
      }
    };

    // 3. Inter-component store update broadcast
    const handleStoreUpdated = () => {
      refreshStoreData(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('yem:store-updated', handleStoreUpdated);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('yem:store-updated', handleStoreUpdated);
    };
  }, [refreshStoreData]);

  // Synchronize route and auth state
  useEffect(() => {
    if (isAdminPath) {
      if (isAdminAuthenticated) {
        loadAdminData();
        setIsAdminOpen(true);
      } else {
        setIsAdminOpen(false);
        setIsAdminAuthModalOpen(true);
      }
    } else {
      setIsAdminOpen(false);
      setIsAdminAuthModalOpen(false);
    }
  }, [isAdminPath, isAdminAuthenticated]);

  // Save to localStorage on state changes as offline backup
  useEffect(() => {
    localStorage.setItem('yem_mart_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('yem_mart_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('yem_mart_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('yem_mart_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Filtering & Catalog State (initialized from /category/:slug URL if present)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>(() => {
    if (typeof window === 'undefined') return 'All';
    const match = window.location.pathname.match(/^\/category\/([^/?#]+)/i);
    if (match) {
      return slugToCategory(decodeURIComponent(match[1]));
    }
    return 'All';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(3500);

  // Pagination for catalog (Requirement 2: Show 24 products initially and provide Load More)
  const [visibleCount, setVisibleCount] = useState<number>(24);

  useEffect(() => {
    setVisibleCount(24);
  }, [selectedCategory, searchQuery, sortBy, inStockOnly]);

  // Modals and Drawers (initialized from /product/:id URL if pre-cached)
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/product\/([^/?#]+)/i);
    if (match) {
      const targetId = decodeURIComponent(match[1]);
      try {
        const saved = localStorage.getItem('yem_mart_products');
        const list: Product[] = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
        return list.find((p) => p.id === targetId) || null;
      } catch {
        return INITIAL_PRODUCTS.find((p) => p.id === targetId) || null;
      }
    }
    return null;
  });

  // Keep active product modal in sync when products state refreshes
  useEffect(() => {
    if (activeProductModal) {
      const current = products.find((p) => p.id === activeProductModal.id);
      if (current && JSON.stringify(current) !== JSON.stringify(activeProductModal)) {
        setActiveProductModal(current);
      }
    }
  }, [products]);

  // Resolve pending product route once products finish loading
  useEffect(() => {
    if (pendingProductId && products.length > 0) {
      const match = products.find((p) => p.id === pendingProductId);
      if (match) {
        setActiveProductModal(match);
        setPendingProductId(null);
      }
    }
  }, [pendingProductId, products]);

  // Listen for browser navigation (back / forward) to keep view & URL synchronized natively
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromLocation();
      if (route.type === 'admin') {
        setIsAdminPath(true);
        setActiveProductModal(null);
      } else {
        setIsAdminPath(false);
        if (route.type === 'product' && route.idOrSlug) {
          const match = products.find((p) => p.id === route.idOrSlug);
          if (match) {
            setActiveProductModal(match);
          } else {
            setPendingProductId(route.idOrSlug);
          }
        } else {
          setActiveProductModal(null);
          if (route.type === 'category' && route.idOrSlug) {
            setSelectedCategory(slugToCategory(route.idOrSlug));
          } else if (route.type === 'home') {
            setSelectedCategory('All');
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseRouteFromLocation, products]);

  // Native Browser URL Routing Action Handlers for SEO & Social Sharing
  const handleOpenProduct = useCallback((product: Product, pushHistory = true) => {
    setActiveProductModal(product);
    if (pushHistory && typeof window !== 'undefined') {
      const newPath = `/product/${product.id}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({ type: 'product', id: product.id }, '', newPath);
      }
    }
  }, []);

  const handleCloseProduct = useCallback((updateUrl = true) => {
    setActiveProductModal(null);
    if (updateUrl && typeof window !== 'undefined') {
      const targetPath = selectedCategory !== 'All' 
        ? `/category/${categoryToSlug(selectedCategory)}` 
        : '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ type: selectedCategory !== 'All' ? 'category' : 'home' }, '', targetPath);
      }
    }
  }, [selectedCategory]);

  const handleSelectCategory = useCallback((cat: Category | 'All', pushHistory = true) => {
    setSelectedCategory(cat);
    setActiveProductModal(null);
    if (pushHistory && typeof window !== 'undefined') {
      const targetPath = cat !== 'All' ? `/category/${categoryToSlug(cat)}` : '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ type: cat !== 'All' ? 'category' : 'home', category: cat }, '', targetPath);
      }
    }
  }, []);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [directCheckoutItem, setDirectCheckoutItem] = useState<CartItem | null>(null);
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingInitialId, setTrackingInitialId] = useState('');
  const [trackingInitialPhone, setTrackingInitialPhone] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState('');
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Toast notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const shopSectionRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const scrollToShop = () => {
    shopSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cart Calculations
  const cartCount = useMemo(() => cart.reduce((acc, i) => acc + i.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, i) => acc + i.price * i.quantity, 0), [cart]);

  // Re-validate coupon when cart changes
  useEffect(() => {
    if (appliedCoupon && cart.length > 0) {
      api.validateCart(
        cart.map(c => ({
          productId: c.productId,
          variantSku: c.variant?.sku,
          quantity: c.quantity
        })),
        appliedCoupon.code
      ).then(res => {
        if (res.isValid && res.coupon) {
          setCouponDiscount(res.discountAmount || 0);
        } else {
          setAppliedCoupon(null);
          setCouponDiscount(0);
        }
      }).catch(() => {});
    } else if (cart.length === 0) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
    }
  }, [cart]);

  const handleApplyCoupon = async (code: string) => {
    try {
      const res = await api.validateCart(
        cart.map(c => ({
          productId: c.productId,
          variantSku: c.variant?.sku,
          quantity: c.quantity
        })),
        code
      );
      if (res.isValid && res.coupon) {
        setAppliedCoupon(res.coupon);
        setCouponDiscount(res.discountAmount || 0);
        showToast(`Coupon "${res.coupon.code}" applied: ₹${res.discountAmount} OFF!`);
        return { success: true };
      } else {
        return { success: false, error: res.errors?.join(' ') || 'Coupon not applicable for this order.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error validating coupon.' };
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    showToast('Coupon removed');
  };

  // Add to Cart
  const handleAddToCartWithVariant = (
    product: Product,
    variant?: ProductVariant,
    quantity = 1
  ) => {
    const itemId = variant ? `${product.id}-${variant.id}` : product.id;
    const price = variant ? variant.price : product.price;
    const availableStock = variant ? variant.stock : product.stock;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((i) => i.id === itemId);
      if (existingIndex >= 0) {
        const currentQty = prevCart[existingIndex].quantity;
        const newQty = Math.min(availableStock, currentQty + quantity);
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        return updated;
      } else {
        const newItem: CartItem = {
          id: itemId,
          productId: product.id,
          product,
          variant,
          quantity: Math.min(availableStock, quantity),
          price,
        };
        return [...prevCart, newItem];
      }
    });

    showToast(`Added "${product.name}" to Cart`);
  };

  const handleSimpleAddToCart = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      handleOpenProduct(product);
    } else {
      handleAddToCartWithVariant(product, undefined, 1);
    }
  };

  const handleDirectBuy = (product: Product, variant?: ProductVariant, quantity = 1) => {
    const itemId = variant ? `${product.id}-${variant.id}` : product.id;
    const price = variant ? variant.price : product.price;
    const availableStock = variant ? variant.stock : product.stock;
    const directItem: CartItem = {
      id: itemId,
      productId: product.id,
      product,
      variant,
      quantity: Math.min(availableStock, Math.max(1, quantity)),
      price,
    };
    setDirectCheckoutItem(directItem);
    handleCloseProduct(false);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  // Cart quantity controls
  const handleUpdateCartQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const maxStock = item.variant ? item.variant.stock : item.product.stock;
          return {
            ...item,
            quantity: Math.min(maxStock, newQty),
          };
        }
        return item;
      })
    );
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleMoveToWishlist = (item: CartItem) => {
    handleRemoveCartItem(item.id);
    handleToggleWishlist(item.product);
    showToast(`Saved "${item.product.name}" to Wishlist`);
  };

  // Wishlist toggle
  const handleToggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  // Order created callback
  const handleOrderCreated = (order: Order) => {
    // Refresh products and orders from server to ensure perfect sync
    api.getProducts().then(setProducts).catch(() => {
      // Local fallback
      setProducts((prev) =>
        prev.map((p) => {
          const line = order.items.find((it) => it.productId === p.id);
          if (!line) return p;
          return { ...p, stock: Math.max(0, p.stock - line.quantity) };
        })
      );
    });

    setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    
    // Persist order in customer's personal device history for My Orders
    try {
      const saved = JSON.parse(localStorage.getItem('yem_mart_my_orders') || '[]');
      const updated = [order, ...saved.filter((o: any) => o.id !== order.id)].slice(0, 30);
      localStorage.setItem('yem_mart_my_orders', JSON.stringify(updated));
      if (order.customer?.phone) {
        localStorage.setItem('yem_mart_customer_phone', order.customer.phone);
      }
    } catch {}

    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  // Cancellation and idempotent stock restoration
  const handleRequestCancellation = async (orderId: string, reason: string) => {
    try {
      await api.updateOrderStatus(orderId, 'cancelled', reason, 'Customer Request');
      // Refresh state from server
      const updatedOrders = await api.getOrders();
      const updatedProducts = await api.getProducts();
      setOrders(updatedOrders);
      setProducts(updatedProducts);
      showToast(`Order #${orderId} cancelled & stock restored`);
    } catch {
      // Local fallback
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder || targetOrder.status === 'cancelled') return;

      setProducts((prev) =>
        prev.map((p) => {
          const line = targetOrder.items.find((it) => it.productId === p.id);
          if (!line) return p;
          return { ...p, stock: p.stock + line.quantity };
        })
      );

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled', cancellationReason: reason } : o))
      );
      showToast(`Order #${orderId} cancelled`);
    }
  };

  // Admin handlers
  const handleAdminUpdateProduct = async (prod: Product) => {
    try {
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)));
      const saved = await api.saveProduct(prod, 'Admin');
      setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      await refreshStoreData(true);
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Product saved: ${saved.name}`);
    } catch (err: any) {
      alert(err.message || 'Error saving product');
    }
  };

  const handleAdminAddProduct = async (prod: Product) => {
    try {
      setProducts((prev) => [prod, ...prev]);
      const saved = await api.saveProduct(prod, 'Admin');
      setProducts((prev) => [saved, ...prev.filter((p) => p.id !== prod.id && p.id !== saved.id)]);
      await refreshStoreData(true);
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Product created: ${saved.name}`);
    } catch (err: any) {
      alert(err.message || 'Error creating product');
    }
  };

  const handleAdminDeleteProduct = async (id: string) => {
    try {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await api.deleteProduct(id, 'Admin');
      await refreshStoreData(true);
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Product removed`);
    } catch (err: any) {
      alert(err.message || 'Error deleting product');
    }
  };

  const handleAdminBulkImport = async (rows: any[]) => {
    const res = await api.bulkImportProducts(rows, 'Admin');
    await refreshStoreData(true);
    api.getAuditLogs().then(setAuditLogs).catch(() => {});
    return res;
  };

  const handleAdminUpdateOrderStatus = async (orderId: string, status: OrderStatus, note?: string) => {
    try {
      await api.updateOrderStatus(orderId, status, note, 'Admin');
      const updatedOrders = await api.getOrders();
      setOrders(updatedOrders);
      if (status === 'cancelled') {
        refreshStoreData(true);
      }
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Order #${orderId} status set to ${status}`);
    } catch (err: any) {
      alert(err.message || 'Error updating order');
    }
  };

  const handleAdminVerifyPayment = async (orderId: string) => {
    try {
      await api.verifyPayment(orderId, 'Admin');
      const updatedOrders = await api.getOrders();
      setOrders(updatedOrders);
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Verified UPI Payment for Order #${orderId}`);
    } catch (err: any) {
      alert(err.message || 'Error verifying payment');
    }
  };

  const handleAdminUpdateStock = async (productId: string, variantSku: string | undefined, newStock: number, reason?: string) => {
    try {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          if (variantSku && p.variants) {
            const vUpdated = p.variants.map((v) => (v.sku === variantSku ? { ...v, stock: newStock } : v));
            const totalStock = vUpdated.reduce((acc, v) => acc + v.stock, 0);
            return { ...p, stock: totalStock, variants: vUpdated };
          }
          return { ...p, stock: newStock };
        })
      );
      await api.adjustStock(productId, variantSku, newStock, reason || 'Manual Admin adjustment', 'Admin');
      await refreshStoreData(true);
      api.getStockLogs().then(setStockLogs).catch(() => {});
      showToast(`Stock updated to ${newStock}`);
    } catch (err: any) {
      alert(err.message || 'Error adjusting stock');
    }
  };

  const handleAdminUpdateSettings = async (newSettings: StoreSettings) => {
    try {
      setSettings(newSettings);
      const updated = await api.updateSettings(newSettings, 'Admin');
      setSettings(updated);
      await refreshStoreData(true);
      api.getAuditLogs().then(setAuditLogs).catch(() => {});
      showToast(`Store settings updated`);
    } catch (err: any) {
      alert(err.message || 'Error updating settings');
    }
  };

  const handleAdminSaveCoupon = async (coupon: Coupon) => {
    try {
      const saved = await api.saveCoupon(coupon, 'Admin');
      setCoupons((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = saved;
          return arr;
        }
        return [saved, ...prev];
      });
      showToast(`Coupon "${saved.code}" saved`);
    } catch (err: any) {
      alert(err.message || 'Error saving coupon');
    }
  };

  const handleAdminDeleteCoupon = async (id: string) => {
    try {
      await api.deleteCoupon(id, 'Admin');
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      showToast(`Coupon deleted`);
    } catch (err: any) {
      alert(err.message || 'Error deleting coupon');
    }
  };

  // Synchronize protected admin datasets once authenticated
  const loadAdminData = async () => {
    try {
      const [ordList, cpnList, audList, stkList, prodList] = await Promise.all([
        api.getOrders(),
        api.getCoupons(),
        api.getAuditLogs(),
        api.getStockLogs(),
        api.getProducts({ fresh: true }),
      ]);
      setOrders(ordList);
      setCoupons(cpnList);
      setAuditLogs(audList);
      setStockLogs(stkList);
      setProducts(prodList);
    } catch (err: any) {
      console.error('Failed to load admin datasets:', err);
    }
  };

  const handleCloseAdmin = () => {
    setIsAdminOpen(false);
    setIsAdminPath(false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    refreshStoreData(true);
  };

  const handleCloseAdminAuthModal = () => {
    setIsAdminAuthModalOpen(false);
    // If user cancelled login challenge while visiting /admin, return safely to storefront
    if (checkIsAdminPath() && !isAdminAuthenticated) {
      window.history.pushState({}, '', '/');
      setIsAdminPath(false);
      setIsAdminOpen(false);
    }
  };

  const handleAdminAuthSuccess = (role: string) => {
    setIsAdminAuthenticated(true);
    setIsAdminAuthModalOpen(false);
    loadAdminData();
    setIsAdminOpen(true);
    setIsAdminPath(true);
    if (typeof window !== 'undefined' && !checkIsAdminPath()) {
      window.history.pushState({}, '', '/admin');
    }
    showToast(`Signed in as ${role}`);
  };

  const handleAdminLogout = async () => {
    await api.logoutAdmin();
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
    setIsAdminPath(false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setOrders([]);
    setAuditLogs([]);
    setStockLogs([]);
    api.getProducts().then(setProducts).catch(() => {});
    showToast('Admin logged out successfully');
  };

  // Filtered and Sorted Products List for Catalogue
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (p.status !== 'published') return false;
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (inStockOnly && p.stock <= 0) return false;
        if (p.price > maxPriceFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchCat = p.category.toLowerCase().includes(q);
          const matchBrand = p.brand.toLowerCase().includes(q);
          const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchCat && !matchBrand && !matchTags) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
        }
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'discount') {
          return (b.discountPercent || 0) - (a.discountPercent || 0);
        }
        if (sortBy === 'popular') {
          return (b.rating || 0) - (a.rating || 0);
        }
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy, inStockOnly, maxPriceFilter]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Curated lists for Homepage
  const featuredProducts = useMemo(() => products.filter((p) => p.isFeatured && p.status === 'published'), [products]);
  const bestDealProducts = useMemo(() => products.filter((p) => p.isBestDeal && p.status === 'published'), [products]);
  const newArrivalProducts = useMemo(() => products.filter((p) => p.isNewArrival && p.status === 'published'), [products]);

  // Render Admin Operations Console strictly when authenticated and active
  if (isAdminOpen && isAdminAuthenticated) {
    return (
      <AdminPanel
        products={products}
        orders={orders}
        settings={settings}
        coupons={coupons}
        auditLogs={auditLogs}
        stockLogs={stockLogs}
        onUpdateProduct={handleAdminUpdateProduct}
        onAddProduct={handleAdminAddProduct}
        onDeleteProduct={handleAdminDeleteProduct}
        onBulkImport={handleAdminBulkImport}
        onUpdateOrderStatus={handleAdminUpdateOrderStatus}
        onVerifyPayment={handleAdminVerifyPayment}
        onUpdateStock={handleAdminUpdateStock}
        onUpdateSettings={handleAdminUpdateSettings}
        onSaveCoupon={handleAdminSaveCoupon}
        onDeleteCoupon={handleAdminDeleteCoupon}
        onCloseAdmin={handleCloseAdmin}
        onLogout={handleAdminLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#171717] flex flex-col selection:bg-[#C9A44C] selection:text-white">
      {/* Schema.org Structured Data & Dynamic SEO */}
      <SeoStructuredData
        settings={settings}
        selectedCategory={selectedCategory}
        activeProduct={activeProductModal}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#171717] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold border border-[#C9A44C]/40 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-[#C9A44C]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header with Search, Navigation & Tools */}
      <Header
        settings={settings}
        products={products}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenProduct={(prod) => handleOpenProduct(prod)}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        wishlistCount={wishlist.length}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenChat={() => {
          setChatInitialQuery('');
          setIsChatOpen(true);
        }}
        onOpenTracking={() => {
          setIsMyOrdersOpen(true);
        }}
        onScrollToShop={scrollToShop}
      />

      <main className="flex-1 pb-16">
        {/* 2. Compact Hero Promotional Carousel */}
        <HeroCarousel
          banners={INITIAL_BANNERS}
          onSelectCategory={(cat) => {
            handleSelectCategory(cat);
            scrollToShop();
          }}
          onOpenChat={() => {
            setChatInitialQuery('What are the best deals today at YEM MART?');
            setIsChatOpen(true);
          }}
        />

        {/* 3. Shop by Category Grid */}
        <CategoryGrid
          products={products}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            handleSelectCategory(cat);
            scrollToShop();
          }}
        />

        {/* 4. Featured Collections Showcase */}
        {featuredProducts.length > 0 && selectedCategory === 'All' && !searchQuery && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C9A44C]">
                  Curated Picks
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717] tracking-tight">
                  Featured Products
                </h2>
              </div>
              <button
                onClick={scrollToShop}
                className="text-xs sm:text-sm font-semibold text-neutral-600 hover:text-[#C9A44C] flex items-center gap-1 transition-colors"
              >
                <span>View Full Shop</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredProducts.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lowStockThreshold={settings.lowStockThreshold}
                  isWishlisted={wishlist.some((w) => w.id === product.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onOpenProduct={(p) => handleOpenProduct(p)}
                  onAddToCart={handleSimpleAddToCart}
                />
              ))}
            </div>
          </section>
        )}

        {/* 5. Best Deals Section */}
        {bestDealProducts.length > 0 && selectedCategory === 'All' && !searchQuery && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-amber-50/50 rounded-3xl my-6 border border-[#C9A44C]/20">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Value Offers
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717] tracking-tight">
                  Best Deals Across Kerala
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Verified authentic discounts with transparent original prices
                </p>
              </div>
              <button
                onClick={() => {
                  setSortBy('discount');
                  scrollToShop();
                }}
                className="text-xs sm:text-sm font-semibold text-neutral-700 hover:text-[#C9A44C] flex items-center gap-1 transition-colors"
              >
                <span>All Deals</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bestDealProducts.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lowStockThreshold={settings.lowStockThreshold}
                  isWishlisted={wishlist.some((w) => w.id === product.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onOpenProduct={(p) => handleOpenProduct(p)}
                  onAddToCart={handleSimpleAddToCart}
                />
              ))}
            </div>
          </section>
        )}

        {/* 6. Complete Shop & Catalogue Section with 24 initial products & Load More */}
        <section ref={shopSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E7E5E0]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#171717] tracking-tight">
                  {selectedCategory === 'All' ? 'All Products Catalogue' : `${selectedCategory} Collection`}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#171717] text-white font-bold">
                  {filteredProducts.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Showing authentic items available for express Kerala delivery
              </p>
            </div>

            {/* Filter & Sorting Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* In Stock Filter Toggle */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E7E5E0] text-xs font-semibold text-neutral-700 cursor-pointer hover:border-neutral-400">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded text-[#C9A44C] focus:ring-0"
                />
                <span>In Stock Only</span>
              </label>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E7E5E0] text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-500 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-bold text-[#171717] outline-none cursor-pointer"
                >
                  <option value="recommended">Recommended</option>
                  <option value="newest">New Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="discount">Highest Discount</option>
                  <option value="popular">Top Rated</option>
                </select>
              </div>

              {/* Reset Filters button if applied */}
              {(selectedCategory !== 'All' || searchQuery || inStockOnly) && (
                <button
                  onClick={() => {
                    handleSelectCategory('All');
                    setSearchQuery('');
                    setInStockOnly(false);
                  }}
                  className="text-xs text-neutral-500 hover:text-black underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Product Grid */}
          {displayedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lowStockThreshold={settings.lowStockThreshold}
                    isWishlisted={wishlist.some((w) => w.id === product.id)}
                    onToggleWishlist={handleToggleWishlist}
                    onOpenProduct={(p) => handleOpenProduct(p)}
                    onAddToCart={handleSimpleAddToCart}
                  />
                ))}
              </div>

              {/* Requirement 2: Show 24 products initially and provide Load More */}
              {filteredProducts.length > visibleCount && (
                <div className="mt-10 flex flex-col items-center justify-center gap-2">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                    className="px-8 py-3.5 rounded-2xl bg-white border border-[#E7E5E0] hover:border-black text-xs sm:text-sm font-extrabold text-[#171717] transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <span>Load More Products</span>
                    <ChevronDown className="w-4 h-4 text-[#C9A44C]" />
                  </button>
                  <p className="text-[11px] text-neutral-400">
                    Showing {visibleCount} of {filteredProducts.length} items
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center bg-white rounded-3xl border border-[#E7E5E0] p-8">
              <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#171717]">No products found</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                No items match your active search or filters. Try clearing your filters or search for another keyword.
              </p>
              <button
                onClick={() => {
                  handleSelectCategory('All');
                  setSearchQuery('');
                  setInStockOnly(false);
                }}
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </section>

        {/* 7. WhatsApp Direct Ordering Explainer & CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gradient-to-br from-[#171717] to-neutral-900 rounded-3xl p-6 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-neutral-800">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Quick WhatsApp Ordering Process</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                How Ordering on YEM MART Works
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                1. Browse and add items to your cart.<br />
                2. Enter your Kerala delivery address to generate an official <strong>Order ID</strong>.<br />
                3. The site formats your complete itemized message for WhatsApp.<br />
                4. Press Send on WhatsApp & submit your UPI reference for rapid verification!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                onClick={scrollToShop}
                className="px-6 py-3.5 rounded-xl bg-[#C9A44C] text-[#171717] font-black text-sm hover:bg-[#d8b55e] transition-all shadow-md active:scale-95"
              >
                Start Ordering Now
              </button>
              <button
                onClick={() => {
                  setTrackingInitialId('');
                  setTrackingInitialPhone('');
                  setIsTrackingOpen(true);
                }}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all flex items-center justify-center gap-2"
              >
                <PackageCheck className="w-4 h-4" />
                <span>Track Existing Order</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Gemini AI Concierge Trigger */}
      <button
        onClick={() => {
          setChatInitialQuery('');
          setIsChatOpen(true);
        }}
        className="fixed bottom-20 sm:bottom-6 right-5 z-40 px-4 py-3 rounded-2xl bg-[#171717] text-white shadow-2xl border border-[#C9A44C]/50 hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center gap-2.5 active:scale-95 group"
        title="Chat with YEM Concierge (Google Search Grounding enabled)"
      >
        <div className="w-6 h-6 rounded-lg bg-[#C9A44C] text-[#171717] flex items-center justify-center font-bold text-xs group-hover:bg-[#171717] group-hover:text-[#C9A44C]">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold leading-none">YEM Concierge</p>
          <p className="text-[10px] text-neutral-400 group-hover:text-neutral-800">Malayalam & English</p>
        </div>
      </button>

      {/* Mobile Sticky Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E5E0] px-3 py-2 flex items-center justify-around text-neutral-600">
        <button
          onClick={() => {
            handleSelectCategory('All');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold hover:text-[#171717]"
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={scrollToShop}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold hover:text-[#171717]"
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Shop</span>
        </button>

        <button
          onClick={() => setIsMyOrdersOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-neutral-600 hover:text-[#171717]"
        >
          <Package className="w-5 h-5 text-[#171717]" />
          <span>My Orders</span>
        </button>

        <button
          onClick={() => setIsWishlistOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold hover:text-[#171717] relative"
        >
          <Heart className="w-5 h-5" />
          <span>Wishlist</span>
          {wishlist.length > 0 && (
            <span className="absolute -top-1 right-2 w-4 h-4 rounded-full bg-[#C9A44C] text-[#171717] text-[9px] font-bold flex items-center justify-center">
              {wishlist.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-[#171717] relative"
        >
          <ShoppingBag className="w-5 h-5 text-[#C9A44C]" />
          <span>Cart</span>
          {cartCount > 0 && (
            <span className="absolute -top-1 right-1 w-4 h-4 rounded-full bg-[#171717] text-white text-[9px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </nav>

      {/* 8. Footer */}
      <Footer
        settings={settings}
        onSelectCategory={(cat) => {
          handleSelectCategory(cat);
          scrollToShop();
        }}
        onOpenTracking={() => {
          setTrackingInitialId('');
          setTrackingInitialPhone('');
          setIsTrackingOpen(true);
        }}
        onOpenWishlist={() => setIsWishlistOpen(true)}
      />

      {/* MODALS & DRAWERS */}
      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={handleCloseAdminAuthModal}
        onSuccess={handleAdminAuthSuccess}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={activeProductModal}
        onClose={() => handleCloseProduct()}
        onAddToCartWithVariant={handleAddToCartWithVariant}
        onDirectBuy={handleDirectBuy}
        isWishlisted={activeProductModal ? wishlist.some((w) => w.id === activeProductModal.id) : false}
        onToggleWishlist={handleToggleWishlist}
        onOpenChatWithQuery={(query) => {
          setChatInitialQuery(query);
          setIsChatOpen(true);
        }}
        whatsappNumber={settings.whatsappNumber}
        upiId={settings.upiId}
      />

      {/* Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        settings={settings}
        appliedCoupon={appliedCoupon}
        couponDiscount={couponDiscount}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onMoveToWishlist={handleMoveToWishlist}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Wishlist Drawer */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlist={wishlist}
        onRemoveFromWishlist={(id) => setWishlist((prev) => prev.filter((p) => p.id !== id))}
        onMoveToCart={(prod) => {
          handleSimpleAddToCart(prod);
          setWishlist((prev) => prev.filter((p) => p.id !== prod.id));
        }}
        onOpenProduct={(prod) => handleOpenProduct(prod)}
      />

      {/* Checkout & WhatsApp Generation Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setDirectCheckoutItem(null);
        }}
        items={directCheckoutItem ? [directCheckoutItem] : cart}
        settings={settings}
        couponCode={appliedCoupon?.code}
        couponDiscount={couponDiscount}
        onOrderCreated={handleOrderCreated}
        onClearCart={() => {
          if (directCheckoutItem) {
            setDirectCheckoutItem(null);
          } else {
            setCart([]);
          }
        }}
        onOpenTrackingWithId={(oid, ph) => {
          setTrackingInitialId(oid);
          setTrackingInitialPhone(ph);
          setIsMyOrdersOpen(true);
        }}
      />

      {/* My Orders & Tracking Modal */}
      <MyOrdersModal
        isOpen={isMyOrdersOpen}
        onClose={() => setIsMyOrdersOpen(false)}
        orders={orders}
        onRequestCancellation={handleRequestCancellation}
        onExploreShop={scrollToShop}
      />

      {/* Order Tracking Modal with 2FA Lookup */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
        orders={orders}
        initialOrderId={trackingInitialId}
        initialPhone={trackingInitialPhone}
        onRequestCancellation={handleRequestCancellation}
      />

      {/* Gemini Chatbot with Google Search Grounding */}
      <GeminiChatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        products={products}
        initialQuery={chatInitialQuery}
        onOpenProductByName={(name) => {
          const match = products.find((p) => p.name.toLowerCase().includes(name.toLowerCase()));
          if (match) handleOpenProduct(match);
        }}
      />
    </div>
  );
}
