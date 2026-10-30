import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  ArrowRight, 
  Phone,
  Truck,
  MessageSquare,
  Lock,
  ArrowLeft,
  Info,
  RefreshCw,
  User,
  Star,
  Plus,
  Home,
  Briefcase,
  Tag,
  MapPin
} from 'lucide-react';

import { CartItem, CustomerDetails, Order, StoreSettings, CustomerUser, SavedAddress } from '../types';
import { 
  formatCurrency, 
  generateOrderId, 
  buildWhatsAppOrderMessage,
  formatWhatsAppUrl
} from '../utils/formatters';
import { ALL_KERALA_DISTRICTS, lookupKeralaDistrict, isKeralaPincode, KeralaDistrict } from '../data/initialData';
import { api } from '../utils/api';
import { normalizeProductImageUrl } from '../utils/imageUrl';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  couponCode?: string;
  couponDiscount?: number;
  onOrderCreated: (order: Order) => void;
  onClearCart: () => void;
  onOpenTrackingWithId?: (orderId: string, phone: string) => void;
  customer?: CustomerUser | null;
  savedAddresses?: SavedAddress[];
  onSaveNewAddress?: (address: Partial<SavedAddress>) => Promise<void>;
  onOpenAuth?: () => void;
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
  customer,
  savedAddresses = [],
  onSaveNewAddress,
  onOpenAuth,
}) => {

  const [step, setStep] = useState<'details' | 'whatsapp'>('details');

  // Customer Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isWhatsAppSameAsPhone, setIsWhatsAppSameAsPhone] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [district, setDistrict] = useState<KeralaDistrict>('Ernakulam');
  const [landmark, setLandmark] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const clientOrderIdRef = useRef<string | null>(null);

  // Saved Address Integration
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [saveToAccount, setSaveToAccount] = useState(false);

  useEffect(() => {
    if (customer && savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      setSelectedAddressId(defaultAddr.id);
      setFullName(defaultAddr.fullName || '');
      setPhone(defaultAddr.phone || '');
      setAddress(defaultAddr.address || '');
      setPincode(defaultAddr.pincode || '');
      setDistrict((defaultAddr.district as KeralaDistrict) || 'Ernakulam');
      setLandmark(defaultAddr.landmark || '');
    } else if (customer) {
      setSelectedAddressId('new');
      if (customer.fullName && !fullName) setFullName(customer.fullName);
      if (customer.phone && !phone) setPhone(customer.phone);
    }
  }, [customer, savedAddresses, isOpen]);

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.fullName || '');
    setPhone(addr.phone || '');
    setAddress(addr.address || '');
    setPincode(addr.pincode || '');
    setDistrict((addr.district as KeralaDistrict) || 'Ernakulam');
    setLandmark(addr.landmark || '');
    setFormErrors({});
  };

  const handleSelectNewAddress = () => {
    setSelectedAddressId('new');
    setFullName(customer?.fullName || '');
    setPhone(customer?.phone || '');
    setAddress('');
    setPincode('');
    setDistrict('Ernakulam');
    setLandmark('');
    setFormErrors({});
  };

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
    // WhatsApp number validation (only if provided and not marked same as mobile)
    if (!isWhatsAppSameAsPhone && whatsappNumber.trim()) {
      if (!/^[6-9]\d{9}$/.test(whatsappNumber.trim())) {
        errors.whatsappNumber = 'Please enter a valid 10-digit WhatsApp number (starting with 6-9)';
      }
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
    setSubmissionError(null);

    // Maintain stable clientOrderId across retries of the same submission attempt
    if (!clientOrderIdRef.current) {
      clientOrderIdRef.current = 'CO-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    }

    // Determine finalized WhatsApp number based on customer selection
    const resolvedWhatsAppNumber = isWhatsAppSameAsPhone 
      ? phone.trim() 
      : (whatsappNumber.trim() ? whatsappNumber.trim() : undefined);

    const customer: CustomerDetails = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      whatsappNumber: resolvedWhatsAppNumber,
      isWhatsAppSameAsPhone,
      address: address.trim(),
      pincode: pincode.trim(),
      district,
      landmark: landmark.trim() || undefined,
      orderNotes: orderNotes.trim() || undefined,
    };

    try {
      // Authoritative server-side order creation & persistent Supabase save
      const serverOrder = await api.createOrder(
        customer,
        itemsToSubmit.map(i => ({
          productId: i.productId,
          variantSku: i.variant?.sku,
          quantity: i.quantity,
        })),
        couponCode,
        clientOrderIdRef.current
      );

      // Order successfully persisted in database
      clientOrderIdRef.current = null;
      setCreatedOrder(serverOrder);
      onOrderCreated(serverOrder);

      // If customer requested saving this new address, dispatch to background
      if (saveToAccount && selectedAddressId === 'new' && onSaveNewAddress && customer) {
        onSaveNewAddress({
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          pincode: pincode.trim(),
          district,
          landmark: landmark.trim() || undefined,
          label: 'Home',
          isDefault: savedAddresses.length === 0,
        }).catch((err) => console.warn('Could not save address to account:', err));
      }

      onClearCart();
      setStep('whatsapp');
    } catch (err: any) {

      console.error('Order creation error:', err);
      const msg = err?.message || 'Unable to place order right now. Your cart is preserved. Please retry.';
      setSubmissionError(msg);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header Bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#171717]">
              {step === 'details' ? 'Delivery Information & Order Review' : 'Send WhatsApp Order'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Pills (2 Steps: Details -> WhatsApp Order) */}
        <div className="px-6 py-2.5 bg-[#F7F6F2] border-b border-[#E7E5E0] flex items-center justify-between text-xs font-semibold text-neutral-500">
          <div className={`flex items-center gap-1.5 ${step === 'details' ? 'text-[#C9A44C]' : 'text-neutral-400'}`}>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[11px] font-bold">1</span>
            <span>Delivery Details</span>
          </div>
          <span className="text-neutral-300">→</span>
          <div className={`flex items-center gap-1.5 ${step === 'whatsapp' ? 'text-[#C9A44C]' : 'text-neutral-400'}`}>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-[11px] font-bold">2</span>
            <span>WhatsApp Confirmation</span>
          </div>
        </div>

        {/* Step 1: Delivery Details Form */}
        {step === 'details' && (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Authenticated Customer Saved Addresses Selector */}
            {customer && savedAddresses && savedAddresses.length > 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-[#C9A44C]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#C9A44C]" />
                    <span className="text-xs font-extrabold text-[#171717] uppercase tracking-wider">
                      Select Delivery Address
                    </span>
                  </div>
                  <span className="text-[11px] text-[#C9A44C] font-bold">
                    Logged in as {customer.fullName || customer.email}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white border-[#C9A44C] ring-2 ring-[#C9A44C]/30 shadow-xs'
                            : 'bg-white/70 border-[#E7E5E0] hover:border-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] font-bold text-[#C9A44C] flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-current" /> Default
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-xs text-[#171717] truncate">{addr.fullName}</p>
                        <p className="text-[11px] text-neutral-600 line-clamp-1">{addr.address}</p>
                        <p className="text-[11px] text-neutral-500 font-medium">
                          {addr.district} — {addr.pincode}
                        </p>
                      </div>
                    );
                  })}

                  {/* Option to enter a different address */}
                  <div
                    onClick={handleSelectNewAddress}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-center items-center ${
                      selectedAddressId === 'new'
                        ? 'bg-white border-[#171717] ring-2 ring-neutral-400 shadow-xs'
                        : 'bg-white/50 border-dashed border-[#E7E5E0] hover:border-neutral-400 text-neutral-600'
                    }`}
                  >
                    <Plus className="w-4 h-4 mb-0.5" />
                    <span className="text-xs font-bold text-[#171717]">Deliver to Different Address</span>
                    <span className="text-[10px] text-neutral-400">Enter custom recipient details</span>
                  </div>
                </div>
              </div>
            ) : !customer ? (
              /* Guest Checkout Notice with Sign In Link */
              <div className="p-3.5 rounded-2xl bg-[#F7F6F2] border border-[#E7E5E0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-500" />
                  <span className="text-neutral-700">
                    Have a YEM MART account?{' '}
                    {onOpenAuth && (
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="font-bold text-[#C9A44C] hover:underline"
                      >
                        Sign In
                      </button>
                    )}{' '}
                    to use your saved addresses.
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-neutral-400">Guest Checkout</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (selectedAddressId !== 'new') setSelectedAddressId('new');
                  }}
                  placeholder="e.g. Rahul Menon"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                />
                {formErrors.fullName && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.fullName}</p>
                )}
              </div>


              {/* Mandatory Mobile Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
                  Mobile Number <span className="text-red-500">*</span>
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

            {/* Optional WhatsApp Contact Settings */}
            <div className="p-3.5 rounded-2xl bg-[#F7F6F2] border border-[#E7E5E0] space-y-2.5">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="checkout-whatsapp-same"
                  checked={isWhatsAppSameAsPhone}
                  onChange={(e) => {
                    setIsWhatsAppSameAsPhone(e.target.checked);
                    if (e.target.checked) {
                      setFormErrors(prev => {
                        const copy = { ...prev };
                        delete copy.whatsappNumber;
                        return copy;
                      });
                    }
                  }}
                  className="mt-0.5 rounded text-[#C9A44C] focus:ring-[#C9A44C] h-4 w-4 border-neutral-300"
                />
                <label htmlFor="checkout-whatsapp-same" className="text-xs text-neutral-700 cursor-pointer select-none">
                  <span className="font-bold text-[#171717]">WhatsApp number is same as mobile number</span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Check this if you want to receive order updates on your primary mobile number via WhatsApp.
                  </p>
                </label>
              </div>

              {/* Show optional separate WhatsApp number input when checkbox is NOT checked */}
              {!isWhatsAppSameAsPhone && (
                <div className="pt-2 border-t border-[#E7E5E0] space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-[#171717] uppercase tracking-wider">
                      Alternative WhatsApp Number <span className="text-neutral-400 font-normal lowercase">(optional)</span>
                    </label>
                    <span className="text-[10px] text-neutral-400">For WhatsApp order updates</span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs text-neutral-400 font-bold">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Leave empty if not using WhatsApp"
                      className="w-full pl-11 pr-3 py-2 rounded-xl bg-white border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-xs"
                    />
                  </div>
                  {formErrors.whatsappNumber && (
                    <p className="text-xs text-red-500">{formErrors.whatsappNumber}</p>
                  )}
                </div>
              )}
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

            {/* Save address to account toggle if customer is logged in */}
            {customer && selectedAddressId === 'new' && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/50 border border-[#C9A44C]/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveToAccount}
                  onChange={(e) => setSaveToAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-[#171717] focus:ring-[#C9A44C] accent-[#171717]"
                />
                <span className="text-xs font-semibold text-neutral-800">
                  Save this address to my YEM MART account for future orders
                </span>
              </label>
            )}

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

            {submissionError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 flex items-start gap-3 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-red-900">Order Submission Failed</p>
                  <p className="text-red-700">{submissionError}</p>
                  <p className="text-[11px] text-red-600">Your cart and address are intact. Click below to retry.</p>
                </div>
              </div>
            )}

            <button
              onClick={handleProceedToReview}
              disabled={isSubmittingOrder}
              className="w-full py-3.5 rounded-xl bg-[#171717] text-white font-bold text-sm hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmittingOrder ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C9A44C]" />
                  <span>Saving Order & Verifying Inventory...</span>
                </>
              ) : (
                <>
                  <span>{submissionError ? 'Retry Placing Order' : 'Create Order ID & Prepare WhatsApp Message'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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

            {/* Order Confirmation Status & Completion */}
            <div className="pt-4 border-t border-[#E7E5E0] space-y-3">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-950">
                    Order Request #{createdOrder.id} Generated
                  </p>
                  <p className="text-emerald-800 leading-relaxed">
                    Please send your order message on WhatsApp. Our customer support team will verify item availability, confirm delivery, and assist you directly.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Return to Shop</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
