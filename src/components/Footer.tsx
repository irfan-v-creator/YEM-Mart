import React from 'react';
import { 
  ShieldCheck, 
  Truck, 
  MessageCircle, 
  MapPin, 
  ExternalLink,
  PackageCheck,
  Heart
} from 'lucide-react';
import { StoreSettings, Category } from '../types';
import { formatWhatsAppUrl } from '../utils/formatters';

interface FooterProps {
  settings: StoreSettings;
  onSelectCategory: (category: Category | 'All') => void;
  onOpenTracking: () => void;
  onOpenWishlist: () => void;
  onToggleAdmin?: () => void;
}

const CATEGORIES: Category[] = [
  'Fashion',
  'Accessories',
  'Electronics',
  'Home & Kitchen',
  'Stationery',
  'Kids',
  'Gifts',
  'Others',
];

export const Footer: React.FC<FooterProps> = ({
  settings,
  onSelectCategory,
  onOpenTracking,
  onOpenWishlist,
}) => {
  return (
    <footer className="bg-[#171717] text-white mt-16 border-t border-neutral-800">
      {/* Top Value Banner */}
      <div className="border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-800 text-[#C9A44C] shrink-0 border border-neutral-700">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Statewide Kerala Fulfillment</h4>
              <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                Prompt dispatch across all 14 districts: Ernakulam, Trivandrum, Kozhikode, Thrissur, Kannur, and beyond. Free shipping on orders over ₹999.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-800 text-green-400 shrink-0 border border-neutral-700">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Transparent WhatsApp Workflow</h4>
              <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                Cart review generates a distinct Order ID with an itemized message for you to review and send directly on WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-800 text-emerald-400 shrink-0 border border-neutral-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">100% Genuine Quality Guarantee</h4>
              <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                No fake stock, no artificially inflated countdowns, and no unverified claims. Authentic products with verified specifications.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C9A44C] text-[#171717] font-black flex items-center justify-center text-base">
              YM
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white">{settings.storeName}</span>
              <span className="block text-[10px] tracking-widest uppercase font-semibold text-[#C9A44C] -mt-1">
                {settings.tagline}
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Your everyday digital retail store tailored for Kerala. Curated ethnic fashion, reliable electronics, authentic cast iron kitchenware, and thoughtful gifts.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <MapPin className="w-4 h-4 text-[#C9A44C]" />
            <span>Operations Hub: {settings.officeCity}</span>
          </div>
        </div>

        {/* Categories Directory */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A44C] mb-3">
            Explore Categories
          </h4>
          <ul className="space-y-2 text-xs text-neutral-400">
            {CATEGORIES.map((cat) => (
              <li key={cat}>
                <button
                  onClick={() => onSelectCategory(cat)}
                  className="hover:text-white transition-colors"
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Customer Quick Links */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A44C] mb-3">
            Customer Services
          </h4>
          <ul className="space-y-2 text-xs text-neutral-400">
            <li>
              <button onClick={onOpenTracking} className="hover:text-white transition-colors flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Track Order Status</span>
              </button>
            </li>
            <li>
              <button onClick={onOpenWishlist} className="hover:text-white transition-colors flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                <span>Saved Wishlist Items</span>
              </button>
            </li>
            <li>
              <span className="text-neutral-500">Shipping Policy: Flat ₹49 / Free over ₹999</span>
            </li>
            <li>
              <span className="text-neutral-500">Payments: UPI (GPay / PhonePe / Paytm / BHIM)</span>
            </li>
            <li>
              <span className="text-neutral-500 text-[11px]">*Official return policy pending merchant finalization</span>
            </li>
          </ul>
        </div>

        {/* Operations & WhatsApp Support */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A44C] mb-3">
            Direct Assistance
          </h4>
          <div className="bg-neutral-800/80 p-4 rounded-2xl border border-neutral-700 space-y-2.5 text-xs">
            <p className="text-neutral-300 font-medium">
              Need personal assistance or custom bulk orders?
            </p>
            <a
              href={formatWhatsAppUrl(settings.whatsappNumber, 'Hello YEM MART, I have an inquiry')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs transition-colors w-full justify-center"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
            <p className="text-[10px] text-neutral-400 text-center">
              Available 9:00 AM – 8:00 PM IST (Mon – Sat)
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Copyright & Disclaimer */}
      <div className="border-t border-neutral-800/80 bg-black/40 py-4 px-4 text-center text-[11px] text-neutral-500">
        <p>© 2026 {settings.storeName}. All rights reserved. Built with precision for Kerala, India.</p>
        <p className="mt-0.5 text-neutral-600 text-[10px]">
          Target launch: 15 October 2026 • Verified catalog with zero fake countdowns or unverified claims.
        </p>
      </div>
    </footer>
  );
};
