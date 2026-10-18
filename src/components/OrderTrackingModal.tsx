import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  PackageCheck, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertCircle, 
  ShieldCheck, 
  XCircle, 
  Phone,
  MapPin,
  Calendar,
  Lock,
  Package
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatCurrency, formatDate, maskPhone, maskName } from '../utils/formatters';
import { api } from '../utils/api';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  initialOrderId?: string;
  initialPhone?: string;
  onRequestCancellation: (orderId: string, reason: string) => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialOrderId = '',
  initialPhone = '',
  onRequestCancellation,
}) => {
  const [orderIdInput, setOrderIdInput] = useState(initialOrderId);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (initialOrderId && initialPhone) {
      setOrderIdInput(initialOrderId);
      setPhoneInput(initialPhone);
      handleSearch(initialOrderId, initialPhone);
    }
  }, [initialOrderId, initialPhone, isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (oid = orderIdInput, ph = phoneInput) => {
    setSearchError('');
    setShowCancelPrompt(false);

    const cleanOid = oid.trim().toUpperCase();
    const cleanPh = ph.trim().replace(/[^0-9]/g, '');

    if (!cleanOid) {
      setSearchError('Please enter your Order ID (e.g. YEM-20261010-4102)');
      return;
    }
    if (!cleanPh || cleanPh.length < 4) {
      setSearchError('Please enter the 10-digit mobile number used when ordering for security verification');
      return;
    }

    setIsSearching(true);
    try {
      const serverResult = await api.trackOrder(cleanOid, cleanPh);
      setTrackedOrder(serverResult);
    } catch {
      // Local fallback
      const found = orders.find(
        (o) =>
          o.id.toUpperCase() === cleanOid &&
          (o.customer.phone.endsWith(cleanPh) || o.customer.phone === cleanPh)
      );

      if (found) {
        setTrackedOrder(found);
      } else {
        setTrackedOrder(null);
        setSearchError('No matching order found for this Order ID and Phone combination. Please check your details.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getStepStatus = (stepName: OrderStatus, current: OrderStatus): 'done' | 'current' | 'upcoming' => {
    const orderPipeline: OrderStatus[] = [
      'prepared',
      'whatsapp_pending',
      'payment_submitted',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
    ];

    if (current === 'cancelled') return 'upcoming';

    const currentIdx = orderPipeline.indexOf(current);
    const stepIdx = orderPipeline.indexOf(stepName);

    if (currentIdx > stepIdx) return 'done';
    if (currentIdx === stepIdx) return 'current';
    return 'upcoming';
  };

  const handleCancel = () => {
    if (!trackedOrder) return;
    if (!cancelReason.trim()) {
      alert('Please provide a reason for requesting cancellation');
      return;
    }
    onRequestCancellation(trackedOrder.id, cancelReason.trim());
    setShowCancelPrompt(false);
    // Refresh local tracked order view
    const updated = orders.find(o => o.id === trackedOrder.id);
    if (updated) setTrackedOrder({ ...updated, status: 'cancelled' });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#C9A44C]" />
            <h2 className="text-lg font-bold text-[#171717]">Track Your Order Timeline</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Privacy Verification Form */}
        <div className="p-6 border-b border-[#E7E5E0] bg-[#F7F6F2]">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium mb-3">
            <Lock className="w-3.5 h-3.5 text-[#C9A44C]" />
            <span>Secure 2-Factor Lookup: Order ID + Phone Verification Required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Website Order ID
              </label>
              <input
                type="text"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder="e.g. YEM-20261010-4102"
                className="w-full px-3.5 py-2 bg-white rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Registered Mobile Number
              </label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2 bg-white rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-xs"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => handleSearch()}
              className="px-5 py-2 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verify & Track Status</span>
            </button>
            {trackedOrder && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Customer
              </span>
            )}
          </div>

          {searchError && (
            <p className="mt-2.5 text-xs text-red-600 flex items-center gap-1.5 bg-red-50 p-2 rounded-lg border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{searchError}</span>
            </p>
          )}
        </div>

        {/* Tracked Order Details */}
        {trackedOrder ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Order Overview Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E7E5E0]">
              <div>
                <span className="text-xs text-neutral-400 font-medium">Order Reference</span>
                <h3 className="text-lg font-black text-[#171717] tracking-wider">{trackedOrder.id}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Placed on {formatDate(trackedOrder.createdAt)}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end">
                <span className="text-xs text-neutral-400 font-medium">Total Order Value</span>
                <span className="text-lg font-black text-[#C9A44C]">
                  {formatCurrency(trackedOrder.grandTotal)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                  trackedOrder.paymentStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : trackedOrder.paymentStatus === 'submitted'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  UPI: {trackedOrder.paymentStatus.toUpperCase()}
                  {trackedOrder.utrNumber ? ` (UTR: ${trackedOrder.utrNumber})` : ''}
                </span>
              </div>
            </div>

            {/* Privacy-Masked Customer Info */}
            <div className="bg-[#F7F6F2] rounded-2xl p-4 border border-[#E7E5E0] text-xs space-y-1 text-neutral-600">
              <div className="flex justify-between">
                <span>Customer:</span>
                <strong className="text-[#171717]">{maskName(trackedOrder.customer.fullName)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Phone:</span>
                <strong className="text-[#171717]">{maskPhone(trackedOrder.customer.phone)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Destination:</span>
                <span className="text-[#171717] font-medium">
                  {trackedOrder.customer.district || 'Kerala'} • PIN {trackedOrder.customer.pincode}
                </span>
              </div>
            </div>

            {/* Visual Status Pipeline */}
            <div>
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-4">
                Fulfillment & Dispatch Timeline
              </h4>

              {trackedOrder.status === 'cancelled' ? (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <XCircle className="w-4 h-4" />
                    <span>Order Cancelled</span>
                  </div>
                  <p>Reason: {trackedOrder.cancellationReason || 'Customer requested'}</p>
                  <p className="text-red-700 text-[11px]">
                    Inventory items have been safely returned to active stock. If any payment was submitted, our team will review the transaction reference.
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-neutral-200 ml-3 space-y-6 pl-5 text-xs">
                  {/* Step 1: Website Order ID Prepared */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-0.5 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-white flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">1. Order Created on Website</h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        Unique Order ID #{trackedOrder.id} generated with Kerala address details.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: WhatsApp & Payment Submission */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                      trackedOrder.paymentStatus === 'submitted' || trackedOrder.paymentStatus === 'verified'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">
                        2. WhatsApp Message & Payment Submission
                      </h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {trackedOrder.utrNumber
                          ? `Payment UTR Reference submitted: ${trackedOrder.utrNumber}`
                          : 'Awaiting customer WhatsApp dispatch and UPI UTR submission'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Admin Confirmation */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                      ['confirmed', 'processing', 'shipped', 'delivered'].includes(trackedOrder.status)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-300 text-white'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">3. Verified & Confirmed by YEM MART</h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {['confirmed', 'processing', 'shipped', 'delivered'].includes(trackedOrder.status)
                          ? 'Admin verified UPI bank transaction and confirmed order allocation.'
                          : 'Pending admin review against official bank statement.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 4: Processing & Packing */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                      ['processing', 'shipped', 'delivered'].includes(trackedOrder.status)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-300 text-white'
                    }`}>
                      <PackageCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">4. Packing at Kerala Hub</h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {['processing', 'shipped', 'delivered'].includes(trackedOrder.status)
                          ? 'Item packed with protective cushioning at fulfillment center.'
                          : 'Scheduled for packing once confirmed.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 5: Shipped */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                      ['shipped', 'delivered'].includes(trackedOrder.status)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-300 text-white'
                    }`}>
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">5. In-Transit / Dispatched</h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {trackedOrder.status === 'shipped' || trackedOrder.status === 'delivered'
                          ? 'Dispatched with Kerala local express courier. Estimated delivery in 24-48 hours.'
                          : 'Will be dispatched upon packing completion.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 6: Delivered */}
                  <div className="relative">
                    <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full ring-4 ring-white flex items-center justify-center ${
                      trackedOrder.status === 'delivered'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-300 text-white'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-[#171717]">6. Delivered</h5>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {trackedOrder.status === 'delivered'
                          ? 'Delivered safely to customer.'
                          : 'Pending dispatch.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Items Summary in this Order */}
            <div className="border-t border-[#E7E5E0] pt-4">
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-2">
                Order Items ({trackedOrder.items.length})
              </h4>
              <div className="space-y-2">
                {trackedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-[#F7F6F2]">
                    <div className="flex items-center gap-2">
                      {it.image && it.image.trim() ? (
                        <img src={it.image} alt={it.productName || 'Order item'} className="w-8 h-8 rounded object-contain bg-[#F7F6F2] p-0.5 border" />
                      ) : (
                        <Package className="w-8 h-8 text-neutral-400 p-1 bg-[#F7F6F2] rounded border shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-[#171717]">{it.productName}</p>
                        {it.variantName && <p className="text-[10px] text-neutral-400">{it.variantName}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#171717]">{it.quantity} × {formatCurrency(it.unitPrice)}</span>
                      <p className="text-[10px] text-neutral-500">{formatCurrency(it.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cancellation Request Section (Early stages only) */}
            {trackedOrder.status !== 'cancelled' && trackedOrder.status !== 'delivered' && (
              <div className="border-t border-[#E7E5E0] pt-4">
                {!showCancelPrompt ? (
                  <button
                    onClick={() => setShowCancelPrompt(true)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors"
                  >
                    Need to cancel this order? Click here
                  </button>
                ) : (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-xs space-y-3">
                    <p className="font-bold text-red-900">Request Order Cancellation</p>
                    <p className="text-red-700 text-[11px]">
                      Cancellation restores inventory to stock. Please let us know why:
                    </p>
                    <textarea
                      rows={2}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Ordered wrong size, changed mind, duplicate order"
                      className="w-full p-2 bg-white rounded-xl border border-red-200 text-xs outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
                      >
                        Confirm Cancellation
                      </button>
                      <button
                        onClick={() => setShowCancelPrompt(false)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-neutral-300 text-neutral-700"
                      >
                        Keep Order
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-neutral-400">
            <PackageCheck className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm font-bold text-[#171717]">Enter your Order ID and Phone above</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              You will see live updates on verification, packaging, and courier dispatch across Kerala.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
