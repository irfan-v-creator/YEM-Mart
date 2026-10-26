/**
 * SKU Generation and Validation Utilities
 * Formats: YM-<PREFIX>-<NUM>
 * Sequential, unique, category-driven SKU management.
 */

export const CATEGORY_SKU_PREFIXES: Record<string, string> = {
  Fashion: 'FSH',
  Accessories: 'ACC',
  Electronics: 'ELE',
  'Home & Kitchen': 'HMK',
  Stationery: 'STN',
  Kids: 'KID',
  Gifts: 'GFT',
  Others: 'OTH',
};

export function getCategorySkuPrefix(category?: string | null): string {
  if (!category) return 'OTH';
  const clean = category.trim();
  if (CATEGORY_SKU_PREFIXES[clean]) return CATEGORY_SKU_PREFIXES[clean];
  const lower = clean.toLowerCase();
  for (const [catName, prefix] of Object.entries(CATEGORY_SKU_PREFIXES)) {
    if (catName.toLowerCase() === lower) return prefix;
  }
  return 'OTH';
}

/**
 * Generates the next sequential unique SKU for a given category.
 * Scans all existing products and variants to determine the highest existing numeric suffix.
 * Always returns format: YM-<PREFIX>-<NUM> (e.g. YM-ACC-001, YM-FSH-233)
 */
export function generateNextSku(
  category: string,
  existingProducts: Array<{ sku?: string; variants?: Array<{ sku?: string }> }> = []
): string {
  const prefix = getCategorySkuPrefix(category);
  const existingSkus = new Set<string>();

  for (const p of existingProducts) {
    if (p.sku) existingSkus.add(p.sku.trim().toUpperCase());
    if (Array.isArray(p.variants)) {
      for (const v of p.variants) {
        if (v.sku) existingSkus.add(v.sku.trim().toUpperCase());
      }
    }
  }

  // Find all existing numeric suffixes matching YM-{prefix}-{NUM}
  const prefixRegex = new RegExp(`^YM-${prefix}-(\\d+)$`, 'i');
  let maxNum = 0;
  for (const sku of existingSkus) {
    const match = sku.match(prefixRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum > 0 ? maxNum + 1 : 1;
  let candidate = `YM-${prefix}-${String(nextNum).padStart(3, '0')}`;
  while (existingSkus.has(candidate.toUpperCase())) {
    nextNum++;
    candidate = `YM-${prefix}-${String(nextNum).padStart(3, '0')}`;
  }
  return candidate;
}

/**
 * Validates SKU format:
 * Must be non-empty, alphanumeric with dashes/underscores, uppercase recommended.
 */
export function isValidSku(sku?: string | null): boolean {
  if (!sku || typeof sku !== 'string') return false;
  const clean = sku.trim();
  return /^[A-Z0-9_-]{3,30}$/i.test(clean);
}
