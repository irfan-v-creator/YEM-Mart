import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Layers, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  ShieldCheck, 
  TrendingUp, 
  Truck, 
  Clock, 
  DollarSign, 
  QrCode, 
  Save, 
  RotateCcw,
  Eye,
  ArrowRight,
  ChevronRight,
  Filter,
  Download,
  Upload,
  Tag,
  History,
  FileText,
  UserCheck,
  Calendar,
  Lock,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  Product, 
  Order, 
  OrderStatus, 
  PaymentStatus, 
  StoreSettings, 
  Category, 
  ProductVariant,
  Coupon,
  AuditLog,
  StockAdjustmentLog,
  ProductPublicationStatus
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface AdminPanelProps {
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
  coupons?: Coupon[];
  auditLogs?: AuditLog[];
  stockLogs?: StockAdjustmentLog[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onBulkImport?: (rows: any[]) => Promise<any>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  onVerifyPayment: (orderId: string) => void;
  onUpdateStock: (productId: string, variantId: string | undefined, newStock: number, reason?: string) => void;
  onUpdateSettings: (settings: StoreSettings) => void;
  onSaveCoupon?: (coupon: Coupon) => void;
  onDeleteCoupon?: (id: string) => void;
  onCloseAdmin: () => void;
  onLogout?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  orders,
  settings,
  coupons = [],
  auditLogs = [],
  stockLogs = [],
  onUpdateProduct,
  onAddProduct,
  onDeleteProduct,
  onBulkImport,
  onUpdateOrderStatus,
  onVerifyPayment,
  onUpdateStock,
  onUpdateSettings,
  onSaveCoupon,
  onDeleteCoupon,
  onCloseAdmin,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'inventory' | 'coupons' | 'audit' | 'cms'>('dashboard');

  // Granular Role-based access control state
  const [activeRole, setActiveRole] = useState<'owner' | 'manager' | 'fulfillment' | 'support'>('owner');

  // Filter orders
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Selected Order for detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Product editor state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // CSV Import Modal state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvParsedRows, setCsvParsedRows] = useState<any[]>([]);
  const [csvValidationErrors, setCsvValidationErrors] = useState<string[]>([]);
  const [csvImportResult, setCsvImportResult] = useState<string | null>(null);

  // Stock Adjustment History Modal state
  const [isStockHistoryModalOpen, setIsStockHistoryModalOpen] = useState(false);

  // Coupon editor state
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);

  // Settings form state
  const [localSettings, setLocalSettings] = useState<StoreSettings>({ ...settings });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Inventory search
  const [inventorySearch, setInventorySearch] = useState('');

  // Permission checks
  const canManageProducts = activeRole === 'owner' || activeRole === 'manager';
  const canManageInventory = activeRole === 'owner' || activeRole === 'manager';
  const canVerifyPayments = activeRole === 'owner' || activeRole === 'fulfillment';
  const canManageCoupons = activeRole === 'owner' || activeRole === 'manager';
  const canManageSettings = activeRole === 'owner';

  // Compute metrics from actual database records
  const verifiedOrders = orders.filter(o => o.paymentStatus === 'verified' && o.status !== 'cancelled');
  const pendingPaymentOrders = orders.filter(o => o.paymentStatus === 'submitted');
  const pendingWhatsAppOrders = orders.filter(o => o.status === 'whatsapp_pending');
  const totalRevenue = verifiedOrders.reduce((acc, o) => acc + o.grandTotal, 0);
  const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || settings.lowStockThreshold));

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter || o.paymentStatus === orderStatusFilter;
    const matchesSearch = 
      o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customer.fullName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customer.phone.includes(orderSearchQuery) ||
      (o.utrNumber && o.utrNumber.includes(orderSearchQuery));
    return matchesStatus && matchesSearch;
  });

  const handleSaveSettings = () => {
    if (!canManageSettings) {
      alert('Only the Store Owner role can modify global store settings & delivery charges.');
      return;
    }
    onUpdateSettings(localSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // Export products to CSV
  const handleExportProductsCsv = () => {
    const headers = ['ID', 'Name', 'Brand', 'Category', 'Price', 'OriginalPrice', 'Stock', 'SKU', 'Status', 'MainImage'];
    const rows = products.map(p => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.brand}"`,
      p.category,
      p.price,
      p.originalPrice || '',
      p.stock,
      p.sku,
      p.status,
      `"${p.mainImage}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `YEM_MART_Products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export orders to CSV
  const handleExportOrdersCsv = () => {
    const headers = ['OrderID', 'Date', 'CustomerName', 'Phone', 'Pincode', 'District', 'GrandTotal', 'PaymentStatus', 'OrderStatus', 'UTR'];
    const rows = orders.map(o => [
      o.id,
      o.createdAt,
      `"${o.customer.fullName.replace(/"/g, '""')}"`,
      o.customer.phone,
      o.customer.pincode,
      `"${o.customer.district || 'Kerala'}"`,
      o.grandTotal,
      o.paymentStatus,
      o.status,
      o.utrNumber || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `YEM_MART_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV Text into preview rows
  const handleParseCsv = (rawText: string) => {
    setCsvText(rawText);
    const lines = rawText.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      setCsvParsedRows([]);
      setCsvValidationErrors(['CSV must have at least 1 header line and 1 data row.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = parts[idx];
      });

      const rowNum = i;
      if (!obj.name) errors.push(`Row ${rowNum}: Name is missing`);
      if (!obj.category) errors.push(`Row ${rowNum}: Category is missing`);
      if (!obj.price || isNaN(Number(obj.price))) errors.push(`Row ${rowNum}: Valid price is required`);

      rows.push({
        id: obj.id || `prod-csv-${Date.now()}-${i}`,
        name: obj.name || `Unnamed Item ${i}`,
        brand: obj.brand || 'YEM MART',
        category: (obj.category as Category) || 'Others',
        price: Number(obj.price) || 999,
        originalPrice: obj.originalprice ? Number(obj.originalprice) : undefined,
        stock: obj.stock ? Number(obj.stock) : 10,
        sku: obj.sku || `YM-CSV-${Math.floor(100 + Math.random() * 900)}`,
        mainImage: obj.mainimage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
        description: obj.description || '',
        status: (obj.status === 'draft' || obj.status === 'scheduled') ? obj.status : 'published',
      });
    }

    setCsvParsedRows(rows);
    setCsvValidationErrors(errors);
  };

  const handleExecuteCsvImport = async () => {
    if (csvParsedRows.length === 0) return;
    if (onBulkImport) {
      try {
        const res = await onBulkImport(csvParsedRows);
        setCsvImportResult(`Successfully imported ${res.successCount || csvParsedRows.length} products!`);
        setTimeout(() => {
          setIsCsvModalOpen(false);
          setCsvImportResult(null);
          setCsvParsedRows([]);
          setCsvText('');
        }, 1500);
      } catch (err: any) {
        alert(err.message || 'Import failed');
      }
    } else {
      // Local fallback
      csvParsedRows.forEach(row => onAddProduct(row));
      setCsvImportResult(`Imported ${csvParsedRows.length} products to store!`);
      setTimeout(() => {
        setIsCsvModalOpen(false);
        setCsvImportResult(null);
        setCsvParsedRows([]);
        setCsvText('');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#171717] flex flex-col">
      {/* Top Admin Bar */}
      <header className="bg-[#171717] text-white px-6 py-4 border-b border-neutral-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C9A44C] text-[#171717] font-black flex items-center justify-center text-sm shadow-sm">
            YM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">YEM MART Operations Console</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                Kerala Node
              </span>
            </div>
            <p className="text-xs text-neutral-400">Trusted server-validated orders, inventory & promotions</p>
          </div>
        </div>

        {/* Role & Return Actions */}
        <div className="flex items-center gap-3">
          {/* Active Role Selector */}
          <div className="hidden sm:flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-xl text-xs">
            <UserCheck className="w-3.5 h-3.5 text-[#C9A44C]" />
            <span className="text-neutral-400">Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as any)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="owner" className="bg-[#171717]">Owner (Super Admin)</option>
              <option value="manager" className="bg-[#171717]">Store Manager</option>
              <option value="fulfillment" className="bg-[#171717]">Fulfillment & Dispatch</option>
              <option value="support" className="bg-[#171717]">Customer Support</option>
            </select>
          </div>

          <button
            onClick={onCloseAdmin}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <span>Storefront</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
              title="End admin session"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Admin Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-[#E7E5E0] shadow-2xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#C9A44C]" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all relative ${
              activeTab === 'orders'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#C9A44C]" />
            <span>Orders & WhatsApp</span>
            {pendingPaymentOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingPaymentOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'products'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <Package className="w-4 h-4 text-[#C9A44C]" />
            <span>Product Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'inventory'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-4 h-4 text-[#C9A44C]" />
            <span>Inventory</span>
            {lowStockProducts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'coupons'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <Tag className="w-4 h-4 text-[#C9A44C]" />
            <span>Coupons & Offers</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'audit'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <History className="w-4 h-4 text-[#C9A44C]" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('cms')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'cms'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <Settings className="w-4 h-4 text-[#C9A44C]" />
            <span>Store Settings & CMS</span>
          </button>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase">
                  <span>Verified Sales</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-[#171717] mt-2">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">
                  From {verifiedOrders.length} verified UPI bank orders
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase">
                  <span>Awaiting Bank Verification</span>
                  <QrCode className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-blue-600 mt-2">
                  {pendingPaymentOrders.length}
                </p>
                <p className="text-[11px] text-neutral-500 font-medium mt-1">
                  12-digit UTR submitted by customer
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase">
                  <span>Pending WhatsApp Orders</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-600 mt-2">
                  {pendingWhatsAppOrders.length}
                </p>
                <p className="text-[11px] text-neutral-500 font-medium mt-1">
                  Order ID generated, awaiting customer dispatch
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E7E5E0] shadow-xs">
                <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold uppercase">
                  <span>Low Stock Warnings</span>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-black text-red-600 mt-2">
                  {lowStockProducts.length}
                </p>
                <p className="text-[11px] text-neutral-500 font-medium mt-1">
                  Stock ≤ {settings.lowStockThreshold} units
                </p>
              </div>
            </div>

            {/* Quick Action Pending Approvals */}
            {pendingPaymentOrders.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-700" />
                    <h3 className="font-bold text-sm text-blue-950">
                      UPI Payment Approvals Required ({pendingPaymentOrders.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('orders');
                      setOrderStatusFilter('submitted');
                    }}
                    className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-blue-200/60 bg-white rounded-xl border border-blue-100 overflow-hidden">
                  {pendingPaymentOrders.slice(0, 3).map((ord) => (
                    <div key={ord.id} className="p-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#171717]">{ord.id}</span>
                          <span className="text-[11px] text-neutral-500">• {ord.customer.fullName}</span>
                          <span className="text-[11px] text-blue-700 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded">
                            UTR: {ord.utrNumber}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Amount: <strong>{formatCurrency(ord.grandTotal)}</strong> • {ord.customer.district || 'Kerala'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canVerifyPayments && (
                          <button
                            onClick={() => onVerifyPayment(ord.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors"
                          >
                            Verify & Confirm
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-medium hover:bg-neutral-200"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders Overview */}
            <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-[#171717] uppercase tracking-wider">
                  Recent Orders Log
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-[#C9A44C] hover:underline"
                >
                  View Full Orders Table
                </button>
              </div>

              <div className="divide-y divide-[#F7F6F2] overflow-x-auto">
                {orders.slice(0, 5).map((ord) => (
                  <div key={ord.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#171717]">{ord.id}</span>
                        <span className="text-neutral-400">•</span>
                        <span>{ord.customer.fullName}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        {formatDate(ord.createdAt)} • {ord.items.length} items
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#171717]">
                        {formatCurrency(ord.grandTotal)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ord.status === 'confirmed' || ord.status === 'processing'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'shipped'
                          ? 'bg-blue-100 text-blue-800'
                          : ord.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ord.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="p-1 rounded text-neutral-400 hover:text-black"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[#171717]">Orders & WhatsApp Pipeline</h3>
                <p className="text-xs text-neutral-500">
                  Verify UPI payments, update fulfillment states, and review customer delivery addresses
                </p>
              </div>

              {/* Actions & Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportOrdersCsv}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E5E0] hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5"
                  title="Export Orders to CSV file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Search Order ID, Phone, UTR..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E7E5E0] text-xs outline-none focus:border-[#C9A44C]"
                  />
                </div>

                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E5E0] text-xs outline-none bg-white font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="whatsapp_pending">WhatsApp Pending</option>
                  <option value="submitted">UPI Submitted</option>
                  <option value="verified">UPI Verified</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E7E5E0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] text-neutral-600 font-bold uppercase tracking-wider text-[11px] border-b border-[#E7E5E0]">
                  <tr>
                    <th className="p-3">Order ID & Date</th>
                    <th className="p-3">Customer Details</th>
                    <th className="p-3">Items & Total</th>
                    <th className="p-3">Payment & UTR</th>
                    <th className="p-3">Fulfillment Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E0]">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-400">
                        No orders matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-3">
                          <p className="font-extrabold text-[#171717]">{ord.id}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{formatDate(ord.createdAt)}</p>
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-[#171717]">{ord.customer.fullName}</p>
                          <p className="text-[11px] text-neutral-500">{ord.customer.phone}</p>
                          <p className="text-[11px] text-neutral-400 truncate max-w-xs">
                            {ord.customer.district || 'Kerala'} ({ord.customer.pincode})
                          </p>
                        </td>

                        <td className="p-3">
                          <p className="font-bold text-[#171717]">{formatCurrency(ord.grandTotal)}</p>
                          <p className="text-[11px] text-neutral-500">{ord.items.length} items</p>
                        </td>

                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              ord.paymentStatus === 'verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.paymentStatus === 'submitted'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ord.paymentStatus.toUpperCase()}
                            </span>
                            {ord.utrNumber && (
                              <p className="font-mono text-[10px] text-neutral-600">
                                UTR: {ord.utrNumber}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <select
                            value={ord.status}
                            disabled={!canVerifyPayments}
                            onChange={(e) => onUpdateOrderStatus(ord.id, e.target.value as OrderStatus)}
                            className="px-2 py-1 rounded-lg border border-[#E7E5E0] text-xs font-semibold bg-white disabled:opacity-50"
                          >
                            <option value="whatsapp_pending">WhatsApp Pending</option>
                            <option value="payment_submitted">Payment Submitted</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {ord.paymentStatus === 'submitted' && canVerifyPayments && (
                              <button
                                onClick={() => onVerifyPayment(ord.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                                title="Verify UTR and Confirm"
                              >
                                Verify UTR
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="p-1.5 rounded text-neutral-500 hover:text-black hover:bg-neutral-100"
                              title="Full Order Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTS CATALOG */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[#171717]">Product Catalog Management</h3>
                <p className="text-xs text-neutral-500">
                  Manage pricing, genuine specs, variant SKUs, CSV imports, and publication status
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportProductsCsv}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E5E0] hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                {canManageProducts && (
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-[#E7E5E0] hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import CSV</span>
                  </button>
                )}

                {canManageProducts && (
                  <button
                    onClick={() => {
                      const newEmptyProd: Product = {
                        id: `prod-${Date.now()}`,
                        name: '',
                        brand: 'YEM MART',
                        category: 'Fashion',
                        shortSummary: '',
                        description: '',
                        highlights: ['100% Genuine Quality Guarantee'],
                        specs: {},
                        price: 999,
                        originalPrice: 1299,
                        discountPercent: 23,
                        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'],
                        mainImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
                        status: 'published',
                        stock: 10,
                        lowStockThreshold: 3,
                        sku: `YM-FSH-${Math.floor(100 + Math.random() * 900)}`,
                        tags: ['new'],
                        variants: [],
                      };
                      setEditingProduct(newEmptyProd);
                      setIsAddProductOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Product</span>
                  </button>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className="p-4 rounded-xl border border-[#E7E5E0] bg-[#F7F6F2] flex flex-col justify-between"
                >
                  <div className="flex gap-3">
                    <img
                      src={prod.mainImage}
                      alt={prod.name}
                      className="w-16 h-16 rounded-lg object-contain bg-white p-1 border border-neutral-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">{prod.category}</span>
                        <span className={`text-[10px] font-bold px-1.5 rounded ${
                          prod.status === 'published' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : prod.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}>
                          {prod.status.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#171717] truncate mt-0.5">{prod.name}</h4>
                      <p className="text-xs font-extrabold text-[#171717] mt-1">{formatCurrency(prod.price)}</p>
                      <p className="text-[11px] text-neutral-500">Stock: {prod.stock} units • SKU: {prod.sku}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#E7E5E0] flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {prod.isFeatured && (
                        <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">Featured</span>
                      )}
                      {prod.isBestDeal && (
                        <span className="text-[9px] bg-red-100 text-red-900 px-1.5 py-0.5 rounded font-bold">Deal</span>
                      )}
                      {prod.isNewArrival && (
                        <span className="text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold">New</span>
                      )}
                    </div>

                    {canManageProducts && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingProduct({ ...prod });
                            setIsAddProductOpen(false);
                          }}
                          className="p-1.5 rounded bg-white text-neutral-600 hover:text-black border border-[#E7E5E0]"
                          title="Edit Product"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${prod.name}?`)) {
                              onDeleteProduct(prod.id);
                            }
                          }}
                          className="p-1.5 rounded bg-white text-red-500 hover:text-red-700 border border-[#E7E5E0]"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: INVENTORY & STOCK */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[#171717]">Variant-Level Inventory & Stock Control</h3>
                <p className="text-xs text-neutral-500">
                  Update inventory levels instantly. Stock validations prevent overselling across customer carts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStockHistoryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E5E0] hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-neutral-500" />
                  <span>View Stock Adjustment Logs</span>
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Filter by product or SKU..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E7E5E0] text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E7E5E0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] text-neutral-600 font-bold uppercase text-[11px] border-b border-[#E7E5E0]">
                  <tr>
                    <th className="p-3">Product Name & SKU</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Variant Breakdown</th>
                    <th className="p-3">Total Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Quick Stock Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E0]">
                  {products
                    .filter((p) =>
                      p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                      p.sku.toLowerCase().includes(inventorySearch.toLowerCase())
                    )
                    .map((prod) => {
                      const isLow = prod.stock <= (prod.lowStockThreshold || settings.lowStockThreshold);
                      const isOut = prod.stock <= 0;

                      return (
                        <tr key={prod.id} className="hover:bg-neutral-50/50">
                          <td className="p-3">
                            <p className="font-bold text-[#171717]">{prod.name}</p>
                            <p className="font-mono text-[10px] text-neutral-400">{prod.sku}</p>
                          </td>

                          <td className="p-3 text-neutral-600">{prod.category}</td>

                          <td className="p-3">
                            {prod.variants && prod.variants.length > 0 ? (
                              <div className="space-y-1">
                                {prod.variants.map((v) => (
                                  <div key={v.id} className="flex items-center justify-between text-[11px] bg-neutral-100 px-2 py-0.5 rounded gap-2">
                                    <span>{v.name} ({v.sku}):</span>
                                    <span className="font-bold">{v.stock} units</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-neutral-400 text-[11px]">Single Item (No variants)</span>
                            )}
                          </td>

                          <td className="p-3">
                            <span className="text-sm font-black text-[#171717]">{prod.stock}</span>
                          </td>

                          <td className="p-3">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded bg-neutral-200 text-neutral-700 font-bold text-[10px]">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                                Low Stock Alert
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                In Stock
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            {canManageInventory && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onUpdateStock(prod.id, undefined, Math.max(0, prod.stock - 1), 'Manual decrement in Admin')}
                                  className="w-6 h-6 rounded bg-neutral-200 hover:bg-neutral-300 font-bold flex items-center justify-center text-xs"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-bold text-xs">{prod.stock}</span>
                                <button
                                  onClick={() => onUpdateStock(prod.id, undefined, prod.stock + 1, 'Manual increment in Admin')}
                                  className="w-6 h-6 rounded bg-[#171717] text-white hover:bg-[#C9A44C] hover:text-[#171717] font-bold flex items-center justify-center text-xs"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: COUPONS & OFFERS */}
        {activeTab === 'coupons' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#171717]">Promotions, Coupons & Seasonal Offers</h3>
                <p className="text-xs text-neutral-500">
                  Configure discount codes with start/end dates, usage limits, and minimum cart amounts
                </p>
              </div>

              {canManageCoupons && (
                <button
                  onClick={() => {
                    const newCoupon: Coupon = {
                      id: `cpn-${Date.now()}`,
                      code: 'NEWOFFER',
                      description: 'Special seasonal promotion',
                      discountType: 'flat',
                      discountValue: 100,
                      minPurchase: 999,
                      startDate: new Date().toISOString(),
                      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
                      usageLimit: 100,
                      usedCount: 0,
                      isActive: true,
                    };
                    setEditingCoupon(newCoupon);
                    setIsAddCouponOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Coupon</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map((cpn) => (
                <div key={cpn.id} className="p-4 rounded-xl border border-[#E7E5E0] bg-[#F7F6F2] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-[#171717] text-[#C9A44C]">
                      {cpn.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      cpn.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                    }`}>
                      {cpn.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 font-medium">{cpn.description}</p>
                  
                  <div className="text-[11px] text-neutral-500 space-y-0.5">
                    <p>Benefit: <strong>{cpn.discountType === 'flat' ? `₹${cpn.discountValue} FLAT OFF` : `${cpn.discountValue}% OFF`}</strong></p>
                    <p>Min Purchase: <strong>{formatCurrency(cpn.minPurchase)}</strong></p>
                    <p>Usage: <strong>{cpn.usedCount} / {cpn.usageLimit} redeemed</strong></p>
                    <p>Valid Till: <strong>{new Date(cpn.endDate).toLocaleDateString('en-IN')}</strong></p>
                  </div>

                  {canManageCoupons && (
                    <div className="pt-2 border-t border-[#E7E5E0] flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingCoupon({ ...cpn });
                          setIsAddCouponOpen(false);
                        }}
                        className="p-1 rounded text-neutral-600 hover:text-black"
                        title="Edit Coupon"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete coupon ${cpn.code}?`) && onDeleteCoupon) {
                            onDeleteCoupon(cpn.id);
                          }
                        }}
                        className="p-1 rounded text-red-500 hover:text-red-700"
                        title="Delete Coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-base text-[#171717]">Security & Administrative Audit Logs</h3>
              <p className="text-xs text-neutral-500">
                Tamper-evident record of all critical store modifications, payment verifications, and order transitions
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E7E5E0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F2] text-neutral-600 font-bold uppercase text-[11px] border-b border-[#E7E5E0]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action Event</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Log Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E0]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-neutral-400">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/50">
                        <td className="p-3 text-neutral-500 font-mono text-[11px]">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="p-3 font-bold text-[#171717]">
                          <span className="px-2 py-0.5 rounded bg-neutral-100 border text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-neutral-700">
                          {log.actor}
                        </td>
                        <td className="p-3 text-neutral-600">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: STOREFRONT CMS & SETTINGS */}
        {activeTab === 'cms' && (
          <div className="bg-white rounded-2xl p-6 border border-[#E7E5E0] shadow-2xs space-y-6">
            <div>
              <h3 className="font-bold text-base text-[#171717]">Storefront CMS & Operations Settings</h3>
              <p className="text-xs text-neutral-500">
                Configure delivery fee thresholds, WhatsApp contact number, UPI merchant ID, and homepage announcement banner
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Store Display Name
                </label>
                <input
                  type="text"
                  value={localSettings.storeName}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, storeName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none disabled:bg-neutral-100"
                />
              </div>

              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={localSettings.tagline}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, tagline: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none disabled:bg-neutral-100"
                />
              </div>

              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  WhatsApp Contact Number (with 91 country code)
                </label>
                <input
                  type="text"
                  value={localSettings.whatsappNumber}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, whatsappNumber: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none font-mono disabled:bg-neutral-100"
                />
                <p className="text-[10px] text-neutral-400 mt-1">*PENDING official business WhatsApp registration</p>
              </div>

              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Official Merchant UPI ID
                </label>
                <input
                  type="text"
                  value={localSettings.upiId}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, upiId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none font-mono disabled:bg-neutral-100"
                />
                <p className="text-[10px] text-neutral-400 mt-1">*PENDING official merchant UPI ID connection</p>
              </div>

              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Standard Kerala Delivery Fee (₹)
                </label>
                <input
                  type="number"
                  value={localSettings.deliveryFee}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, deliveryFee: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none disabled:bg-neutral-100"
                />
              </div>

              <div>
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Free Delivery Threshold (₹)
                </label>
                <input
                  type="number"
                  value={localSettings.freeDeliveryThreshold}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, freeDeliveryThreshold: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none disabled:bg-neutral-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-[#171717] uppercase mb-1">
                  Homepage Announcement Bar Text
                </label>
                <input
                  type="text"
                  value={localSettings.announcementText}
                  disabled={!canManageSettings}
                  onChange={(e) => setLocalSettings({ ...localSettings, announcementText: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none disabled:bg-neutral-100"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between">
              {canManageSettings ? (
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Store Settings</span>
                </button>
              ) : (
                <p className="text-xs text-neutral-400">Settings modification is restricted to the Store Owner role.</p>
              )}

              {settingsSaved && (
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Settings Successfully Saved!
                </span>
              )}
            </div>
          </div>
        )}

        {/* Modal: CSV Import */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#C9A44C]" />
                  <h3 className="font-bold text-base text-[#171717]">Bulk Product CSV Import</h3>
                </div>
                <button
                  onClick={() => setIsCsvModalOpen(false)}
                  className="p-1 rounded text-neutral-400 hover:text-black"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-neutral-600 space-y-1">
                <p>Paste comma-separated CSV text with headers: <code>name, brand, category, price, originalprice, stock, sku, mainimage</code></p>
              </div>

              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => handleParseCsv(e.target.value)}
                placeholder={`name, brand, category, price, stock, sku\nPure Linen Shirt, LoomCraft, Fashion, 1399, 10, YM-FSH-01\nWireless Earbuds, SonicWave, Electronics, 1899, 8, YM-ELC-01`}
                className="w-full p-3 font-mono text-xs border rounded-xl outline-none"
              />

              {/* Validation Feedback */}
              {csvValidationErrors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-700 space-y-1">
                  <p className="font-bold">Validation Warnings:</p>
                  {csvValidationErrors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}

              {csvParsedRows.length > 0 && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-800">
                  <p className="font-bold">Ready to import {csvParsedRows.length} valid product items.</p>
                </div>
              )}

              {csvImportResult && (
                <p className="text-xs text-emerald-700 font-bold">{csvImportResult}</p>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={handleExecuteCsvImport}
                  disabled={csvParsedRows.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] disabled:opacity-40"
                >
                  Confirm & Import Products
                </button>
                <button
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Stock Adjustment History */}
        {isStockHistoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#C9A44C]" />
                  <h3 className="font-bold text-base text-[#171717]">Stock Adjustment Audit Trail</h3>
                </div>
                <button
                  onClick={() => setIsStockHistoryModalOpen(false)}
                  className="p-1 rounded text-neutral-400 hover:text-black"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F6F2] font-bold text-[11px] uppercase border-b">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Product / SKU</th>
                      <th className="p-3">Previous</th>
                      <th className="p-3">Change</th>
                      <th className="p-3">New Stock</th>
                      <th className="p-3">Reason & Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stockLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-neutral-400">No stock adjustment events recorded.</td>
                      </tr>
                    ) : (
                      stockLogs.map((stk) => (
                        <tr key={stk.id}>
                          <td className="p-3 text-neutral-500 font-mono text-[11px]">{formatDate(stk.timestamp)}</td>
                          <td className="p-3 font-semibold">{stk.productName} {stk.variantSku ? `(${stk.variantSku})` : ''}</td>
                          <td className="p-3">{stk.previousStock}</td>
                          <td className={`p-3 font-bold ${stk.difference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {stk.difference > 0 ? `+${stk.difference}` : stk.difference}
                          </td>
                          <td className="p-3 font-black">{stk.newStock}</td>
                          <td className="p-3 text-neutral-600">{stk.reason} ({stk.actor})</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setIsStockHistoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Selected Order Details */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-[#171717]">{selectedOrder.id}</h3>
                  <p className="text-xs text-neutral-500">Placed on {formatDate(selectedOrder.createdAt)}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100"
                >
                  ✕
                </button>
              </div>

              {/* Customer Box */}
              <div className="bg-[#F7F6F2] p-4 rounded-xl text-xs space-y-1">
                <p className="font-bold text-[#171717]">Customer Delivery Details:</p>
                <p>Name: {selectedOrder.customer.fullName}</p>
                <p>Phone: {selectedOrder.customer.phone}</p>
                <p>Address: {selectedOrder.customer.address}</p>
                <p>Pincode: {selectedOrder.customer.pincode} ({selectedOrder.customer.district || 'Kerala'})</p>
                {selectedOrder.customer.landmark && <p>Landmark: {selectedOrder.customer.landmark}</p>}
                {selectedOrder.customer.orderNotes && <p>Notes: {selectedOrder.customer.orderNotes}</p>}
              </div>

              {/* Items Breakdown */}
              <div className="text-xs space-y-2">
                <p className="font-bold text-[#171717] uppercase tracking-wider">Ordered Items:</p>
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b">
                    <span>{it.productName} {it.variantName ? `(${it.variantName})` : ''} × {it.quantity}</span>
                    <span className="font-bold">{formatCurrency(it.totalPrice)}</span>
                  </div>
                ))}
                {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount ({selectedOrder.couponCode})</span>
                    <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>Grand Total</span>
                  <span className="text-[#C9A44C]">{formatCurrency(selectedOrder.grandTotal)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-neutral-50 p-3 rounded-xl text-xs">
                <p className="font-bold text-neutral-700">Payment Status: {selectedOrder.paymentStatus.toUpperCase()}</p>
                {selectedOrder.utrNumber ? (
                  <p className="font-mono text-emerald-700 mt-1">Submitted UTR: <strong>{selectedOrder.utrNumber}</strong></p>
                ) : (
                  <p className="text-neutral-400 mt-1">No UTR submitted yet.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                {selectedOrder.paymentStatus === 'submitted' && canVerifyPayments && (
                  <button
                    onClick={() => {
                      onVerifyPayment(selectedOrder.id);
                      setSelectedOrder(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
                  >
                    Verify UPI Payment & Confirm
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-200 text-neutral-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Product Add/Edit Form */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base text-[#171717]">
                  {isAddProductOpen ? 'Add New Product' : `Edit: ${editingProduct.name}`}
                </h3>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold mb-1">Product Title *</label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Category *</label>
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as Category })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none bg-white"
                  >
                    <option value="Fashion">Fashion</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Kids">Kids</option>
                    <option value="Gifts">Gifts</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">SKU (Auto or Custom)</label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Publication Status *</label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as ProductPublicationStatus })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none bg-white font-bold"
                  >
                    <option value="published">Published (Visible to Customers)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Original Price (₹) for discount tag</label>
                  <input
                    type="number"
                    value={editingProduct.originalPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, originalPrice: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Total Available Stock *</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Main Image URL</label>
                  <input
                    type="text"
                    value={editingProduct.mainImage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingProduct({
                        ...editingProduct,
                        mainImage: val,
                        images: [val, ...(editingProduct.images.slice(1))],
                      });
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                {/* Multiple Images Reordering */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block font-bold">Image Gallery List</label>
                  {editingProduct.images.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <img src={img} alt="" className="w-8 h-8 rounded object-contain bg-neutral-100 border" />
                      <input
                        type="text"
                        value={img}
                        onChange={(e) => {
                          const updated = [...editingProduct.images];
                          updated[idx] = e.target.value;
                          setEditingProduct({ ...editingProduct, images: updated });
                        }}
                        className="flex-1 p-2 rounded-lg border text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingProduct.images.filter((_, i) => i !== idx);
                          setEditingProduct({ ...editingProduct, images: updated });
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct({
                        ...editingProduct,
                        images: [...editingProduct.images, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'],
                      });
                    }}
                    className="text-xs text-[#C9A44C] font-bold hover:underline"
                  >
                    + Add Additional Image URL
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Product Description</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E0] outline-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingProduct.isFeatured}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                      className="rounded"
                    />
                    <span>Featured on Homepage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingProduct.isBestDeal}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isBestDeal: e.target.checked })}
                      className="rounded"
                    />
                    <span>Best Deal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={editingProduct.isNewArrival}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isNewArrival: e.target.checked })}
                      className="rounded"
                    />
                    <span>New Arrival</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => {
                    if (!editingProduct.name.trim()) {
                      alert('Please provide product title');
                      return;
                    }
                    if (editingProduct.status === 'published' && (!editingProduct.mainImage || editingProduct.price <= 0)) {
                      alert('Incomplete products cannot be published. Please provide image and valid price.');
                      return;
                    }

                    if (isAddProductOpen) {
                      onAddProduct(editingProduct);
                    } else {
                      onUpdateProduct(editingProduct);
                    }
                    setEditingProduct(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717]"
                >
                  Save Product
                </button>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Coupon Add/Edit */}
        {editingCoupon && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base text-[#171717]">
                  {isAddCouponOpen ? 'Create New Coupon' : `Edit Coupon: ${editingCoupon.code}`}
                </h3>
                <button onClick={() => setEditingCoupon(null)} className="p-1 rounded text-neutral-400 hover:text-black">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">Coupon Code (Uppercase)</label>
                  <input
                    type="text"
                    value={editingCoupon.code}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 rounded-xl border outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Description</label>
                  <input
                    type="text"
                    value={editingCoupon.description}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Discount Type</label>
                    <select
                      value={editingCoupon.discountType}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, discountType: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl border bg-white outline-none"
                    >
                      <option value="flat">Flat ₹ OFF</option>
                      <option value="percentage">Percentage % OFF</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Discount Value</label>
                    <input
                      type="number"
                      value={editingCoupon.discountValue}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, discountValue: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Minimum Purchase (₹)</label>
                    <input
                      type="number"
                      value={editingCoupon.minPurchase}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, minPurchase: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Usage Limit</label>
                    <input
                      type="number"
                      value={editingCoupon.usageLimit}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, usageLimit: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold pt-1">
                  <input
                    type="checkbox"
                    checked={editingCoupon.isActive}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span>Active & Redeemable by Customers</span>
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => {
                    if (onSaveCoupon) onSaveCoupon(editingCoupon);
                    setEditingCoupon(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717]"
                >
                  Save Coupon
                </button>
                <button
                  onClick={() => setEditingCoupon(null)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
