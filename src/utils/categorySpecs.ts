import { Category } from '../types';

export interface CategorySpecField {
  key: string;
  label: string;
  placeholder: string;
  helperText?: string;
}

/**
 * Category-aware suggested specification fields.
 * These are suggested, truthful field prompts, never mandatory claims.
 */
export const CATEGORY_SUGGESTED_SPECS: Record<Category, CategorySpecField[]> = {
  Fashion: [
    { key: 'Material', label: 'Material / Fabric', placeholder: 'e.g. 100% Organic Handloom Cotton' },
    { key: 'Size', label: 'Size / Fit Specs', placeholder: 'e.g. Regular Fit, Chest 40 in, Length 29 in' },
    { key: 'Fit', label: 'Fit Type', placeholder: 'e.g. Relaxed Comfort Fit / Tailored / Regular' },
    { key: 'Care', label: 'Care Instructions', placeholder: 'e.g. Gentle cold machine wash, dry in shade' },
  ],
  Accessories: [
    { key: 'Material', label: 'Material', placeholder: 'e.g. Top-Grain Vegetable Tanned Leather / Brass' },
    { key: 'Dimensions', label: 'Dimensions', placeholder: 'e.g. 11.5 cm x 9.5 cm x 1.5 cm' },
    { key: 'Colour', label: 'Colour / Finish', placeholder: 'e.g. Vintage Tan Brown / Matte Black' },
    { key: 'Care', label: 'Care Instructions', placeholder: 'e.g. Wipe clean with soft dry cloth' },
  ],
  Electronics: [
    { key: 'Brand', label: 'Brand & Model', placeholder: 'e.g. SonicWave ANC-400' },
    { key: 'Model', label: 'Model Number', placeholder: 'e.g. SW-ANC-01' },
    { key: 'Supported Features', label: 'Supported Features', placeholder: 'e.g. Active Noise Cancellation, Bluetooth 5.3' },
    { key: 'Power Requirements', label: 'Power Requirements / Battery', placeholder: 'e.g. Type-C Fast Charge, 32-Hour Battery Life' },
    { key: 'Warranty', label: 'Manufacturer Warranty', placeholder: 'e.g. 1 Year Manufacturer Replacement Guarantee' },
  ],
  'Home & Kitchen': [
    { key: 'Material', label: 'Material', placeholder: 'e.g. Pre-Seasoned Heavy Cast Iron / Pure Copper' },
    { key: 'Dimensions', label: 'Dimensions', placeholder: 'e.g. 11-inch Diameter x 4.5 cm Depth' },
    { key: 'Capacity', label: 'Capacity / Volume', placeholder: 'e.g. 950 ml / 2.5 Litres' },
    { key: 'Care', label: 'Care Instructions', placeholder: 'e.g. Hand wash with mild soap, dry immediately & lightly oil' },
  ],
  Stationery: [
    { key: 'Product Type', label: 'Product Type / Binding', placeholder: 'e.g. Hardcover Thread-Bound Journal' },
    { key: 'Material', label: 'Paper & Material', placeholder: 'e.g. 100 GSM Acid-Free Handmade Recycled Paper' },
    { key: 'Dimensions', label: 'Page Size / Dimensions', placeholder: 'e.g. A5 (14.8 cm x 21 cm), 192 Pages' },
    { key: 'Pack Quantity', label: 'Pack Quantity', placeholder: 'e.g. Set of 3 Pens / Single Notebook' },
  ],
  Kids: [
    { key: 'Age Suitability', label: 'Age Suitability', placeholder: 'e.g. Suitable for ages 3 years and above' },
    { key: 'Material', label: 'Material', placeholder: 'e.g. Natural Ivory Wood & Non-Toxic Organic Dyes' },
    { key: 'Dimensions', label: 'Dimensions / Weight', placeholder: 'e.g. 24 cm x 18 cm x 2 cm, 380g' },
    { key: 'Safety Information', label: 'Verified Safety Information', placeholder: 'e.g. Smooth rounded edges, EN-71 / BIS Certified Non-Toxic' },
  ],
  Gifts: [
    { key: 'Contents', label: 'Contents / Pieces Included', placeholder: 'e.g. 1 Hand-Carved Urli, 2 Brass Diyas, Incense pack' },
    { key: 'Material', label: 'Primary Material', placeholder: 'e.g. Hand-Cast Brass Bell Metal / Teak Wood' },
    { key: 'Dimensions', label: 'Dimensions', placeholder: 'e.g. 25 cm diameter x 8 cm height' },
    { key: 'Packaging', label: 'Gift Packaging', placeholder: 'e.g. Festive Gold Foil Rigid Gift Box with Satin Ribbon' },
  ],
  Others: [
    { key: 'Material', label: 'Material / Ingredients', placeholder: 'e.g. Certified Organic Essential Oils & Aqua' },
    { key: 'Dimensions', label: 'Dimensions / Volume / Weight', placeholder: 'e.g. 250 ml / 40 Cones / 500g' },
    { key: 'Origin', label: 'Country / State of Origin', placeholder: 'e.g. Kerala, India' },
    { key: 'Care', label: 'Storage & Usage', placeholder: 'e.g. Store in a cool, dry place away from direct sunlight' },
  ],
};

/**
 * Cleans a specs record:
 * Filters out empty keys or empty values, trims whitespace.
 */
export function sanitizeSpecs(specs?: Record<string, string> | null): Record<string, string> {
  if (!specs || typeof specs !== 'object') return {};
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    const trimmedKey = k ? k.trim() : '';
    const trimmedVal = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
    if (trimmedKey && trimmedVal) {
      cleaned[trimmedKey] = trimmedVal;
    }
  }
  return cleaned;
}

/**
 * Cleans a highlights array:
 * Filters out empty strings, duplicates, and trims whitespace.
 */
export function sanitizeHighlights(highlights?: string[] | null): string[] {
  if (!Array.isArray(highlights)) return [];
  const unique = new Set<string>();
  const result: string[] = [];
  for (const h of highlights) {
    if (typeof h === 'string') {
      const trimmed = h.trim();
      if (trimmed && !unique.has(trimmed)) {
        unique.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  return result;
}
