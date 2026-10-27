import React from 'react';
import { Check, ShieldCheck, Sparkles, Layers, ListFilter } from 'lucide-react';
import { Product } from '../types';

interface ProductHighlightsAndSpecsProps {
  product: Pick<Product, 'highlights' | 'specs' | 'category' | 'name' | 'brand'>;
  className?: string;
  showCardContainer?: boolean;
}

export const ProductHighlightsAndSpecs: React.FC<ProductHighlightsAndSpecsProps> = ({
  product,
  className = '',
  showCardContainer = false,
}) => {
  const highlights = Array.isArray(product.highlights)
    ? product.highlights.filter((h) => typeof h === 'string' && h.trim().length > 0)
    : [];

  const rawSpecs = product.specs && typeof product.specs === 'object' ? product.specs : {};
  const specsEntries = Object.entries(rawSpecs).filter(
    ([k, v]) => k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0
  );

  const hasHighlights = highlights.length > 0;
  const hasSpecs = specsEntries.length > 0;

  // If both are empty, render nothing — never show fake example text
  if (!hasHighlights && !hasSpecs) {
    return null;
  }

  const content = (
    <div className={`space-y-6 ${className}`}>
      {/* Key Highlights Section */}
      {hasHighlights && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A44C]" />
              <span>Key Highlights</span>
            </h3>
            <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
              {highlights.length} {highlights.length === 1 ? 'Feature' : 'Features'}
            </span>
          </div>

          <ul className="space-y-2 text-xs text-neutral-700">
            {highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F7F6F2]/70 border border-[#E7E5E0]/60 transition-colors hover:bg-[#F7F6F2]"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                  <Check className="w-2.5 h-2.5 text-emerald-700 stroke-[3]" />
                </div>
                <span className="leading-relaxed font-medium">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Specifications Section */}
      {hasSpecs && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C9A44C]" />
              <span>Product Specifications</span>
            </h3>
            {product.category && (
              <span className="text-[10px] font-semibold text-[#171717] bg-[#C9A44C]/20 border border-[#C9A44C]/40 px-2 py-0.5 rounded-full">
                {product.category}
              </span>
            )}
          </div>

          <div className="bg-[#F7F6F2] rounded-2xl p-3 sm:p-4 border border-[#E7E5E0] shadow-2xs divide-y divide-[#E7E5E0]/80">
            {specsEntries.map(([key, value], idx) => (
              <div
                key={idx}
                className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 text-xs"
              >
                <span className="text-neutral-500 font-medium shrink-0 max-w-[45%]">
                  {key}
                </span>
                <span className="text-[#171717] font-semibold sm:text-right break-words">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (showCardContainer) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-[#E7E5E0] shadow-xs">
        {content}
      </div>
    );
  }

  return content;
};
