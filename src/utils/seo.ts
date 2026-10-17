import { Category, Product } from '../types';

export const CATEGORY_SLUG_MAP: Record<Category, string> = {
  'Fashion': 'fashion',
  'Accessories': 'accessories',
  'Electronics': 'electronics',
  'Home & Kitchen': 'home-kitchen',
  'Stationery': 'stationery',
  'Kids': 'kids',
  'Gifts': 'gifts',
  'Others': 'others',
};

export const SLUG_TO_CATEGORY_MAP: Record<string, Category> = {
  'fashion': 'Fashion',
  'accessories': 'Accessories',
  'electronics': 'Electronics',
  'home-kitchen': 'Home & Kitchen',
  'home-and-kitchen': 'Home & Kitchen',
  'stationery': 'Stationery',
  'kids': 'Kids',
  'gifts': 'Gifts',
  'others': 'Others',
};

export function categoryToSlug(category: Category | 'All'): string {
  if (category === 'All') return '';
  return CATEGORY_SLUG_MAP[category] || category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function slugToCategory(slug: string): Category | 'All' {
  if (!slug || slug === 'all') return 'All';
  const clean = slug.toLowerCase().trim();
  return SLUG_TO_CATEGORY_MAP[clean] || 'All';
}

export interface SeoMetaParams {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
  siteName?: string;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&h=630&q=80';
const DEFAULT_SITE_NAME = 'YEM MART';

/**
 * Dynamically updates document title and Open Graph / Twitter Card meta tags in DOM.
 */
export function updateDynamicMetaTags(params: SeoMetaParams): void {
  if (typeof document === 'undefined') return;

  const {
    title,
    description,
    keywords = 'Kerala Online Shopping, Authentic Kerala Spices, Traditional Handloom, Nilavilakku, Kerala Gifts, Fast Courier Kerala, YEM MART',
    image = DEFAULT_IMAGE,
    url = typeof window !== 'undefined' ? window.location.href : '',
    type = 'website',
    siteName = DEFAULT_SITE_NAME,
  } = params;

  // 1. Page Title
  document.title = title;

  // Helper to get or create a meta tag
  const setMeta = (attributeName: 'name' | 'property', attrValue: string, contentValue: string) => {
    let el = document.querySelector(`meta[${attributeName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attributeName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentValue);
  };

  // Helper to set link tags (e.g. canonical)
  const setLink = (rel: string, hrefValue: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', hrefValue);
  };

  // 2. Standard Meta
  setMeta('name', 'description', description);
  setMeta('name', 'keywords', keywords);

  // 3. Open Graph
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:site_name', siteName);

  // 4. Twitter Cards
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  // 5. Canonical Link
  if (url) {
    setLink('canonical', url);
  }
}

/**
 * Generates dynamic XML Sitemap string for all store pages, categories, and products.
 */
export function generateSitemapXml(baseUrl: string, products: Product[]): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const now = new Date().toISOString().split('T')[0];

  const categoryEntries = (Object.keys(CATEGORY_SLUG_MAP) as Category[]).map((cat) => {
    const slug = CATEGORY_SLUG_MAP[cat];
    return `  <url>
    <loc>${cleanBase}/category/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  const productEntries = products.map((prod) => {
    return `  <url>
    <loc>${cleanBase}/product/${prod.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${cleanBase}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${categoryEntries}
${productEntries}
</urlset>`;
}

/**
 * Generates standard robots.txt content with dynamic Sitemap directive.
 */
export function generateRobotsTxt(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `# YEM MART Search Engine Directives
User-agent: *
Allow: /
Allow: /product/
Allow: /category/
Allow: /sitemap.xml
Disallow: /api/admin/
Disallow: /admin

# Dynamic XML Sitemap
Sitemap: ${cleanBase}/sitemap.xml
`;
}
