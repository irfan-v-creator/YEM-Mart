import React from 'react';
import { Heart, Star, ShoppingBag, Eye, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ProductCardProps {
  product: Product;
  lowStockThreshold: number;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  lowStockThreshold,
  isWishlisted,
  onToggleWishlist,
  onOpenProduct,
  onAddToCart,
}) => {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= (product.lowStockThreshold || lowStockThreshold);
  const hasVariants = product.variants && product.variants.length > 0;

  return (
    <div className="group bg-white rounded-2xl border border-[#E7E5E0] hover:border-neutral-400 hover:shadow-md transition-all flex flex-col overflow-hidden relative">
      {/* Badges Bar (Top Left) */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
        {product.discountPercent && product.discountPercent > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-[#171717] text-[#C9A44C] text-[10px] font-bold uppercase tracking-wider shadow-xs">
            {product.discountPercent}% OFF
          </span>
        )}
        {product.isNewArrival && (
          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase">
            New
          </span>
        )}
        {isOutOfStock ? (
          <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-600 text-[10px] font-bold uppercase">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
            Only {product.stock} left!
          </span>
        ) : null}
      </div>

      {/* Wishlist Button (Top Right) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleWishlist(product);
        }}
        className={`absolute top-2.5 right-2.5 z-10 p-2 rounded-full backdrop-blur-md transition-all ${
          isWishlisted
            ? 'bg-red-50 text-red-600 shadow-sm'
            : 'bg-white/80 hover:bg-white text-neutral-500 hover:text-black shadow-2xs'
        }`}
        title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        aria-label="Wishlist"
      >
        <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-600' : ''}`} />
      </button>

      {/* Image Area - Square container with object-contain to avoid cropping */}
      <div
        onClick={() => onOpenProduct(product)}
        className="w-full aspect-square bg-[#F7F6F2] relative cursor-pointer overflow-hidden p-4 flex items-center justify-center border-b border-neutral-100"
      >
        <img
          src={product.mainImage}
          alt={product.name}
          className={`max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105 ${
            isOutOfStock ? 'opacity-50 grayscale' : ''
          }`}
          loading="lazy"
        />

        {/* Quick View Button on Hover */}
        <div className="absolute inset-0 bg-[#171717]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenProduct(product);
            }}
            className="pointer-events-auto px-3 py-1.5 rounded-xl bg-white text-[#171717] font-semibold text-xs shadow-md flex items-center gap-1.5 hover:bg-neutral-100"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Quick View</span>
          </button>
        </div>
      </div>

      {/* Card Info Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Category */}
          <div className="flex items-center justify-between text-xs text-neutral-400 font-medium mb-1">
            <span className="truncate max-w-[60%]">{product.brand}</span>
            <span className="text-[11px] text-neutral-500">{product.category}</span>
          </div>

          {/* Product Name */}
          <h3
            onClick={() => onOpenProduct(product)}
            className="text-sm font-semibold text-[#171717] group-hover:text-[#C9A44C] transition-colors line-clamp-2 cursor-pointer leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Genuine Rating */}
          {product.rating && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                <Star className="w-3 h-3 fill-emerald-700 text-emerald-700" />
                <span>{product.rating.toFixed(1)}</span>
              </div>
              {product.reviewCount && (
                <span className="text-neutral-400 text-[11px]">({product.reviewCount} verified)</span>
              )}
            </div>
          )}
        </div>

        {/* Price & Add to Cart Action */}
        <div className="mt-4 pt-3 border-t border-[#F7F6F2] flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-extrabold text-[#171717]">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-neutral-400 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
            </div>
            {hasVariants && (
              <p className="text-[10px] text-neutral-400 font-medium">Multiple options</p>
            )}
          </div>

          {/* Add / Select CTA */}
          <button
            onClick={() => {
              if (hasVariants) {
                onOpenProduct(product);
              } else {
                onAddToCart(product);
              }
            }}
            disabled={isOutOfStock}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
              isOutOfStock
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : 'bg-[#171717] text-white hover:bg-[#C9A44C] hover:text-[#171717] active:scale-95'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isOutOfStock ? 'Sold Out' : hasVariants ? 'Select Options' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
