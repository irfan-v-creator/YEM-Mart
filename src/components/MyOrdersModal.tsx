import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Package, 
  Search, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertCircle, 
  Copy, 
  Check, 
  ShoppingBag, 
  ArrowRight, 
  Calendar, 
  MapPin, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  XCircle,
  Phone,
  Download,
  Share2,
  MessageCircle,
  FileText
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { 
  formatCurrency, 
  formatDate, 
  generateOrderReceiptMessage, 
  downloadOrderReceiptText, 
  formatWhatsAppUrl 
} from '../utils/formatters';
import { generateOrderPdfInvoice } from '../utils/pdfInvoice';
import { api } from '../utils/api';
import { normalizeProductImageUrl, IMAGE_FALLBACK_SVG } from '../utils/imageUrl';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onRequestCancellation: (orderId: string, reason: string) => void;
  onExploreShop?: () => void;
  whatsappNumber?: string;
}

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  onRequestCancellation,
  onExploreShop,
  whatsappNumber = '7510447887',
}) => {
  const [activeTab, setActiveTab] = useState<'recent' | 'lookup'>('recent');
  const [searchInput, setSearchInput] = useState('');
  const [searchPhoneInput, setSearchPhoneInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Device-persisted orders
  const [savedDeviceOrders, setSavedDeviceOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('yem_mart_my_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedDeviceOrders(parsed);
        }
      }
      const savedPhone = localStorage.getItem('yem_mart_customer_phone');
      if (savedPhone && !searchPhoneInput) {
        setSearchPhoneInput(savedPhone);
      }
    } catch {}
  }, [isOpen]);

  // Merge device-saved orders with parent orders state
  const mergedRecentOrders: Order[] = useMemo(() => {
    const map = new Map<string, Order>();
    // First take from orders passed from parent
    orders.forEach((o) => map.set(o.id, o));
    // Then supplement with device local storage orders if not present
    savedDeviceOrders.forEach((o) => {
      if (!map.has(o.id)) {
        map.set(o.id, o);
      } else {
        // Use latest status from active orders
        map.set(o.id, map.get(o.id)!);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, savedDeviceOrders]);

  if (!isOpen) return null;

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareReceiptWhatsApp = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = generateOrderReceiptMessage(order, whatsappNumber);
    const url = formatWhatsAppUrl(whatsappNumber, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadReceipt = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    downloadOrderReceiptText(order, whatsappNumber);
  };

  const handleDownloadPdf = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingPdfId(order.id);
      generateOrderPdfInvoice(order, whatsappNumber);
    } catch (err) {
      console.error('Failed to generate PDF invoice:', err);
    } finally {
      setTimeout(() => setDownloadingPdfId(null), 1200);
    }
  };

  const handleCopyReceiptText = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = generateOrderReceiptMessage(order, whatsappNumber);
    navigator.clipboard.writeText(text);
    setCopiedReceiptId(order.id);
    setTimeout(() => setCopiedReceiptId(null), 2500);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setLookupResult(null);

    const term = searchInput.trim().toUpperCase();
    const phone = searchPhoneInput.trim().replace(/[^0-9]/g, '');

    if (!term && !phone) {
      setSearchError('Please enter an Order ID or 10-digit Phone Number');
      return;
    }

    setIsSearching(true);

    try {
      // 1. If both Order ID and Phone provided, use server track endpoint
      if (term.startsWith('YEM-') && phone.length >= 4) {
        const serverOrder = await api.trackOrder(term, phone);
        setLookupResult(serverOrder);
        setExpandedOrderId(serverOrder.id);
        setIsSearching(false);
        return;
      }

      // 2. Search in merged recent orders and local state
      const match = mergedRecentOrders.find((o) => {
        const matchesId = term && o.id.toUpperCase().includes(term);
        const matchesPhone = phone && (o.customer.phone.endsWith(phone) || o.customer.phone === phone);
        if (term && phone) return matchesId && matchesPhone;
        return matchesId || matchesPhone;
      });

      if (match) {
        setLookupResult(match);
        setExpandedOrderId(match.id);
      } else {
        // Try server-side lookup if it looks like an order ID
        if (term.startsWith('YEM-') && phone) {
          const res = await api.trackOrder(term, phone);
          setLookupResult(res);
          setExpandedOrderId(res.id);
        } else {
          setSearchError('No order found matching your search. Please verify your Order ID and phone number.');
        }
      }
    } catch (err: any) {
      setSearchError(err.message || 'Order not found. Please verify your details.');
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'prepared':
        return { label: 'Order Prepared', bg: 'bg-amber-50 text-amber-900 border-amber-200' };
      case 'whatsapp_pending':
        return { label: 'Awaiting Confirmation', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'payment_submitted':
        return { label: 'Payment Under Review', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'confirmed':
        return { label: 'Order Confirmed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'processing':
        return { label: 'Processing & Packed', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'shipped':
        return { label: 'Dispatched / In Transit', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'delivered':
        return { label: 'Delivered', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'cancelled':
        return { label: 'Cancelled', bg: 'bg-red-50 text-red-700 border-red-200' };
      default:
        return { label: status, bg: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
    }
  };

  const canCancel = (status: OrderStatus) => {
    return ['prepared', 'whatsapp_pending', 'payment_submitted', 'confirmed'].includes(status);
  };

  const handleConfirmCancel = () => {
    if (!cancelModalOrder) return;
    if (!cancelReason.trim()) {
      alert('Please state a reason for cancelling your order');
      return;
    }
    onRequestCancellation(cancelModalOrder.id, cancelReason.trim());
    setCancelModalOrder(null);
    setCancelReason('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-[#E7E5E0]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E5E0] bg-[#F7F6F2] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#171717] flex items-center justify-center text-[#C9A44C] shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#171717] tracking-tight">My Orders & Tracking</h2>
              <p className="text-[11px] text-neutral-500">View your active shipments and purchase history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-200/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 bg-white border-b border-[#E7E5E0] flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'recent'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Recent Orders ({mergedRecentOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lookup')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'lookup'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Quick Lookup / Track</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: RECENT ORDERS */}
          {activeTab === 'recent' && (
            <div>
              {mergedRecentOrders.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-[#C9A44C]">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#171717]">No Orders Placed Yet</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
                      You haven't placed an order on this device yet. If you have an Order ID from a previous session, you can use the Quick Lookup tab!
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => setActiveTab('lookup')}
                      className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Search by Order ID / Mobile
                    </button>
                    {onExploreShop && (
                      <button
                        onClick={() => {
                          onClose();
                          onExploreShop();
                        }}
                        className="px-5 py-2 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all"
                      >
                        Explore Kerala Store
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {mergedRecentOrders.map((order) => {
                    const badge = getStatusBadge(order.status);
                    const isExpanded = expandedOrderId === order.id;
                    const itemsCount = order.items.reduce((acc, i) => acc + i.quantity, 0);

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-[#E7E5E0] hover:border-neutral-400 transition-all shadow-2xs overflow-hidden"
                      >
                        {/* Order Header Card */}
                        <div className="p-4 bg-[#F7F6F2]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7E5E0]">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#171717]">
                                {order.id}
                              </span>
                              <button
                                onClick={(e) => handleCopy(order.id, e)}
                                className="p-1 text-neutral-400 hover:text-black transition-colors"
                                title="Copy Order ID"
                              >
                                {copiedId === order.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              <span>{formatDate(order.createdAt)}</span>
                              <span>•</span>
                              <span>{order.customer.fullName}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] uppercase font-bold text-neutral-400">Grand Total</p>
                              <p className="text-sm font-black text-[#171717]">
                                {formatCurrency(order.grandTotal)}
                              </p>
                            </div>
                            <button
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className="px-3 py-1.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-white flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide' : 'Details'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Items Thumbnail Row */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[75%]">
                            {order.items.slice(0, 3).map((item, idx) => (
                              <div
                                key={idx}
                                className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 shrink-0 p-1 flex items-center justify-center relative overflow-hidden"
                                title={`${item.productName} (Qty: ${item.quantity})`}
                              >
                                {item.image && item.image.trim() ? (
                                  <img
                                    src={normalizeProductImageUrl(item.image) || IMAGE_FALLBACK_SVG}
                                    alt={item.productName}
                                    onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_FALLBACK_SVG; }}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-neutral-400" />
                                )}
                                <span className="absolute bottom-0.5 right-0.5 bg-[#171717] text-white text-[8px] font-bold px-1 rounded">
                                  ×{item.quantity}
                                </span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-dashed border-neutral-300 shrink-0 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                                +{order.items.length - 3}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] text-neutral-500 font-medium">
                              {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>

                        {/* Dedicated Receipt Action Row for Every Order Card */}
                        <div className="px-4 py-3 bg-[#F7F6F2]/70 border-t border-[#E7E5E0] flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => handleShareReceiptWhatsApp(order, e)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Send formatted receipt to YEM MART WhatsApp support"
                            >
                              <MessageCircle className="w-3.5 h-3.5 shrink-0 text-white" />
                              <span>📱 Share Receipt on WhatsApp</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDownloadPdf(order, e)}
                              disabled={downloadingPdfId === order.id}
                              className="px-3.5 py-1.5 rounded-xl bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-60"
                              title="Download official corporate A4 PDF Tax Invoice with itemized breakdown"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0 text-[#C9A44C]" />
                              <span>{downloadingPdfId === order.id ? 'Generating PDF...' : '📥 Download PDF Invoice'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCopyReceiptText(order, e)}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 active:scale-95 text-[#171717] font-semibold text-xs flex items-center gap-1.5 transition-all border border-neutral-300 hover:border-neutral-400 cursor-pointer"
                              title="Copy structured receipt text"
                            >
                              {copiedReceiptId === order.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-700 font-bold">✓ Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                  <span>📋 Copy Text</span>
                                </>
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className="text-xs font-bold text-neutral-600 hover:text-black flex items-center gap-1 transition-colors ml-auto cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Expanded Full Tracking & Itemized Breakdown */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 border-t border-[#E7E5E0] bg-white space-y-4 text-xs animate-in fade-in duration-150">
                            
                            {/* Delivery Address Details */}
                            <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-[#171717]">
                                <MapPin className="w-3.5 h-3.5 text-[#C9A44C]" />
                                <span>Delivery Destination</span>
                              </div>
                              <p className="text-neutral-700">
                                {order.customer.address}, {order.customer.pincode}
                                {order.customer.district ? ` (${order.customer.district}, Kerala)` : ''}
                              </p>
                              {order.customer.landmark && (
                                <p className="text-neutral-500 text-[11px]">Landmark: {order.customer.landmark}</p>
                              )}
                              <p className="text-neutral-500 text-[11px]">Contact Phone: {order.customer.phone}</p>
                            </div>

                            {/* Itemized List */}
                            <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 space-y-2">
                              <p className="font-bold text-[#171717] uppercase text-[10px] tracking-wider">
                                Itemized Breakdown
                              </p>
                              <div className="divide-y divide-neutral-100">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-[#171717]">{item.productName}</p>
                                      {item.variantName && (
                                        <p className="text-[11px] text-neutral-500">Option: {item.variantName}</p>
                                      )}
                                      <p className="text-[10px] text-neutral-400">
                                        Qty: {item.quantity} × ₹{item.unitPrice}
                                      </p>
                                    </div>
                                    <span className="font-bold text-[#171717]">
                                      {formatCurrency(item.totalPrice)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="pt-2 border-t border-neutral-100 flex justify-between font-bold text-xs text-[#171717]">
                                <span>Total Paid / Payable</span>
                                <span className="text-[#C9A44C]">{formatCurrency(order.grandTotal)}</span>
                              </div>
                            </div>

                            {/* Download & Share Receipt Card */}
                            <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-[#171717]">
                                  <FileText className="w-3.5 h-3.5 text-[#C9A44C]" />
                                  <span>Official Order Receipt & WhatsApp Share</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-mono">Invoice #{order.id}</span>
                              </div>
                              <p className="text-[11px] text-neutral-500">
                                Send a clean, itemized receipt to YEM MART WhatsApp support (+91 {whatsappNumber.slice(-10)}) or download your invoice.
                              </p>
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => handleShareReceiptWhatsApp(order, e)}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                  title="Send formatted receipt to YEM MART WhatsApp support"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>📱 Share Receipt on WhatsApp</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleCopyReceiptText(order, e)}
                                  className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-50 active:scale-95 text-[#171717] font-semibold text-xs flex items-center gap-1.5 transition-all border border-neutral-300 cursor-pointer"
                                  title="Copy complete receipt to clipboard"
                                >
                                  {copiedReceiptId === order.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="text-emerald-700 font-bold">✓ Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                      <span>📋 Copy Text</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadPdf(order, e)}
                                  disabled={downloadingPdfId === order.id}
                                  className="px-3.5 py-2 rounded-xl bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                                  title="Download official corporate A4 PDF Tax Invoice with itemized breakdown"
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0 text-[#C9A44C]" />
                                  <span>{downloadingPdfId === order.id ? 'Generating PDF...' : '📥 Download PDF Invoice'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDownloadReceipt(order, e)}
                                  className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-[#171717] font-semibold text-xs flex items-center gap-1.5 transition-all border border-neutral-200 cursor-pointer"
                                  title="Download clean text receipt file (.txt)"
                                >
                                  <Download className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                  <span>Download Text</span>
                                </button>
                              </div>
                            </div>

                            {/* Live Status Timeline */}
                            {order.statusTimeline && order.statusTimeline.length > 0 && (
                              <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 space-y-2">
                                <p className="font-bold text-[#171717] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-[#C9A44C]" />
                                  <span>Shipment Activity Timeline</span>
                                </p>
                                <div className="space-y-2 pt-1">
                                  {order.statusTimeline.map((step, sIdx) => (
                                    <div key={sIdx} className="flex items-start gap-2 text-xs">
                                      <div className="w-2 h-2 rounded-full bg-[#C9A44C] mt-1 shrink-0" />
                                      <div className="flex-1">
                                        <div className="flex items-baseline justify-between">
                                          <span className="font-bold text-[#171717] capitalize">
                                            {step.status.replace(/_/g, ' ')}
                                          </span>
                                          <span className="text-[10px] text-neutral-400">
                                            {formatDate(step.timestamp)}
                                          </span>
                                        </div>
                                        {step.note && (
                                          <p className="text-neutral-600 text-[11px] mt-0.5">{step.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cancellation Request Action */}
                            {canCancel(order.status) && (
                              <div className="pt-1 flex justify-end">
                                <button
                                  onClick={() => setCancelModalOrder(order)}
                                  className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 hover:underline"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Request Order Cancellation</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUICK LOOKUP */}
          {activeTab === 'lookup' && (
            <div className="space-y-5">
              <form onSubmit={handleLookup} className="bg-[#F7F6F2] p-4 sm:p-5 rounded-2xl border border-[#E7E5E0] space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#171717]">Track Order by Details</h3>
                  <p className="text-xs text-neutral-500">
                    Enter your Order ID (e.g. YEM-20261016-1234) and registered 10-digit mobile number:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[#171717] uppercase mb-1">
                      Order ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. YEM-20261016-4821"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:border-[#C9A44C] outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#171717] uppercase mb-1">
                      Registered Mobile Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9847012345"
                      value={searchPhoneInput}
                      onChange={(e) => setSearchPhoneInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:border-[#C9A44C] outline-none font-mono"
                    />
                  </div>
                </div>

                {searchError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-2.5 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'Searching Store Records...' : 'Find & Track Order'}</span>
                </button>
              </form>

              {/* Lookup Result Display */}
              {lookupResult && (
                <div className="bg-white rounded-2xl border-2 border-[#C9A44C] p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E0]">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#C9A44C]">Order Verified</span>
                      <p className="text-base font-black text-[#171717] font-mono">{lookupResult.id}</p>
                      <p className="text-xs text-neutral-500">{formatDate(lookupResult.createdAt)}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(lookupResult.status).bg}`}>
                      {getStatusBadge(lookupResult.status).label}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-[#171717] uppercase text-[10px]">Ordered Items</p>
                    <div className="divide-y divide-neutral-100">
                      {lookupResult.items.map((it, idx) => (
                        <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-[#171717]">{it.productName}</p>
                            {it.variantName && <p className="text-neutral-500 text-[11px]">{it.variantName}</p>}
                            <p className="text-neutral-400 text-[10px]">Qty: {it.quantity} × ₹{it.unitPrice}</p>
                          </div>
                          <span className="font-bold text-[#171717]">{formatCurrency(it.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-neutral-100 flex justify-between font-bold text-sm">
                      <span>Total Amount:</span>
                      <span className="text-[#C9A44C]">{formatCurrency(lookupResult.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="bg-[#F7F6F2] p-3 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-[#171717]">Delivery Address:</p>
                    <p className="text-neutral-700">
                      {lookupResult.customer.address}, {lookupResult.customer.pincode}
                    </p>
                  </div>

                  {/* Download & Share Receipt Card for Lookup */}
                  <div className="bg-[#F7F6F2] p-3.5 rounded-xl border border-[#E7E5E0] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-[#171717] text-xs">
                        <FileText className="w-3.5 h-3.5 text-[#C9A44C]" />
                        <span>Order Receipt & WhatsApp Support</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">Invoice #{lookupResult.id}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Need help or confirmation? Send this clean receipt directly to store WhatsApp support (+91 {whatsappNumber.slice(-10)}) or download your receipt.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleShareReceiptWhatsApp(lookupResult, e)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="Send formatted receipt to YEM MART WhatsApp support"
                      >
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>📱 Share Receipt on WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyReceiptText(lookupResult, e)}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 active:scale-95 text-[#171717] font-semibold text-xs flex items-center gap-1.5 transition-all border border-neutral-300 cursor-pointer"
                        title="Copy clean receipt text to clipboard"
                      >
                        {copiedReceiptId === lookupResult.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-emerald-700 font-bold">✓ Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span>📋 Copy Text</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadPdf(lookupResult, e)}
                        disabled={downloadingPdfId === lookupResult.id}
                        className="px-3.5 py-2 rounded-xl bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                        title="Download official corporate A4 PDF Tax Invoice with itemized breakdown"
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0 text-[#C9A44C]" />
                        <span>{downloadingPdfId === lookupResult.id ? 'Generating PDF...' : '📥 Download PDF Invoice'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadReceipt(lookupResult, e)}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 active:scale-95 text-neutral-700 font-semibold text-xs flex items-center gap-1.5 transition-all border border-neutral-300 cursor-pointer"
                        title="Download text receipt file (.txt)"
                      >
                        <Download className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                        <span>Download Text</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#E7E5E0] bg-[#F7F6F2] flex items-center justify-between shrink-0 text-xs text-neutral-500">
          <span>Need help? WhatsApp: <strong>+91 7510447887</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#E7E5E0] text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Cancellation Prompt Submodal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl border border-red-200">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>Cancel Order #{cancelModalOrder.id}</span>
            </div>
            <p className="text-xs text-neutral-600">
              Please specify the reason for cancellation. If your order has not shipped, stock will be immediately released back to our inventory.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Ordered by mistake, wrong variant selected, change of address..."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:border-red-500 outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="px-3.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
