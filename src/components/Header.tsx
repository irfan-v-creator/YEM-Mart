import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Heart, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  SlidersHorizontal,
  X,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  PackageCheck
} from 'lucide-react';
import { Product, Category, StoreSettings } from '../types';
import { formatCurrency } from '../utils/formatters';

interface HeaderProps {
  settings: StoreSettings;
  products: Product[];
  selectedCategory: Category | 'All';
  onSelectCategory: (cat: Category | 'All') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProduct: (product: Product) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  wishlistCount: number;
  onOpenWishlist: () => void;
  onOpenChat: () => void;
  onOpenTracking: () => void;
  isAdminOpen?: boolean;
  onToggleAdmin?: () => void;
  onScrollToShop: () => void;
}

const CATEGORIES: Category[] = [
  'Fashion',
  'Accessories',
  'Electronics',
  'Home & Kitchen',
  'Stationery',
  'Kids',
  'Gifts',
  'Others'
];

export const Header: React.FC<HeaderProps> = ({
  settings,
  products,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onOpenProduct,
  cartCount,
  cartTotal,
  onOpenCart,
  wishlistCount,
  onOpenWishlist,
  onOpenChat,
  onOpenTracking,
  onScrollToShop
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = searchQuery.trim()
    ? products.filter(p => {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q))
        );
      }).slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-40 bg-[#F7F6F2]/95 backdrop-blur-md border-b border-[#E7E5E0]">
      {/* Top Announcement & Quick Tools Bar */}
      <div className="bg-[#171717] text-white text-xs px-4 py-1.5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%]">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C9A44C] animate-pulse"></span>
          <span className="text-[#E7E5E0] font-medium truncate">{settings.announcementText}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTracking}
            className="flex items-center gap-1.5 text-[#E7E5E0] hover:text-[#C9A44C] transition-colors"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Track Order</span>
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => onSelectCategory('All')}>
          <div className="w-10 h-10 rounded-xl bg-[#171717] flex items-center justify-center text-white font-extrabold text-xl shadow-sm border border-[#C9A44C]/30">
            <span className="text-[#C9A44C]">Y</span>M
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#171717]">YEM MART</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A44C] mt-1"></span>
            </div>
            <span className="text-[10px] tracking-widest uppercase font-semibold text-neutral-500 -mt-1">
              {settings.tagline}
            </span>
          </div>
        </div>

        {/* Live Search Bar with Suggestions */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-2 hidden md:block">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search fashion, electronics, home essentials in Kerala..."
              className="w-full pl-10 pr-9 py-2 bg-white rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] focus:ring-2 focus:ring-[#C9A44C]/20 text-sm outline-none transition-all placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-[#E7E5E0] py-2 z-50 overflow-hidden">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex justify-between items-center">
                <span>Matching Products</span>
                <span>{searchResults.length} found</span>
              </div>
              {searchResults.length > 0 ? (
                <div className="divide-y divide-[#F7F6F2]">
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => {
                        onOpenProduct(prod);
                        setIsSearchFocused(false);
                      }}
                      className="px-3 py-2 flex items-center gap-3 hover:bg-[#F7F6F2] cursor-pointer transition-colors"
                    >
                      <img
                        src={prod.mainImage}
                        alt={prod.name}
                        className="w-10 h-10 object-contain rounded bg-[#F7F6F2] p-1 border border-neutral-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#171717] truncate">{prod.name}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>{prod.brand}</span>
                          <span>•</span>
                          <span className="text-[#C9A44C] font-semibold">{formatCurrency(prod.price)}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-neutral-500">
                  <p>No products matching "{searchQuery}"</p>
                  <p className="text-xs text-neutral-400 mt-1">Try searching by category like Linen, Earbuds, or Dosa Tawa</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Gemini AI Assistant Button */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-[#C9A44C]/30 hover:bg-[#C9A44C]/10 text-xs sm:text-sm font-medium transition-colors shadow-2xs"
            title="Ask YEM Concierge with Google Search Grounding"
          >
            <Sparkles className="w-4 h-4 text-[#C9A44C]" />
            <span className="hidden sm:inline">AI Concierge</span>
          </button>

          {/* Wishlist Button */}
          <button
            onClick={onOpenWishlist}
            className="relative p-2 rounded-xl text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            title="Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C9A44C] text-[#171717] font-bold text-[11px] rounded-full flex items-center justify-center border-2 border-[#F7F6F2]">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2.5 px-3 sm:px-4 py-2 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-all shadow-sm active:scale-95"
            title="View Cart"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-[#C9A44C]" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#C9A44C] text-[#171717] font-extrabold text-[10px] rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none text-left">
              <span className="text-[10px] text-neutral-300 font-medium">Cart</span>
              <span className="text-xs font-bold text-white">{formatCurrency(cartTotal)}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="px-4 pb-2.5 md:hidden">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search items in Kerala..."
            className="w-full pl-10 pr-8 py-1.5 bg-white rounded-xl border border-[#E7E5E0] text-sm outline-none focus:border-[#C9A44C]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 text-neutral-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="border-t border-[#E7E5E0] bg-white/70 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap">
          <button
            onClick={() => {
              onSelectCategory('All');
              onScrollToShop();
            }}
            className={`px-3 py-1 rounded-full font-medium transition-all ${
              selectedCategory === 'All'
                ? 'bg-[#171717] text-white shadow-xs'
                : 'bg-transparent text-neutral-600 hover:text-black hover:bg-neutral-100'
            }`}
          >
            All Products
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                onSelectCategory(cat);
                onScrollToShop();
              }}
              className={`px-3 py-1 rounded-full font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'bg-transparent text-neutral-600 hover:text-black hover:bg-neutral-100'
              }`}
            >
              {cat}
            </button>
          ))}
          <div className="ml-auto pl-2 flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
            <MapPin className="w-3 h-3 text-[#C9A44C]" />
            <span>Serving All 14 Districts of Kerala</span>
          </div>
        </div>
      </div>
    </header>
  );
};
