import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Heart, 
  ShoppingBag, 
  ArrowRight, 
  Truck, 
  ShieldCheck, 
  AlertCircle,
  Tag,
  Check
} from 'lucide-react';
import { CartItem, StoreSettings, Coupon } from '../types';
import { formatCurrency } from '../utils/formatters';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  appliedCoupon?: Coupon | null;
  couponDiscount: number;
  onApplyCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  onRemoveCoupon: () => void;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveToWishlist: (item: CartItem) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  appliedCoupon,
  couponDiscount,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemoveItem,
  onMoveToWishlist,
  onProceedToCheckout,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isFreeDelivery = subtotal >= settings.freeDeliveryThreshold;
  const deliveryFee = items.length === 0 ? 0 : isFreeDelivery ? 0 : settings.deliveryFee;
  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);

  const amountNeededForFreeShipping = Math.max(0, settings.freeDeliveryThreshold - subtotal);
  const progressPercent = Math.min(100, Math.round((subtotal / settings.freeDeliveryThreshold) * 100));

  const hasOutOfStockItem = items.some(item => {
    const stockAvailable = item.variant ? item.variant.stock : item.product.stock;
    return stockAvailable < item.quantity;
  });

  const handleApplyCouponCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponError(null);
    setIsApplyingCoupon(true);
    try {
      const res = await onApplyCoupon(couponInput.trim().toUpperCase());
      if (!res.success) {
        setCouponError(res.error || 'Invalid coupon code');
      } else {
        setCouponInput('');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Error applying coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative">
        {/* Cart Header */}
        <div className="px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between bg-[#F7F6F2]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#C9A44C]" />
            <h2 className="text-base font-bold text-[#171717]">Shopping Cart</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#171717] text-white font-semibold">
              {items.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-[#C9A44C]/20 text-xs">
          {isFreeDelivery ? (
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>You've unlocked <strong>FREE Delivery</strong> across Kerala!</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-neutral-700 font-medium mb-1">
                <span>Add <strong>{formatCurrency(amountNeededForFreeShipping)}</strong> for Free Delivery</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C9A44C] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#E7E5E0]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <div className="w-16 h-16 rounded-full bg-[#F7F6F2] flex items-center justify-center mb-3 text-neutral-300">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-[#171717]">Your Cart is Empty</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Browse our curated Kerala collections in fashion, tech, home, and gifts.
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2.5 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            items.map((item) => {
              const maxStock = item.variant ? item.variant.stock : item.product.stock;
              const isItemOverStock = item.quantity > maxStock;

              return (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {/* Thumbnail */}
                  <img
                    src={item.product.mainImage}
                    alt={item.product.name}
                    className="w-20 h-20 rounded-xl object-contain bg-[#F7F6F2] p-1.5 border border-[#E7E5E0] shrink-0"
                  />

                  {/* Info & Controls */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-[#171717] line-clamp-1">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="text-neutral-400 hover:text-red-500 transition-colors p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.variant && (
                        <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                          Variant: <span className="text-[#171717]">{item.variant.name}</span>
                        </p>
                      )}

                      <p className="text-xs font-extrabold text-[#171717] mt-1">
                        {formatCurrency(item.price)}
                      </p>

                      {isItemOverStock && (
                        <p className="text-[10px] text-red-600 flex items-center gap-1 mt-1 font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Only {maxStock} available in stock!
                        </p>
                      )}
                    </div>

                    {/* Quantity & Save for later */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F7F6F2]">
                      <div className="flex items-center rounded-lg border border-[#E7E5E0] bg-[#F7F6F2]">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-[#171717]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= maxStock}
                          className="w-6 h-6 rounded bg-white text-xs font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => onMoveToWishlist(item)}
                        className="text-[11px] text-neutral-500 hover:text-[#C9A44C] flex items-center gap-1 transition-colors"
                      >
                        <Heart className="w-3 h-3" />
                        <span>Save to Wishlist</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        {items.length > 0 && (
          <div className="p-6 bg-[#F7F6F2] border-t border-[#E7E5E0] space-y-3">
            {/* Coupon Code Section */}
            <div className="bg-white p-2.5 rounded-xl border border-[#E7E5E0]">
              {appliedCoupon ? (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Coupon <strong>{appliedCoupon.code}</strong> Applied</span>
                  </div>
                  <button
                    onClick={onRemoveCoupon}
                    className="text-[11px] text-red-600 hover:underline font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCouponCode} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Coupon Code (e.g. WELCOME50)"
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-[#E7E5E0] text-xs font-mono uppercase outline-none focus:border-[#C9A44C]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="px-3 py-1.5 bg-[#171717] text-white text-xs font-bold rounded-lg hover:bg-[#C9A44C] hover:text-[#171717] disabled:opacity-40 transition-colors shrink-0"
                  >
                    {isApplyingCoupon ? '...' : 'Apply'}
                  </button>
                </form>
              )}
              {couponError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{couponError}</p>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-semibold text-[#171717]">{formatCurrency(subtotal)}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-600">
                <span>Delivery across Kerala</span>
                <span className="font-semibold text-[#171717]">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    formatCurrency(deliveryFee)
                  )}
                </span>
              </div>
              <div className="pt-2 border-t border-[#E7E5E0] flex justify-between text-sm sm:text-base font-black text-[#171717]">
                <span>Grand Total</span>
                <span className="text-[#C9A44C]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {hasOutOfStockItem && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Adjust quantities to match available inventory before placing order.</span>
              </div>
            )}

            <button
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
              disabled={hasOutOfStockItem}
              className="w-full py-3.5 px-4 rounded-xl bg-[#171717] text-white font-bold text-sm hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[10px] text-neutral-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Safe WhatsApp order preparation & Direct UPI verification</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
