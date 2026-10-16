import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  QrCode, 
  Phone,
  Truck,
  MessageSquare,
  Lock,
  ArrowLeft,
  Info
} from 'lucide-react';
import { CartItem, CustomerDetails, Order, StoreSettings } from '../types';
import { 
  formatCurrency, 
  generateOrderId, 
  buildWhatsAppOrderMessage,
  formatWhatsAppUrl
} from '../utils/formatters';
import { ALL_KERALA_DISTRICTS, lookupKeralaDistrict, isKeralaPincode, KeralaDistrict } from '../data/initialData';
import { api } from '../utils/api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  couponCode?: string;
  couponDiscount?: number;
  onOrderCreated: (order: Order) => void;
  onClearCart: () => void;
  onOpenTrackingWithId: (orderId: string, phone: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  couponCode,
  couponDiscount = 0,
  onOrderCreated,
  onClearCart,
  onOpenTrackingWithId,
}) => {
  const [step, setStep] = useState<'details' | 'whatsapp' | 'payment'>('details');

  // Customer Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [district, setDistrict] = useState<KeralaDistrict>('Ernakulam');
  const [landmark, setLandmark] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Snapshot of items at checkout initiation so that onClearCart() does not wipe WhatsApp items
  const [checkoutItemsSnapshot, setCheckoutItemsSnapshot] = useState<CartItem[]>(items);

  useEffect(() => {
    if (items && items.length > 0 && step === 'details') {
      setCheckoutItemsSnapshot(items);
    }
  }, [items, step]);

  // Created Order State
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // UPI Payment Step State
  const [utrNumber, setUtrNumber] = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [utrSubmitting, setUtrSubmitting] = useState(false);

  if (!isOpen) return null;

  // Compute active item list (prefer live items if available, otherwise snapshot)
  const activeItems = (items && items.length > 0) ? items : checkoutItemsSnapshot;

  const subtotal = activeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isFreeDelivery = subtotal >= settings.freeDeliveryThreshold;
  const deliveryFee = activeItems.length === 0 ? 0 : isFreeDelivery ? 0 : settings.deliveryFee;
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);

  const handlePincodeChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length >= 3) {
      const autoDistrict = lookupKeralaDistrict(cleaned);
      if (autoDistrict) {
        setDistrict(autoDistrict);
      }
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Please enter your full name';
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid 10-digit mobile number';
    }
    if (!address.trim()) errors.address = 'Please enter complete delivery address';
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      errors.pincode = 'Please enter a valid 6-digit Pincode';
    } else if (!isKeralaPincode(pincode.trim())) {
      errors.pincode = 'YEM MART currently delivers exclusively across Kerala (Pincodes starting with 67, 68, or 69).';
    }
    if (!district) {
      errors.district = 'Please select your Kerala district';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToReview = async () => {
    if (!validateForm()) return;

    const itemsToSubmit = activeItems.length > 0 ? activeItems : items;
    if (itemsToSubmit.length === 0) {
      alert('Your cart is empty. Please select products to continue.');
      return;
    }

    // Freeze snapshot before any clear operations occur
    setCheckoutItemsSnapshot(itemsToSubmit);
    setIsSubmittingOrder(true);

    const customer: CustomerDetails = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
      district,
      landmark: landmark.trim() || undefined,
      orderNotes: orderNotes.trim() || undefined,
    };

    try {
      // 1. First attempt trusted server-side order creation & persistent saving
      const serverOrder = await api.createOrder(
        customer,
        itemsToSubmit.map(i => ({
          productId: i.productId,
          variantSku: i.variant?.sku,
          quantity: i.quantity,
        })),
        couponCode
      );

      setCreatedOrder(serverOrder);
      onOrderCreated(serverOrder);
      onClearCart();
      setStep('whatsapp');
    } catch (err: any) {
      console.warn('Backend order creation error, using local fallback:', err);
      // Client-side fallback if network offline
      const newOrderId = generateOrderId();
      const fallbackOrder: Order = {
        id: newOrderId,
        createdAt: new Date().toISOString(),
        customer,
        items: itemsToSubmit.map((i) => ({
          productId: i.productId,
          productName: i.product?.name || 'Selected Item',
          variantName: i.variant?.name,
          variantSku: i.variant?.sku || i.product?.sku,
          quantity: i.quantity,
          unitPrice: i.price,
          totalPrice: i.price * i.quantity,
          image: i.product?.mainImage || '',
        })),
        subtotal,
        deliveryFee,
        discountAmount: couponDiscount,
        couponCode,
        grandTotal,
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

      setCreatedOrder(fallbackOrder);
      onOrderCreated(fallbackOrder);
      onClearCart();
      setStep('whatsapp');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  /**
   * Resolves the authoritative payload for WhatsApp message generation.
   * Guarantees item details, quantities, variants, and subtotal are NEVER empty or zero.
   */
  const getPreparedWhatsAppMessage = (): string => {
    if (!createdOrder) return '';

    // Prefer createdOrder.items (which contains productName, variantName, quantity, unitPrice)
    const orderItems = (createdOrder.items && createdOrder.items.length > 0)
      ? createdOrder.items
      : checkoutItemsSnapshot;

    const orderSubtotal = (createdOrder.subtotal && createdOrder.subtotal > 0)
      ? createdOrder.subtotal
      : (subtotal > 0 ? subtotal : orderItems.reduce((acc: number, it: any) => acc + (Number(it.totalPrice || (it.price || it.unitPrice || 0) * (it.quantity || 1))), 0));

    const orderDeliveryFee = createdOrder.deliveryFee ?? deliveryFee;
    const orderGrandTotal = (createdOrder.grandTotal && createdOrder.grandTotal > 0)
      ? createdOrder.grandTotal
      : (grandTotal > 0 ? grandTotal : Math.max(0, orderSubtotal - (createdOrder.discountAmount || couponDiscount) + orderDeliveryFee));

    return buildWhatsAppOrderMessage(
      createdOrder.id,
      createdOrder.customer,
      orderItems,
      orderSubtotal,
      orderDeliveryFee,
      orderGrandTotal,
      createdOrder.couponCode || couponCode,
      createdOrder.discountAmount ?? couponDiscount,
      settings.upiId
    );
  };

  const handleCopyWhatsAppMessage = () => {
    const msg = getPreparedWhatsAppMessage();
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const msg = getPreparedWhatsAppMessage();
    if (!msg) return;
    const url = formatWhatsAppUrl(settings.whatsappNumber, msg);
    window.open(url, '_blank');
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(settings.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmitUtr = async () => {
    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      alert('Please enter a valid UPI reference number (UTR)');
      return;
    }

    if (!createdOrder) return;
    setUtrSubmitting(true);

    try {
      await api.submitUtr(createdOrder.id, utrNumber.trim());
    } catch (e) {
      console.warn('Server UTR submit error, saving locally:', e);
    }

    const updatedOrder: Order = {
      ...createdOrder,
      status: 'payment_submitted',
      paymentStatus: 'submitted',
      utrNumber: utrNumber.trim(),
      paymentSubmittedAt: new Date().toISOString(),
      statusTimeline: [
        ...createdOrder.statusTimeline,
        {
          status: 'payment_submitted',
          timestamp: new Date().toISOString(),
          note: `Customer submitted UPI UTR: ${utrNumber.trim()}. Admin verification pending.`,
        },
      ],
    };
    setCreatedOrder(updatedOrder);
    onOrderCreated(updatedOrder);
    setUtrSubmitted(true);
    setUtrSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header Bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#171717]">
              {step === 'details' && 'Delivery Information & Order Review'}
              {step === 'whatsapp' && 'Send WhatsApp Order'}
              {step === 'payment' && 'Instant UPI Payment Verification'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Pills */}
        <div className="px-6 py-2.5 bg-[#F7F6F2] border-b border-[#E7E5E0] flex items-center justify-between text-xs font-semibold text-neutral-500">
          <div className={`flex items-center gap-1.5 ${step === 'details' ? 'text-[#C9A44C]' : 'text-neutral-400'}`}>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[11px] font-bold">1</span>
            <span>Details</span>
          </div>
          <span className="text-neutral-300">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'whatsapp' ? 'text-[#C9A44C]' : 'text-neutral-400'}`}>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[11px] font-bold">2</span>
            <span>WhatsApp Order</span>
          </div>
          <span className="text-neutral-300">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'payment' ? 'text-[#C9A44C]' : 'text-neutral-400'}`}>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[11px] font-bold">3</span>
            <span>UPI Payment</span>
          </div>
        </div>

        {/* Step 1: Delivery Details Form */}
        {step === 'details' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Menon"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                />
                {formErrors.fullName && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.fullName}</p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  WhatsApp Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs text-neutral-400 font-bold">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9847123456"
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                  />
                </div>
                {formErrors.phone && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                Complete Delivery Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Flat name, Street, Area in Kerala"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm resize-none"
              />
              {formErrors.address && (
                <p className="text-xs text-red-500 mt-1">{formErrors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Kerala Pincode */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Pincode (Kerala 6-digit) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="e.g. 682001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm font-medium"
                />
                {pincode.length >= 3 && isKeralaPincode(pincode) && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    Kerala postal circle verified ({district})
                  </p>
                )}
                {formErrors.pincode && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.pincode}</p>
                )}
              </div>

              {/* Kerala District Selector (All 14 Districts) */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Kerala District <span className="text-red-500">*</span>
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value as KeralaDistrict)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] bg-white outline-none text-sm font-medium"
                >
                  {ALL_KERALA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d} District
                    </option>
                  ))}
                </select>
                {formErrors.district && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.district}</p>
                )}
              </div>
            </div>

            {/* Serviceability & Delivery Notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <Truck className="w-4 h-4 text-[#C9A44C] shrink-0 mt-0.5" />
              <span>
                <strong>Service Coverage:</strong> Flat ₹{settings.deliveryFee} shipping across all 14 Kerala districts (FREE above ₹{settings.freeDeliveryThreshold}). Standard courier transit takes 1-3 business days. Remote hill tracts (Idukki, Wayanad) may experience +1-2 days.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Landmark */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Prominent Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near St. George Church / Metro Pillar 240"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                />
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Special Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Please deliver after 4 PM, or leave with security"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                />
              </div>
            </div>

            {/* Order Breakdown Box */}
            <div className="bg-[#F7F6F2] rounded-2xl p-4 border border-[#E7E5E0] space-y-2 text-xs">
              <h4 className="font-bold text-[#171717] uppercase tracking-wider mb-1">
                Order Review ({items.reduce((s, i) => s + i.quantity, 0)} Items)
              </h4>
              <div className="flex justify-between text-neutral-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-[#171717]">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Kerala Delivery Charges</span>
                <span className="font-bold text-[#171717]">
                  {deliveryFee === 0 ? <span className="text-emerald-700">FREE</span> : formatCurrency(deliveryFee)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#E7E5E0] flex justify-between text-base font-black text-[#171717]">
                <span>Total Amount Due</span>
                <span className="text-[#C9A44C]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleProceedToReview}
              className="w-full py-3.5 rounded-xl bg-[#171717] text-white font-bold text-sm hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2 shadow-md active:scale-98"
            >
              <span>Create Order ID & Prepare WhatsApp Message</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: WhatsApp Preparation & Mandatory Notice */}
        {step === 'whatsapp' && createdOrder && (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Generated Order ID Banner */}
            <div className="bg-amber-50/90 border-2 border-[#C9A44C] rounded-2xl p-5 text-center">
              <span className="text-xs uppercase font-extrabold text-amber-900 tracking-wider">
                Official Website Order ID
              </span>
              <p className="text-2xl sm:text-3xl font-black text-[#171717] tracking-wider mt-1">
                {createdOrder.id}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Recorded on YEM MART database on {new Date().toLocaleDateString('en-IN')}
              </p>
            </div>

            {/* Ordered Items Attached Card */}
            <div className="bg-[#F7F6F2] rounded-2xl p-4 border border-[#E7E5E0] space-y-3">
              <div className="flex items-center justify-between border-b border-[#E7E5E0] pb-2">
                <span className="text-xs font-bold uppercase text-[#171717] tracking-wider">
                  Attached to WhatsApp Message ({(createdOrder.items?.reduce((a, b) => a + b.quantity, 0)) || checkoutItemsSnapshot.reduce((a, b) => a + b.quantity, 0)} Items)
                </span>
                <span className="text-xs font-extrabold text-[#C9A44C]">
                  Total: {formatCurrency(createdOrder.grandTotal || grandTotal)}
                </span>
              </div>
              <div className="divide-y divide-neutral-200/60 max-h-40 overflow-y-auto space-y-2 pr-1">
                {((createdOrder.items && createdOrder.items.length > 0) ? createdOrder.items : checkoutItemsSnapshot).map((it: any, idx: number) => {
                  const title = it.productName || it.product?.name || it.name || 'Selected Item';
                  const variant = it.variantName || it.variant?.name;
                  const qty = it.quantity || 1;
                  const lineTotal = it.totalPrice || ((it.unitPrice || it.price || 0) * qty);
                  return (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div className="pr-2">
                        <p className="font-semibold text-[#171717] line-clamp-1">{title}</p>
                        {variant && <p className="text-[11px] text-neutral-500">Option: {variant}</p>}
                        <p className="text-[10px] text-neutral-400">Qty: {qty}</p>
                      </div>
                      <span className="font-bold text-[#171717] shrink-0">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Crucial Operating Disclosure */}
            <div className="bg-neutral-100 rounded-2xl p-4 border border-neutral-300 text-xs text-neutral-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#171717]">
                <Info className="w-4 h-4 text-[#C9A44C]" />
                <span>Notice on WhatsApp Ordering Workflow</span>
              </div>
              <p>
                The website prepares your pre-formatted WhatsApp order message. Opening WhatsApp or generating an Order ID <strong>does not automatically confirm the order</strong>. You must <strong>manually press Send</strong> on WhatsApp to submit your request to YEM MART.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleOpenWhatsApp}
                className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Send Order via WhatsApp Now</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                onClick={handleCopyWhatsAppMessage}
                className="w-full py-3 rounded-xl bg-white border border-[#E7E5E0] hover:bg-neutral-50 text-neutral-700 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Message Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-neutral-500" />
                    <span>Copy Pre-formatted WhatsApp Message</span>
                  </>
                )}
              </button>
            </div>

            {/* Next Step: Proceed to Payment Submission */}
            <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between">
              <button
                onClick={() => setStep('payment')}
                className="w-full py-3 rounded-xl bg-[#171717] text-white font-bold text-xs sm:text-sm hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to UPI Payment (Optional / Recommended)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Instant UPI Payment Submission */}
        {step === 'payment' && createdOrder && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  Order ID #{createdOrder.id} Prepared
                </p>
                <p className="text-[11px] text-emerald-700">
                  Total Payable: <strong>{formatCurrency(createdOrder.grandTotal)}</strong>
                </p>
              </div>
            </div>

            {/* UPI QR & ID Box */}
            <div className="bg-[#F7F6F2] rounded-2xl p-6 border border-[#E7E5E0] flex flex-col items-center text-center">
              <div className="w-36 h-36 bg-white rounded-xl p-2 border border-neutral-300 shadow-sm flex items-center justify-center relative">
                <QrCode className="w-28 h-28 text-[#171717]" />
                <span className="absolute bottom-1 text-[9px] bg-[#171717] text-[#C9A44C] px-1.5 py-0.5 rounded font-bold">
                  YEM UPI
                </span>
              </div>
              <p className="text-xs font-bold text-[#171717] mt-3">
                Scan with Google Pay, PhonePe, Paytm, or BHIM
              </p>

              {/* UPI ID Copy Field */}
              <div className="mt-3 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E7E5E0] text-xs">
                <span className="text-neutral-500">UPI ID:</span>
                <strong className="text-[#171717]">{settings.upiId}</strong>
                <button
                  onClick={handleCopyUpi}
                  className="p-1 rounded text-neutral-400 hover:text-black transition-colors"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-2">
                *Official YEM MART payment details pending final merchant tie-up.
              </p>
            </div>

            {/* UTR Reference Input */}
            <div>
              <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                Enter 12-Digit UPI Reference Number (UTR)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                  placeholder="e.g. 428391048291"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm font-mono"
                  disabled={utrSubmitted}
                />
                <button
                  onClick={handleSubmitUtr}
                  disabled={utrSubmitted || !utrNumber.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all disabled:opacity-50 shrink-0"
                >
                  {utrSubmitted ? 'Submitted!' : 'Submit UTR'}
                </button>
              </div>

              {utrSubmitted ? (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    Payment record submitted (UTR: <strong>{utrNumber}</strong>). Admin will verify in bank statement and update your status timeline.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Screenshots are not proof of payment alone. The 12-digit UTR is verified against bank records.
                </p>
              )}
            </div>

            {/* Final Done CTA */}
            <div className="pt-4 border-t border-[#E7E5E0] flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onClose();
                  onOpenTrackingWithId(createdOrder.id, createdOrder.customer.phone);
                }}
                className="flex-1 py-3 rounded-xl bg-[#C9A44C] text-[#171717] font-extrabold text-sm hover:bg-[#d8b55e] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Track My Order Timeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="py-3 px-5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
