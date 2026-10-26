import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  ShoppingBag, 
  Star, 
  Truck, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Share2,
  Package,
  Zap
} from 'lucide-react';
import { Product, ProductVariant, CartItem } from '../types';
import { formatCurrency } from '../utils/formatters';
import { normalizeProductImageUrl, IMAGE_FALLBACK_SVG } from '../utils/imageUrl';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCartWithVariant: (product: Product, variant?: ProductVariant, quantity?: number) => void;
  onDirectBuy?: (product: Product, variant?: ProductVariant, quantity?: number) => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onOpenChatWithQuery?: (query: string) => void;
  whatsappNumber?: string;
  upiId?: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCartWithVariant,
  onDirectBuy,
  isWishlisted,
  onToggleWishlist,
  onOpenChatWithQuery,
  whatsappNumber,
  upiId,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'delivery'>('overview');
  const [variantError, setVariantError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedImage(product.mainImage || (product.images && product.images[0]) || '');
      setImageError(false);
      // If product has variants, set the first in-stock variant as default or none
      if (product.variants && product.variants.length > 0) {
        const firstAvailable = product.variants.find(v => v.stock > 0) || product.variants[0];
        setSelectedVariant(firstAvailable);
      } else {
        setSelectedVariant(undefined);
      }
      setQuantity(1);
      setVariantError(false);
    }
  }, [product]);

  if (!product) return null;

  const currentPrice = selectedVariant?.price ?? product.price;
  const currentOriginalPrice = selectedVariant?.originalPrice ?? product.originalPrice;
  const currentSku = selectedVariant?.sku ?? product.sku;
  const currentStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isOutOfStock = currentStock <= 0;
  const isLowStock = !isOutOfStock && currentStock <= (product.lowStockThreshold || 4);

  const handleAddToCart = () => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setVariantError(true);
      return;
    }
    if (isOutOfStock) return;

    onAddToCartWithVariant(product, selectedVariant, quantity);
    onClose();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} at YEM MART!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-neutral-200 flex flex-col">
        {/* Sticky Modal Header Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{product.brand}</span>
            <span className="text-neutral-300">•</span>
            <span className="text-xs font-semibold text-[#C9A44C]">{product.category}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 transition-colors"
              title="Share Product"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleWishlist(product)}
              className={`p-2 rounded-xl transition-colors ${
                isWishlisted ? 'text-red-600 bg-red-50' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
              title="Save to Wishlist"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-black transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gallery Section */}
          <div className="flex flex-col gap-4">
            {/* Main Image with contain behavior in 1:1 aspect ratio */}
            <div className="w-full aspect-square bg-[#F7F6F2] rounded-2xl p-6 flex items-center justify-center border border-[#E7E5E0] relative overflow-hidden">
              {(() => {
                const normalizedSelected = normalizeProductImageUrl(selectedImage);
                const displaySelected = imageError || !normalizedSelected ? IMAGE_FALLBACK_SVG : normalizedSelected;
                return (
                  <img
                    src={displaySelected}
                    alt={product.name}
                    onError={() => setImageError(true)}
                    className={`max-h-full max-w-full object-contain transition-all duration-300 ${
                      isOutOfStock ? 'opacity-50 grayscale' : ''
                    }`}
                  />
                );
              })()}

              {product.discountPercent && product.discountPercent > 0 && (
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#171717] text-[#C9A44C] text-xs font-extrabold uppercase">
                  {product.discountPercent}% OFF
                </span>
              )}

              {isOutOfStock && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center">
                  <span className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-bold text-sm">
                    Currently Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            {product.images && product.images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImage(img);
                      setImageError(false);
                    }}
                    className={`w-16 h-16 rounded-xl bg-[#F7F6F2] p-1.5 border-2 transition-all shrink-0 ${
                      selectedImage === img
                        ? 'border-[#C9A44C] ring-2 ring-[#C9A44C]/30'
                        : 'border-[#E7E5E0] hover:border-neutral-400'
                    }`}
                  >
                    <img
                      src={normalizeProductImageUrl(img) || IMAGE_FALLBACK_SVG}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = IMAGE_FALLBACK_SVG;
                      }}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* AI Assistant Question Prompt */}
            {onOpenChatWithQuery && (
              <div className="bg-amber-50/70 border border-[#C9A44C]/30 p-3.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-amber-950">Have questions about this item?</p>
                  <p className="text-amber-800 text-[11px]">Ask our Kerala Shopping Assistant in English or Malayalam!</p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenChatWithQuery(`Can you tell me more about ${product.name} (${product.brand})?`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#C9A44C] text-[#171717] font-bold text-xs hover:bg-[#d8b55e] transition-colors shrink-0"
                >
                  Ask Assistant
                </button>
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Product Title */}
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#171717] leading-tight">
                {product.name}
              </h1>

              {/* SKU & Brand */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400 font-medium">
                <span>SKU: {currentSku}</span>
                {product.brand && product.brand.trim() ? (
                  <>
                    <span>•</span>
                    <span>Brand: <strong className="text-neutral-700">{product.brand}</strong></span>
                  </>
                ) : null}
              </div>

              {/* Genuine Rating */}
              {product.rating !== undefined && product.rating > 0 ? (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                    <Star className="w-3.5 h-3.5 fill-emerald-700 text-emerald-700" />
                    <span>{product.rating.toFixed(1)}</span>
                  </div>
                  {product.reviewCount !== undefined && product.reviewCount > 0 ? (
                    <span className="text-xs text-neutral-500">
                      Based on {product.reviewCount} verified {product.reviewCount === 1 ? 'purchase' : 'purchases'}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Price Display */}
              <div className="mt-4 p-4 rounded-2xl bg-[#F7F6F2] border border-[#E7E5E0] flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#171717]">
                      {formatCurrency(currentPrice)}
                    </span>
                    {currentOriginalPrice && currentOriginalPrice > currentPrice && (
                      <span className="text-sm text-neutral-400 line-through">
                        {formatCurrency(currentOriginalPrice)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500 font-medium mt-0.5 block">
                    Inclusive of all local taxes • Free Kerala shipping above ₹999
                  </span>
                </div>

                <div>
                  {isOutOfStock ? (
                    <span className="px-2.5 py-1 rounded-md bg-neutral-200 text-neutral-700 text-xs font-bold">
                      Sold Out
                    </span>
                  ) : isLowStock ? (
                    <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                      Only {currentStock} left
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                      In Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Variants Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                      Select Option <span className="text-red-500">*</span>
                    </label>
                    {selectedVariant && (
                      <span className="text-xs text-neutral-500 font-medium">
                        Selected: <strong className="text-[#171717]">{selectedVariant.name}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => {
                      const isVariantOutOfStock = v.stock <= 0;
                      const isSelected = selectedVariant?.id === v.id;

                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVariant(v);
                            setVariantError(false);
                            if (v.image) setSelectedImage(v.image);
                          }}
                          disabled={isVariantOutOfStock}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                              : isVariantOutOfStock
                              ? 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed'
                              : 'bg-white text-neutral-700 border-[#E7E5E0] hover:border-neutral-400'
                          }`}
                        >
                          <span>{v.name}</span>
                          {v.stock > 0 && v.stock <= 3 && !isSelected && (
                            <span className="text-[10px] text-red-500">({v.stock} left)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {variantError && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Please select an option to proceed.
                    </p>
                  )}
                </div>
              )}

              {/* Quantity Selector */}
              {!isOutOfStock && (
                <div className="mt-5 flex items-center gap-4">
                  <label className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                    Quantity:
                  </label>
                  <div className="flex items-center rounded-xl border border-[#E7E5E0] bg-[#F7F6F2] p-1">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-white text-neutral-700 font-bold flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-bold text-sm text-[#171717]">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                      disabled={quantity >= currentStock}
                      className="w-8 h-8 rounded-lg bg-white text-neutral-700 font-bold flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Max: {currentStock} units
                  </span>
                </div>
              )}

              {/* Highlights Bullet Points */}
              {Array.isArray(product.highlights) && product.highlights.filter(h => Boolean(h && h.trim())).length > 0 && (
                <div className="mt-6 border-t border-[#E7E5E0] pt-4">
                  <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                    Key Highlights
                  </h3>
                  <ul className="space-y-1.5 text-xs text-neutral-600">
                    {product.highlights.filter(h => Boolean(h && h.trim())).map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specifications Table */}
              {product.specs && Object.keys(product.specs).length > 0 && Object.values(product.specs).some(v => Boolean(v && String(v).trim())) && (
                <div className="mt-4 border-t border-[#E7E5E0] pt-4">
                  <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                    Specifications
                  </h3>
                  <div className="bg-[#F7F6F2] rounded-xl p-3 divide-y divide-[#E7E5E0] text-xs">
                    {Object.entries(product.specs).filter(([_, v]) => Boolean(v && String(v).trim())).map(([k, v]) => (
                      <div key={k} className="py-1.5 flex justify-between gap-4">
                        <span className="text-neutral-500 font-medium">{k}</span>
                        <span className="text-[#171717] font-semibold text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="mt-8 pt-4 border-t border-[#E7E5E0]">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className={`w-full sm:flex-1 py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-neutral-300 transition-all ${
                    isOutOfStock
                      ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                      : 'bg-white hover:bg-neutral-50 text-[#171717] hover:border-[#171717] active:scale-98 shadow-xs'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-neutral-600" />
                  <span>
                    {isOutOfStock
                      ? 'Item Sold Out'
                      : `Add to Cart • ${formatCurrency(currentPrice * quantity)}`}
                  </span>
                </button>

                {/* Instant Checkout / Buy Now Button */}
                <button
                  onClick={() => {
                    if (isOutOfStock) return;
                    if (product.variants && product.variants.length > 0 && !selectedVariant) {
                      setVariantError(true);
                      return;
                    }
                    if (onDirectBuy) {
                      onDirectBuy(product, selectedVariant, quantity);
                    } else {
                      handleAddToCart();
                    }
                  }}
                  disabled={isOutOfStock}
                  className={`w-full sm:flex-1 py-3.5 px-6 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                    isOutOfStock
                      ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                      : 'bg-[#171717] text-white hover:bg-[#C9A44C] hover:text-[#171717] active:scale-98'
                  }`}
                  title="Direct Instant Checkout"
                >
                  <Zap className="w-4 h-4 text-[#C9A44C] fill-[#C9A44C]" />
                  <span>⚡ Instant Buy Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
