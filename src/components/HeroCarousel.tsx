import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, ShieldCheck, Truck, MessageCircle } from 'lucide-react';
import { HeroBanner, Category } from '../types';

interface HeroCarouselProps {
  banners: HeroBanner[];
  onSelectCategory: (category: Category | 'All') => void;
  onOpenChat: () => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  banners,
  onSelectCategory,
  onOpenChat,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!banners || banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === banners.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Hero Card */}
      <div className="relative rounded-2xl overflow-hidden bg-[#171717] text-white shadow-lg min-h-[320px] sm:min-h-[380px] flex flex-col justify-between border border-neutral-800">
        {/* Background Image with Ambient Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentBanner.image}
            alt={currentBanner.title}
            className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#171717] via-[#171717]/90 to-transparent" />
        </div>

        {/* Content Area */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12 max-w-2xl flex flex-col justify-center my-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A44C]/20 border border-[#C9A44C]/40 text-[#C9A44C] text-xs font-semibold uppercase tracking-wider mb-4 w-max">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{currentBanner.badge}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {currentBanner.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-neutral-300 leading-relaxed max-w-xl">
            {currentBanner.subtitle}
          </p>

          {/* Action Buttons */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectCategory(currentBanner.categoryFilter || 'All')}
              className="px-5 py-2.5 rounded-xl bg-[#C9A44C] text-[#171717] font-bold text-sm hover:bg-[#d8b55e] transition-all flex items-center gap-2 shadow-md active:scale-95"
            >
              <span>{currentBanner.ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenChat}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <span>Ask YEM Assistant</span>
            </button>
          </div>
        </div>

        {/* Carousel Navigation Arrows & Dots */}
        <div className="relative z-10 px-6 sm:px-10 pb-6 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  currentIndex === idx
                    ? 'w-8 bg-[#C9A44C]'
                    : 'w-2 bg-neutral-600 hover:bg-neutral-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-white border border-neutral-700 transition-colors"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trust Badges Grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm">
        <div className="bg-white p-3 rounded-xl border border-[#E7E5E0] flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 text-[#C9A44C]">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-[#171717]">Kerala-Wide Delivery</p>
            <p className="text-neutral-500 text-[11px]">Free delivery on orders ₹999+</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E7E5E0] flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-green-50 text-green-700">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-[#171717]">WhatsApp Ordering</p>
            <p className="text-neutral-500 text-[11px]">Direct chat & quick order confirmation</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E7E5E0] flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-[#171717]">100% Genuine Quality</p>
            <p className="text-neutral-500 text-[11px]">Zero fake stock, verified products</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#E7E5E0] flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-[#171717]">Instant UPI Verification</p>
            <p className="text-neutral-500 text-[11px]">GPay, PhonePe, Paytm supported</p>
          </div>
        </div>
      </div>
    </section>
  );
};
