import React from 'react';
import { X, Heart, ShoppingBag, Trash2, ArrowRight, Package } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { normalizeProductImageUrl, IMAGE_FALLBACK_SVG } from '../utils/imageUrl';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlist: Product[];
  onRemoveFromWishlist: (productId: string) => void;
  onMoveToCart: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlist,
  onRemoveFromWishlist,
  onMoveToCart,
  onOpenProduct,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between bg-[#F7F6F2]">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
            <h2 className="text-base font-bold text-[#171717]">Saved Items (Wishlist)</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#171717] text-white font-semibold">
              {wishlist.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Note on device storage */}
        <div className="px-6 py-2.5 bg-neutral-50 border-b border-[#E7E5E0] text-[11px] text-neutral-500">
          Saved on your device storage. Ready to add to cart anytime!
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#E7E5E0]">
          {wishlist.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <div className="w-16 h-16 rounded-full bg-[#F7F6F2] flex items-center justify-center mb-3 text-neutral-300">
                <Heart className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-[#171717]">No Saved Items Yet</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Click the heart icon on any product card or details page to save it for later.
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2.5 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all"
              >
                Browse Store
              </button>
            </div>
          ) : (
            wishlist.map((prod) => (
              <div key={prod.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                {prod.mainImage && prod.mainImage.trim() ? (
                  <img
                    src={normalizeProductImageUrl(prod.mainImage) || IMAGE_FALLBACK_SVG}
                    alt={prod.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = IMAGE_FALLBACK_SVG; }}
                    onClick={() => {
                      onOpenProduct(prod);
                      onClose();
                    }}
                    className="w-20 h-20 rounded-xl object-contain bg-[#F7F6F2] p-1.5 border border-[#E7E5E0] cursor-pointer shrink-0"
                  />
                ) : (
                  <div 
                    onClick={() => {
                      onOpenProduct(prod);
                      onClose();
                    }}
                    className="w-20 h-20 rounded-xl bg-[#F7F6F2] p-1.5 border border-[#E7E5E0] cursor-pointer shrink-0 flex items-center justify-center"
                  >
                    <Package className="w-8 h-8 text-neutral-400" />
                  </div>
                )}

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        onClick={() => {
                          onOpenProduct(prod);
                          onClose();
                        }}
                        className="text-xs sm:text-sm font-bold text-[#171717] line-clamp-1 hover:text-[#C9A44C] cursor-pointer"
                      >
                        {prod.name}
                      </h4>
                      <button
                        onClick={() => onRemoveFromWishlist(prod.id)}
                        className="text-neutral-400 hover:text-red-500 p-0.5"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs font-extrabold text-[#171717] mt-1">
                      {formatCurrency(prod.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => {
                        onMoveToCart(prod);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#171717] text-white hover:bg-[#C9A44C] hover:text-[#171717] text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>{prod.variants && prod.variants.length > 0 ? 'Select & Add' : 'Move to Cart'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
