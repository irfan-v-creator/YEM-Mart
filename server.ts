import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import * as argon2 from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { store } from './server/store.js';
import { isSupabaseConfigured, getSupabaseClient } from './server/supabase.js';
import type { Product, Category, SavedAddress } from './src/types/index.js';
import { CATEGORY_SUGGESTED_SPECS } from './src/utils/categorySpecs.js';
import { ALL_KERALA_DISTRICTS, isKeralaPincode } from './src/data/initialData.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let viteDevServer: any = null;

const app = express();

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Non-browser / same-origin requests
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'yemmart.in' || host.endsWith('.yemmart.in')) return true;
    if (host.endsWith('.vercel.app')) return true;
    if (host.endsWith('.run.app')) return true;
    if (process.env.APP_URL) {
      const appUrl = new URL(process.env.APP_URL);
      if (appUrl.hostname.toLowerCase() === host) return true;
    }
  } catch {}
  return false;
}

// Enable CORS and Preflight with strict origin allow-list
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isOriginAllowed(origin);

  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-actor, x-admin-token, Accept');

  if (req.method === 'OPTIONS') {
    if (!allowed && origin) {
      return res.status(403).json({ error: 'Origin not allowed by CORS' });
    }
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- DYNAMIC SEO SITEMAP & ROBOTS DIRECTIVES ---
const STORE_CATEGORIES = [
  'fashion',
  'accessories',
  'electronics',
  'home-kitchen',
  'stationery',
  'kids',
  'gifts',
  'others',
];

app.get('/sitemap.xml', (req, res) => {
  const host = req.get('host') || 'yemmart.in';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const now = new Date().toISOString().split('T')[0];

  const products = store.getProducts({ isAdmin: false });

  const categoryEntries = STORE_CATEGORIES.map((slug) => `  <url>
    <loc>${baseUrl}/category/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');

  const productEntries = products.map((prod) => `  <url>
    <loc>${baseUrl}/product/${prod.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${categoryEntries}
${productEntries}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemapXml);
});

app.get('/robots.txt', (req, res) => {
  const host = req.get('host') || 'yemmart.in';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  const robotsTxt = `# YEM MART Search Engine Directives
User-agent: *
Allow: /
Allow: /product/
Allow: /category/
Allow: /sitemap.xml
Disallow: /api/admin/
Disallow: /admin

# Dynamic XML Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getBaseIndexHtml(): { html: string; isSource: boolean } {
  const isProd = process.env.NODE_ENV === 'production';
  const distPaths = [
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
  ];
  const srcPaths = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];

  const searchOrder = isProd ? [...distPaths, ...srcPaths] : [...srcPaths, ...distPaths];
  for (const candidate of searchOrder) {
    if (fs.existsSync(candidate)) {
      try {
        return {
          html: fs.readFileSync(candidate, 'utf-8'),
          isSource: !candidate.includes('dist'),
        };
      } catch {}
    }
  }
  return { html: '', isSource: false };
}

// Helper to inject clean, high-priority Open Graph, Twitter & Schema.org tags into HTML
function injectSeoMetaTags(html: string, tags: {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  type?: string;
  siteName?: string;
  keywords?: string;
  jsonLd?: object;
}): string {
  // Strip existing titles, descriptions, og, twitter, and canonical links to avoid duplicate or conflicting tags
  html = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
  html = html.replace(/<meta\s+name=["'](description|keywords)["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');

  const safeTitle = escapeHtmlText(tags.title);
  const safeAttrTitle = escapeHtmlAttr(tags.title);
  const safeDesc = escapeHtmlAttr(tags.description);
  const safeUrl = escapeHtmlAttr(tags.url);
  const safeImg = escapeHtmlAttr(tags.imageUrl);
  const safeSiteName = escapeHtmlAttr(tags.siteName || 'YEM MART');
  const safeKeywords = tags.keywords ? `<meta name="keywords" content="${escapeHtmlAttr(tags.keywords)}" />` : '';

  const metaBlock = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    ${safeKeywords}
    <link rel="canonical" href="${safeUrl}" />

    <!-- Open Graph / WhatsApp / Facebook Preview -->
    <meta property="og:type" content="${tags.type || 'website'}" />
    <meta property="og:site_name" content="${safeSiteName}" />
    <meta property="og:title" content="${safeAttrTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${safeAttrTitle}" />

    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeAttrTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
    <meta name="twitter:image:alt" content="${safeAttrTitle}" />
    ${tags.jsonLd ? `<script type="application/ld+json">${JSON.stringify(tags.jsonLd)}</script>` : ''}
  `;

  return html.replace(/<head>/i, `<head>${metaBlock}`);
}

// Dedicated express route handler for /product/:id with full Supabase/Store lookup & absolute OG meta tags
async function handleProductSeoRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  const rawId = (req.params.id || '').split('/')[0];
  const prodId = decodeURIComponent(rawId).trim();
  if (!prodId) return next();

  try {
    // 1. Fetch from Store in-memory cache
    let product: Product | undefined = store.getProductById(prodId);

    // 2. Fallback to Supabase if available and not found in memory
    if (!product && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase
            .from('products')
            .select('*')
            .or(`id.eq.${prodId},sku.eq.${prodId}`)
            .maybeSingle();

          if (data) {
            product = {
              id: data.id,
              name: data.name,
              brand: data.brand || 'YEM MART',
              category: data.category || 'Others',
              description: data.description || '',
              shortSummary: data.short_summary || '',
              highlights: data.highlights || [],
              specs: data.specs || {},
              price: Number(data.price),
              originalPrice: data.original_price ? Number(data.original_price) : undefined,
              discountPercent: data.discount_percent,
              rating: data.rating ? Number(data.rating) : 4.5,
              reviewCount: data.review_count || 12,
              images: data.images || [],
              mainImage: data.main_image || (data.images && data.images[0]) || '',
              status: data.status || 'published',
              stock: Number(data.stock ?? 10),
              lowStockThreshold: data.low_stock_threshold ?? 5,
              sku: data.sku || data.id,
              tags: data.tags || [],
              variants: data.variants || [],
            } as Product;
          }
        }
      } catch (dbErr) {
        console.warn('Supabase product query error for SEO route:', dbErr);
      }
    }

    if (!product) {
      return next();
    }

    // Determine absolute base URL
    const host = req.get('x-forwarded-host') || req.get('host') || 'yemmart.in';
    const protocol = req.get('x-forwarded-proto') === 'https' || req.protocol === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const pageUrl = `${baseUrl}/product/${encodeURIComponent(product.id)}`;

    // Guarantee absolute image URL for WhatsApp / social preview scrapers
    let absoluteImageUrl = product.mainImage || (product.images && product.images[0]) || '';
    if (absoluteImageUrl) {
      if (absoluteImageUrl.startsWith('//')) {
        absoluteImageUrl = `https:${absoluteImageUrl}`;
      } else if (!absoluteImageUrl.startsWith('http://') && !absoluteImageUrl.startsWith('https://')) {
        absoluteImageUrl = `${baseUrl}${absoluteImageUrl.startsWith('/') ? '' : '/'}${absoluteImageUrl}`;
      }
    } else {
      absoluteImageUrl = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&h=630&q=80';
    }

    const title = `${product.name} - Buy Online for ₹${product.price.toLocaleString('en-IN')} | YEM MART Kerala`;
    const description = `Order authentic ${product.name} (${product.brand}) online at YEM MART. ${product.shortSummary || product.description.slice(0, 140)}. Fast Kerala express delivery across all 14 districts.`;

    const { html: rawHtml, isSource } = getBaseIndexHtml();
    if (!rawHtml) {
      return next();
    }

    let html = rawHtml;
    // In dev mode with Vite, transform with Vite plugins if dev server active
    if (isSource && viteDevServer) {
      try {
        html = await viteDevServer.transformIndexHtml(req.originalUrl || req.url, rawHtml);
      } catch {}
    }

    // Build Product Schema JSON-LD
    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: [absoluteImageUrl],
      description: product.description || product.shortSummary,
      sku: product.sku,
      brand: { '@type': 'Brand', name: product.brand },
      offers: {
        '@type': 'Offer',
        url: pageUrl,
        priceCurrency: 'INR',
        price: product.price,
        availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: 'YEM MART' },
      },
      aggregateRating: product.rating ? {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount || 5,
      } : undefined,
    };

    html = injectSeoMetaTags(html, {
      title,
      description,
      url: pageUrl,
      imageUrl: absoluteImageUrl,
      type: 'website',
      siteName: 'YEM MART',
      keywords: `${product.name}, ${product.brand}, ${product.category}, Kerala Online Shopping, YEM MART`,
      jsonLd: productSchema,
    });

    res.header('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Error in handleProductSeoRoute:', err);
    return next();
  }
}

// Dedicated express route handler for /category/:slug with absolute OG meta tags
async function handleCategorySeoRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  const rawSlug = (req.params.slug || '').split('/')[0];
  const slug = decodeURIComponent(rawSlug).trim();
  if (!slug) return next();

  try {
    const host = req.get('x-forwarded-host') || req.get('host') || 'yemmart.in';
    const protocol = req.get('x-forwarded-proto') === 'https' || req.protocol === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const pageUrl = `${baseUrl}/category/${encodeURIComponent(slug)}`;

    const catName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
    const title = `${catName} Collection - Authentic Kerala Online Shopping | YEM MART`;
    const description = `Discover handcrafted & curated ${catName} at YEM MART. Authentic Kerala products, guaranteed genuine stock, transparent pricing, and fast delivery across Kerala.`;
    const categoryImageUrl = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&h=630&q=80';

    const { html: rawHtml, isSource } = getBaseIndexHtml();
    if (!rawHtml) {
      return next();
    }

    let html = rawHtml;
    if (isSource && viteDevServer) {
      try {
        html = await viteDevServer.transformIndexHtml(req.originalUrl || req.url, rawHtml);
      } catch {}
    }

    html = injectSeoMetaTags(html, {
      title,
      description,
      url: pageUrl,
      imageUrl: categoryImageUrl,
      type: 'website',
      siteName: 'YEM MART',
      keywords: `${catName}, Kerala Shopping, Authentic Kerala Products, YEM MART`,
    });

    res.header('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Error in handleCategorySeoRoute:', err);
    return next();
  }
}

// Universal SEO dispatcher for production static serving and SPA fallback
async function renderSeoHtml(req: express.Request, res: express.Response, fallback: () => void) {
  const urlPath = req.path;
  const prodMatch = urlPath.match(/^\/product\/([^/?#]+)/i);
  if (prodMatch) {
    req.params = req.params || {};
    req.params.id = prodMatch[1];
    return handleProductSeoRoute(req, res, fallback as any);
  }
  const catMatch = urlPath.match(/^\/category\/([^/?#]+)/i);
  if (catMatch) {
    req.params = req.params || {};
    req.params.slug = catMatch[1];
    return handleCategorySeoRoute(req, res, fallback as any);
  }
  fallback();
}

app.get('/product/:id', handleProductSeoRoute);
app.get('/product/:id/*', handleProductSeoRoute);
app.get('/category/:slug', handleCategorySeoRoute);
app.get('/category/:slug/*', handleCategorySeoRoute);

// --- ADMIN AUTHENTICATION & SECURITY STATE ---
// Require ADMIN_PASSWORD_HASH (Argon2id or bcrypt) or legacy ADMIN_PASSWORD during migration, and ADMIN_AUTH_SECRET
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH || '').trim().replace(/^["']|["']$/g, '');
const LEGACY_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');
const AUTH_SECRET = (process.env.ADMIN_AUTH_SECRET || '').trim().replace(/^["']|["']$/g, '');
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

if (!ADMIN_PASSWORD_HASH && !LEGACY_ADMIN_PASSWORD) {
  console.warn('[SECURITY WARNING] Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is configured in environment. Admin authentication will fail closed.');
}
if (!AUTH_SECRET || AUTH_SECRET.length < 16) {
  console.warn('[SECURITY WARNING] ADMIN_AUTH_SECRET is not configured or too short (must be >= 16 chars). Admin authentication will fail closed.');
}

/**
 * Securely verifies submitted plain-text password against stored Argon2id or bcrypt hash.
 * Includes graceful fallback to legacy ADMIN_PASSWORD to prevent lockouts during migration.
 */
async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  if (!inputPassword || typeof inputPassword !== 'string') return false;
  const cleanInput = inputPassword.trim().replace(/^["']|["']$/g, '');
  if (!cleanInput) return false;

  // 1. Primary: Verify against Argon2id ($argon2id$) or bcrypt ($2a$, $2b$, $2y$) hash
  if (ADMIN_PASSWORD_HASH) {
    try {
      if (ADMIN_PASSWORD_HASH.startsWith('$argon2')) {
        return await argon2.verify(ADMIN_PASSWORD_HASH, cleanInput);
      }
      if (ADMIN_PASSWORD_HASH.startsWith('$2a$') || ADMIN_PASSWORD_HASH.startsWith('$2b$') || ADMIN_PASSWORD_HASH.startsWith('$2y$')) {
        return await bcrypt.compare(cleanInput, ADMIN_PASSWORD_HASH);
      }
      console.error('[SECURITY ERROR] ADMIN_PASSWORD_HASH format not recognized. Must be valid Argon2id ($argon2id$) or bcrypt ($2b$) string.');
      return false;
    } catch (err) {
      console.error('[SECURITY ERROR] Failed verifying password hash:', err);
      return false;
    }
  }

  // 2. Migration fallback: If ADMIN_PASSWORD_HASH not yet configured in environment, verify against legacy plain-text
  if (LEGACY_ADMIN_PASSWORD) {
    console.warn('[SECURITY NOTICE] Admin authenticated using legacy plain-text passkey. Please run `npm run hash-password` and configure ADMIN_PASSWORD_HASH in environment.');
    const inputBuf = Buffer.from(cleanInput);
    const passBuf = Buffer.from(LEGACY_ADMIN_PASSWORD);
    return inputBuf.length === passBuf.length && crypto.timingSafeEqual(inputBuf, passBuf);
  }

  return false;
}

interface AdminSession {
  token: string;
  role: 'owner' | 'manager' | 'fulfillment' | 'support';
  actorName: string;
  createdAt: number;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();
const revokedTokens = new Set<string>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(req: express.Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const parts = xff.split(',').map(p => p.trim());
    return parts[parts.length - 1] || req.ip || req.socket.remoteAddress || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function verifyAdminToken(token: string): AdminSession | null {
  if (!token) return null;
  const cleanToken = token.trim().replace(/^["']|["']$/g, '');

  // 1. Explicitly check if token has been revoked on logout
  if (revokedTokens.has(cleanToken)) {
    return null;
  }

  // 2. In-memory session lookup
  const memSession = adminSessions.get(cleanToken);
  if (memSession) {
    if (Date.now() > memSession.expiresAt) {
      adminSessions.delete(cleanToken);
      return null;
    }
    return memSession;
  }

  // 3. Stateless self-verifying signed token (requires valid AUTH_SECRET)
  if (!AUTH_SECRET || AUTH_SECRET.length < 16) {
    return null;
  }

  try {
    const parts = cleanToken.split('.');
    if (parts.length === 2) {
      const [payloadB64, sig] = parts;
      const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('hex');
      const sigBuf = Buffer.from(sig);
      const expectedSigBuf = Buffer.from(expectedSig);
      if (sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload && payload.expiresAt && Date.now() <= payload.expiresAt) {
          return {
            token: cleanToken,
            role: payload.role || 'owner',
            actorName: payload.actorName || 'Admin (Owner)',
            createdAt: payload.createdAt || Date.now(),
            expiresAt: payload.expiresAt,
          };
        }
      }
    }
  } catch {}

  return null;
}

function extractToken(req: express.Request): string | null {
  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // 2. Custom header: "x-admin-token: <token>"
  const customHeader = req.headers['x-admin-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  // 3. HttpOnly Cookie header: "yem_admin_token=<token>"
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)yem_admin_token=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  }
  // No query parameter token acceptance (prevents token leakage in logs/URLs)
  return null;
}

function getAdminSession(req: express.Request): AdminSession | null {
  const token = extractToken(req);
  if (!token) return null;
  return verifyAdminToken(token);
}

const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({ 
      error: 'Unauthorized: Valid Admin session token required. Please sign in via the Admin console.' 
    });
  }
  (req as any).adminSession = session;
  req.headers['x-admin-actor'] = session.actorName;
  next();
};

const requireOwnerOrManager = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({ 
      error: 'Unauthorized: Valid Admin session token required. Please sign in via the Admin console.' 
    });
  }
  if (session.role !== 'owner' && session.role !== 'manager') {
    return res.status(403).json({ 
      error: 'Forbidden: Owner or Manager privileges required for this administrative operation.' 
    });
  }
  (req as any).adminSession = session;
  req.headers['x-admin-actor'] = session.actorName;
  next();
};

// Customer authentication middleware (Decoupled from Admin; verifies Supabase customer JWT)
const requireCustomerAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Customer authentication required: missing Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Customer authentication required: empty token' });
  }

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired customer session token' });
      }
      (req as any).customer = user;
      return next();
    }
  } catch (err) {
    console.error('Customer auth token verification error:', err);
  }

  return res.status(401).json({ error: 'Customer authentication verification failed' });
};

// --- IN-MEMORY RATE LIMITER HELPER ---

function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of hits.entries()) {
      if (now > val.resetAt) hits.delete(key);
    }
  }, options.windowMs * 2).unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = hits.get(ip) || { count: 0, resetAt: now + options.windowMs };
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + options.windowMs;
    }
    record.count += 1;
    hits.set(ip, record);
    if (record.count > options.max) {
      return res.status(429).json({ 
        error: options.message || 'Too many requests. Please try again later.' 
      });
    }
    next();
  };
}

// --- ADMIN LOGIN / AUTH ENDPOINTS ---
app.post('/api/admin/login', async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attemptRecord = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  // 1. Lock check FIRST before comparing passwords
  if (attemptRecord.lockedUntil > now) {
    const remainingSec = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    return res.status(429).json({ 
      error: `Too many failed login attempts. Try again in ${remainingSec} seconds.` 
    });
  }

  // 2. Fail closed if server security variables are missing
  if ((!ADMIN_PASSWORD_HASH && !LEGACY_ADMIN_PASSWORD) || !AUTH_SECRET || AUTH_SECRET.length < 16) {
    console.error('[SECURITY CRITICAL] Admin login attempted but neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD, or ADMIN_AUTH_SECRET is configured.');
    return res.status(503).json({
      error: 'Admin authentication is currently unavailable: secure server environment variables must be configured.'
    });
  }

  const { password, role = 'owner' } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  // 3. Cryptographic hash verification (Argon2id / bcrypt)
  const isMatch = await verifyAdminPassword(password);

  if (isMatch) {
    loginAttempts.delete(ip);

    const validRoles = ['owner', 'manager', 'fulfillment', 'support'] as const;
    const selectedRole = validRoles.includes(role as any) ? role : 'owner';
    const actorName = `Admin (${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)})`;
    const expiresAt = now + SESSION_DURATION_MS;

    const payload = {
      role: selectedRole,
      actorName,
      createdAt: now,
      expiresAt,
      salt: crypto.randomBytes(16).toString('hex'),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('hex');
    const token = `${payloadB64}.${sig}`;

    const session: AdminSession = {
      token,
      role: selectedRole as any,
      actorName,
      createdAt: now,
      expiresAt,
    };

    adminSessions.set(token, session);

    // Set HttpOnly, SameSite=Lax cookie with Secure when in production/https
    const isSecure = process.env.NODE_ENV === 'production' || req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    res.setHeader(
      'Set-Cookie',
      `yem_admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`
    );

    return res.status(200).json({
      success: true,
      token,
      role: session.role,
      actorName,
      expiresAt: session.expiresAt,
    });
  }

  // 4. Failed attempt: increment counter, lock if >= 5 attempts, and add timing delay
  attemptRecord.count += 1;
  if (attemptRecord.count >= 5) {
    attemptRecord.lockedUntil = now + 15 * 60 * 1000;
    loginAttempts.set(ip, attemptRecord);
    return res.status(429).json({ 
      error: 'Too many failed login attempts. Account locked for 15 minutes.' 
    });
  }
  loginAttempts.set(ip, attemptRecord);

  // Small delay to slow down automated dictionary attacks
  await new Promise((r) => setTimeout(r, 400));

  return res.status(401).json({ 
    error: 'Invalid admin credentials. Please enter the correct store management key.' 
  });
});

app.post('/api/admin/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    revokedTokens.add(token);
    adminSessions.delete(token);
  }
  // Clear cookie
  res.setHeader(
    'Set-Cookie',
    `yem_admin_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/admin/me', (req, res) => {
  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    role: session.role,
    actorName: session.actorName,
    expiresAt: session.expiresAt,
  });
});

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', store: 'YEM MART', version: '1.0' });
});

// --- PRODUCTS API ---
app.get('/api/products', async (req, res) => {
  const { category, status, search, fresh } = req.query;
  // If fresh requested or if store hasn't been hydrated in > 30 seconds
  if (fresh === 'true' || fresh === '1' || Date.now() - store.getLastHydratedAt() > 30000) {
    await store.hydrateFromSupabase().catch(() => {});
  }
  const isAdmin = Boolean(getAdminSession(req));
  const list = store.getProducts({
    category: typeof category === 'string' ? category : undefined,
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
    isAdmin,
  });
  res.json(list);
});

app.get('/api/products/generate-sku', (req, res) => {
  const category = (req.query.category as string) || 'Fashion';
  const sku = store.generateNextSku(category);
  res.json({ category, sku });
});

app.get('/api/products/:id', async (req, res) => {
  const product = store.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const isAdmin = Boolean(getAdminSession(req));
  if (product.status !== 'published' && !isAdmin) {
    return res.status(404).json({ error: 'Product not available' });
  }
  res.json(product);
});

// Admin-only product creation & modifications (Owner or Manager only)
app.post('/api/products', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const result = await store.saveProduct(req.body, actor);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.product);
});

app.delete('/api/products/:id', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const success = await store.deleteProduct(req.params.id, actor);
  if (!success) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true, message: 'Product deleted' });
});

app.post('/api/products/bulk-import', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  const result = await store.bulkImportProducts(rows, actor);
  res.json(result);
});

// Admin-only truthful AI & category-template suggestions for product highlights & specifications
app.post('/api/admin/suggest-product-details', requireAdminAuth, async (req, res) => {
  try {
    const { name, category, brand, description } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const cat = (category || 'Others') as Category;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback template suggestions when no AI key configured
      const suggestedSpecs = (CATEGORY_SUGGESTED_SPECS[cat] || []).map((f) => ({
        key: f.key,
        value: '',
        isUncertain: true,
        uncertainNote: `Please enter verified ${f.label.toLowerCase()} for this item`,
      }));

      return res.json({
        success: true,
        aiAvailable: false,
        source: 'category_template',
        suggestedDescription: description || '',
        suggestedShortSummary: '',
        highlights: [
          {
            text: `Authentic ${cat} collection curated for YEM MART Kerala customers`,
            isUncertain: true,
            uncertainNote: 'Template placeholder — please add specific product features',
          },
        ],
        specs: suggestedSpecs,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are an honest, strict, truthful retail product data specialist for YEM MART Kerala.
Your role is to extract or suggest Key Highlights (concise bullet points) and structured Specifications (label/value pairs) based ONLY on facts in the provided product title, brand, category, and description.

CRITICAL TRUTHFULNESS & ANTI-HALLUCINATION RULES:
1. NEVER invent material, weight, dimensions, capacity, warranty period, certifications, quality guarantees, medical/health benefits, or safety claims.
2. NEVER assume product attributes from the name alone unless explicitly self-evident (e.g. if the title is "10-inch Cast Iron Skillet", diameter is 10 inches and material is Cast Iron; but do NOT guess its weight or warranty if unstated).
3. If an attribute (e.g. Dimensions, Care Instructions, Battery Life, Warranty) is NOT explicitly mentioned or cannot be reliably verified from the supplied text, either omit it or mark it with isUncertain: true and an uncertainNote: "Merchant verification required".
4. Mark ANY suggestion that requires merchant confirmation or supplier verification with "isUncertain": true and "uncertainNote": "<brief explanation>".
5. Do NOT invent customer ratings, reviews, or fake awards.
6. Provide output in JSON:
{
  "suggestedDescription": "Truthful 1-2 paragraph description based on supplied facts",
  "suggestedShortSummary": "Truthful 1-sentence summary",
  "highlights": [
    { "text": "Feature or benefit supported by text", "isUncertain": false, "uncertainNote": "" }
  ],
  "specs": [
    { "key": "Specification Label", "value": "Specification Value", "isUncertain": false, "uncertainNote": "" }
  ]
}`;

    const prompt = `Product Information:
Name: ${name}
Category: ${cat}
Brand: ${brand || 'YEM MART'}
Existing Description: ${description || 'None provided'}

Generate truthful highlights and specifications according to the instructions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: systemPrompt,
      },
    });

    const text = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights
          .map((h: any) => ({
            text: typeof h === 'string' ? h : String(h.text || ''),
            isUncertain: Boolean(h.isUncertain),
            uncertainNote: h.uncertainNote || (h.isUncertain ? 'Requires merchant verification' : ''),
          }))
          .filter((h: any) => h.text.trim().length > 0)
      : [];

    const specs = Array.isArray(parsed.specs)
      ? parsed.specs
          .map((s: any) => ({
            key: String(s.key || '').trim(),
            value: String(s.value || '').trim(),
            isUncertain: Boolean(s.isUncertain),
            uncertainNote: s.uncertainNote || (s.isUncertain ? 'Requires merchant verification' : ''),
          }))
          .filter((s: any) => s.key.length > 0 && s.value.length > 0)
      : [];

    return res.json({
      success: true,
      aiAvailable: true,
      source: 'gemini',
      suggestedDescription: parsed.suggestedDescription || description || '',
      suggestedShortSummary: parsed.suggestedShortSummary || '',
      highlights,
      specs,
    });
  } catch (err: any) {
    console.error('Error generating product suggestions:', err);
    // On API failure, return fallback template suggestions rather than breaking
    const cat = (req.body?.category || 'Others') as Category;
    const suggestedSpecs = (CATEGORY_SUGGESTED_SPECS[cat] || []).map((f) => ({
      key: f.key,
      value: '',
      isUncertain: true,
      uncertainNote: `Please enter verified ${f.label.toLowerCase()} for this item`,
    }));

    return res.json({
      success: true,
      aiAvailable: false,
      source: 'category_template',
      suggestedDescription: req.body?.description || '',
      suggestedShortSummary: '',
      highlights: [
        {
          text: `Curated ${cat} product for YEM MART Kerala customers`,
          isUncertain: true,
          uncertainNote: 'Template placeholder — please add specific product features',
        },
      ],
      specs: suggestedSpecs,
    });
  }
});

// --- CART VALIDATION API (TRUSTED SERVER-SIDE, RATE-LIMITED) ---
app.post('/api/cart/validate', rateLimit({ windowMs: 60 * 1000, max: 40 }), (req, res) => {
  const { items, couponCode } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }
  const result = store.validateCart(items, couponCode);
  res.json(result);
});

// --- ORDERS API ---
// Strictly protected: Only authorized store managers can list all orders
app.get('/api/orders', requireAdminAuth, async (req, res) => {
  const { status, search, page, limit, summary, fresh } = req.query;
  // If fresh requested or if orders have not been hydrated in > 15 seconds
  if (fresh === 'true' || fresh === '1' || Date.now() - store.getLastOrdersHydratedAt() > 15000) {
    await store.hydrateOrdersFromSupabase().catch(() => {});
  }
  const result = store.getOrders({
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    summary: summary === 'true' || summary === '1',
  });
  res.json(result);
});

app.get('/api/orders/:id', requireAdminAuth, async (req, res) => {
  let order = store.getOrderById(req.params.id);
  if (!order) {
    await store.hydrateOrdersFromSupabase(true).catch(() => {});
    order = store.getOrderById(req.params.id);
  }
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Customer can place order with server-side validation & rate limiting
app.post('/api/orders', rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many order requests. Please wait a moment.' }), async (req, res) => {
  const { customer, items, couponCode, clientOrderId } = req.body;
  if (!customer || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer details and items are required' });
  }
  const result = await store.createOrder(customer, items, couponCode, clientOrderId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.order);
});

// Admin-only order status modifications
app.put('/api/orders/:id/status', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { status, note } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const result = store.updateOrderStatus(req.params.id, status, note, actor);
  if (!result.success) return res.status(400).json({ error: result.error || 'Failed to update order status' });
  res.json({ success: true, message: `Status updated to ${status}` });
});

// Admin-only WhatsApp Message History recording & status updates
app.get('/api/orders/:id/whatsapp-messages', requireAdminAuth, (req, res) => {
  const messages = store.getOrderWhatsAppMessages(req.params.id);
  res.json(messages);
});

app.post('/api/orders/:id/whatsapp-messages', requireAdminAuth, async (req, res) => {
  const adminSession = (req as any).adminSession;
  const adminId = adminSession?.actorName || adminSession?.role || 'admin';
  const adminName = adminSession?.actorName || 'Admin';

  const { messageType, recipientNumber, messageContent, status = 'WhatsApp Opened' } = req.body;

  if (!messageType || !recipientNumber || !messageContent) {
    return res.status(400).json({ error: 'messageType, recipientNumber, and messageContent are required' });
  }

  const validTypes = ['order_details', 'order_confirmation', 'processing_update', 'shipped_update', 'delivered_update', 'custom_message'];
  if (!validTypes.includes(messageType)) {
    return res.status(400).json({ error: 'Invalid messageType' });
  }

  const result = await store.recordOrderWhatsAppMessage({
    orderId: req.params.id,
    messageType,
    recipientNumber: String(recipientNumber).trim(),
    messageContent: String(messageContent).trim(),
    adminId,
    adminName,
    status,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to record WhatsApp communication' });
  }

  res.status(201).json(result.message);
});

app.put('/api/orders/:id/whatsapp-messages/:msgId/status', requireAdminAuth, async (req, res) => {
  const adminSession = (req as any).adminSession;
  const adminName = adminSession?.actorName || 'Admin';
  const { status } = req.body;

  const validStatuses = ['Draft Prepared', 'WhatsApp Opened', 'Marked as Sent', 'Not Sent'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Valid status is required ("Draft Prepared", "WhatsApp Opened", "Marked as Sent", or "Not Sent")' });
  }

  const result = await store.updateOrderWhatsAppMessageStatus(
    req.params.id,
    req.params.msgId,
    status,
    adminName
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to update message status' });
  }

  res.json(result.message);
});

// Admin-only payment verification (Owner or Manager ONLY; Customers/Support CANNOT verify payments!)
app.put('/api/orders/:id/verify-payment', requireOwnerOrManager, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const result = store.verifyPayment(req.params.id, actor);
  if (!result.success) return res.status(400).json({ error: result.error || 'Failed to verify payment' });
  res.json({ success: true, message: 'Payment verified and order confirmed' });
});

// Customer submission of UTR (Payment status -> submitted, NEVER verified, rate limited)
app.post('/api/orders/:id/submit-utr', rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many UTR submission attempts. Please wait.' }), (req, res) => {
  const { utrNumber } = req.body;
  if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length < 6) {
    return res.status(400).json({ error: 'Valid 6-to-24 character UPI UTR number is required' });
  }
  const result = store.submitUtr(req.params.id, utrNumber.trim());
  if (!result.success) return res.status(400).json({ error: result.error || 'Failed to submit UTR' });
  res.json({ success: true, message: 'UTR submitted for verification' });
});

// Customer order tracking with privacy masking (Requires order ID + full matching phone, rate-limited)
app.post('/api/orders/track', rateLimit({ windowMs: 5 * 60 * 1000, max: 15, message: 'Too many tracking attempts. Please wait 5 minutes.' }), (req, res) => {
  const { orderId, phone } = req.body;
  if (!orderId || !phone) {
    return res.status(400).json({ error: 'Order ID and Phone number are required' });
  }
  const result = store.trackOrder(orderId, phone);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json(result.order);
});

// --- INVENTORY STOCK ADJUSTMENT (Admin-only: Owner or Manager) ---
app.post('/api/inventory/adjust', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { productId, variantSku, newStock, reason } = req.body;
  if (!productId || newStock === undefined) {
    return res.status(400).json({ error: 'productId and newStock are required' });
  }
  const success = await store.adjustStock(productId, variantSku, Number(newStock), reason, actor);
  if (!success) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

// --- CUSTOMER CONFIG (SAFE PUBLIC SUPABASE KEYS ONLY) ---
app.get('/api/customer/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  });
});

// --- CUSTOMER SAVED ADDRESSES API (AUTHENTICATED CUSTOMERS ONLY) ---
app.get('/api/customer/addresses', requireCustomerAuth, async (req, res) => {
  try {
    const userId = (req as any).customer.id;
    const addresses = await store.getCustomerAddresses(userId);
    res.json(addresses);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'TABLE_NOT_FOUND' ? 503 : 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to fetch saved addresses',
      code: err.code || 'ADDRESS_STORAGE_ERROR',
    });
  }
});

app.post('/api/customer/addresses', requireCustomerAuth, async (req, res) => {
  try {
    const userId = (req as any).customer.id;
    const { fullName, phone, address, landmark, district, pincode, label = 'Home', isDefault = false } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Recipient full name is required' });
    }
    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number starting with 6-9 is required' });
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
    if (!district || !ALL_KERALA_DISTRICTS.includes(district as any)) {
      return res.status(400).json({ error: 'Please select a valid Kerala district' });
    }
    const cleanPincode = String(pincode || '').trim();
    if (!cleanPincode || !isKeralaPincode(cleanPincode)) {
      return res.status(400).json({ error: 'Valid 6-digit Kerala PIN code (starting with 67, 68, or 69) is required' });
    }
    const validLabels = ['Home', 'Work', 'Other'];
    const cleanLabel = validLabels.includes(label) ? label : 'Home';

    const newAddress: SavedAddress = {
      id: 'addr_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
      userId,
      fullName: fullName.trim(),
      phone: cleanPhone,
      address: address.trim(),
      landmark: landmark && typeof landmark === 'string' ? landmark.trim() : undefined,
      district,
      pincode: cleanPincode,
      label: cleanLabel as any,
      isDefault: Boolean(isDefault),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await store.saveCustomerAddress(newAddress);
    res.status(201).json(saved);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'TABLE_NOT_FOUND' ? 503 : 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to save address',
      code: err.code || 'ADDRESS_STORAGE_ERROR',
    });
  }
});

app.put('/api/customer/addresses/:id', requireCustomerAuth, async (req, res) => {
  try {
    const userId = (req as any).customer.id;
    const { id } = req.params;
    const existingList = await store.getCustomerAddresses(userId);
    const existing = existingList.find((a) => a.id === id);
    if (!existing) {
      return res.status(404).json({ error: 'Address not found or unauthorized' });
    }

    const { fullName, phone, address, landmark, district, pincode, label, isDefault } = req.body;

    const updatedAddress: SavedAddress = {
      ...existing,
      fullName: fullName !== undefined ? String(fullName).trim() : existing.fullName,
      phone: phone !== undefined ? String(phone).trim() : existing.phone,
      address: address !== undefined ? String(address).trim() : existing.address,
      landmark: landmark !== undefined ? (landmark ? String(landmark).trim() : undefined) : existing.landmark,
      district: district !== undefined ? district : existing.district,
      pincode: pincode !== undefined ? String(pincode).trim() : existing.pincode,
      label: label !== undefined ? label : existing.label,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : existing.isDefault,
      updatedAt: new Date().toISOString(),
    };

    if (!updatedAddress.fullName) {
      return res.status(400).json({ error: 'Recipient full name is required' });
    }
    if (!/^[6-9]\d{9}$/.test(updatedAddress.phone)) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number is required' });
    }
    if (!updatedAddress.address) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
    if (!ALL_KERALA_DISTRICTS.includes(updatedAddress.district as any)) {
      return res.status(400).json({ error: 'Please select a valid Kerala district' });
    }
    if (!isKeralaPincode(updatedAddress.pincode)) {
      return res.status(400).json({ error: 'Valid 6-digit Kerala PIN code (starting with 67, 68, or 69) is required' });
    }

    const saved = await store.saveCustomerAddress(updatedAddress);
    res.json(saved);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'TABLE_NOT_FOUND' ? 503 : 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to update address',
      code: err.code || 'ADDRESS_STORAGE_ERROR',
    });
  }
});

app.delete('/api/customer/addresses/:id', requireCustomerAuth, async (req, res) => {
  try {
    const userId = (req as any).customer.id;
    const { id } = req.params;
    const success = await store.deleteCustomerAddress(userId, id);
    if (!success) {
      return res.status(404).json({ error: 'Address not found or unauthorized' });
    }
    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'TABLE_NOT_FOUND' ? 503 : 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to delete address',
      code: err.code || 'ADDRESS_STORAGE_ERROR',
    });
  }
});

app.put('/api/customer/addresses/:id/default', requireCustomerAuth, async (req, res) => {
  try {
    const userId = (req as any).customer.id;
    const { id } = req.params;
    const updated = await store.setDefaultCustomerAddress(userId, id);
    if (!updated) {
      return res.status(404).json({ error: 'Address not found or unauthorized' });
    }
    res.json(updated);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.code === 'TABLE_NOT_FOUND' ? 503 : 500);
    res.status(statusCode).json({
      error: err.message || 'Failed to set default address',
      code: err.code || 'ADDRESS_STORAGE_ERROR',
    });
  }
});

// --- SETTINGS API ---

app.get('/api/settings', async (req, res) => {
  if (req.query.fresh === 'true' || req.query.fresh === '1' || Date.now() - store.getLastHydratedAt() > 30000) {
    await store.hydrateFromSupabase().catch(() => {});
  }
  res.json(store.getSettings());
});

app.put('/api/settings', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const updated = await store.updateSettings(req.body, actor);
  res.json(updated);
});

// --- STORE REHYDRATION & CACHE INVALIDATION (Admin-only: Owner or Manager) ---
app.post('/api/store/rehydrate', requireOwnerOrManager, async (req, res) => {
  const success = await store.hydrateFromSupabase();
  res.json({ 
    success, 
    lastHydratedAt: store.getLastHydratedAt(), 
    productsCount: store.getProducts({ isAdmin: true }).length 
  });
});

// --- COUPONS API ---
app.get('/api/coupons', requireAdminAuth, (req, res) => {
  res.json(store.getCoupons());
});

app.post('/api/coupons', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const saved = await store.saveCoupon(req.body, actor);
  res.json(saved);
});

app.delete('/api/coupons/:id', requireOwnerOrManager, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const success = await store.deleteCoupon(req.params.id, actor);
  if (!success) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true });
});

// --- AUDIT & STOCK LOGS API (Admin-only: Owner or Manager) ---
app.get('/api/audit-logs', requireOwnerOrManager, (req, res) => {
  res.json(store.getAuditLogs());
});

app.get('/api/stock-logs', requireOwnerOrManager, (req, res) => {
  res.json(store.getStockLogs());
});

// Gemini Chatbot Endpoint with Google Search Grounding (Rate-limited)
app.post('/api/chat', rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Chat rate limit reached. Please wait a moment.' }), async (req, res) => {
  try {
    const { messages, productContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Please check GEMINI_API_KEY.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format conversation history for Gemini API
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const systemInstruction = `You are "YEM Concierge", the official smart shopping assistant and customer guide for "YEM MART - Your Everyday Store".
YEM MART is Kerala's premium online retail brand offering curated products across Fashion, Accessories, Electronics, Home & Kitchen, Stationery, Kids, Gifts, and Daily Living.

Your personality and guidelines:
1. Warm, polite, knowledgeable, honest, and helpful.
2. The user base is in Kerala, India. You fluently understand English, Malayalam, and Manglish (Malayalam written in English script). If a customer asks in Malayalam or Manglish (e.g., "Kochi delivery undoo?", "Nalla gift hampers suggest cheyyamo?"), reply warmly in polite Manglish or Malayalam with English clarity.
3. YEM MART Store Policies:
   - Coverage: All 14 districts of Kerala (Ernakulam, Thiruvananthapuram, Kozhikode, Thrissur, Malappuram, Kollam, Palakkad, Kottayam, Kannur, Alappuzha, Pathanamthitta, Idukki, Wayanad, Kasaragod).
   - Delivery fee: Flat ₹49 across Kerala. FREE delivery on orders above ₹999.
   - Ordering Workflow: Customers add products to cart -> enter delivery details -> website generates a unique Order ID -> opens WhatsApp with a pre-filled order message -> Customer clicks Send on WhatsApp to place the order.
   - Official WhatsApp Order Number: 7510447887 (+91 7510447887 / wa.me/917510447887).
   - Payments: Customers pay via UPI ID or scanning QR code, and enter their 12-digit UTR reference number for Admin verification.
   - No fake stock or fake discounts: Everything is authentic and clearly verified.
4. Active Catalog Highlights:
   ${productContext || 'Fashion, Accessories, Electronics, Home & Kitchen, Stationery, Kids, Gifts, Daily Living.'}
5. Google Search Grounding:
   - When asked about up-to-date events, festivals (Onam, Vishu, Eid, Diwali, Christmas dates), current market prices, weather conditions, pincodes, or technical product comparisons, leverage your Google Search tool to give accurate, real-time facts.
6. Keep recommendations concise, easy to read, and highlight product names with price in ₹ (INR).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const replyText = response.text || 'I am ready to help you with your YEM MART shopping. How may I assist you?';

    // Extract Google Search grounding citations if present
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchGrounding = rawChunks
      .map((c: any) => ({
        title: c.web?.title || 'Google Search Source',
        url: c.web?.uri || '',
      }))
      .filter((c: any) => Boolean(c.url));

    res.json({
      text: replyText,
      searchGrounding,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: error.message || 'Failed to process chat response with Gemini',
    });
  }
});

// --- SAFE GLOBAL ERROR HANDLING MIDDLEWARE ---
// Explicitly handles synchronous exceptions, JSON parser errors, or next(err) with proper CORS headers
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Ensure CORS headers are attached on all error responses
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-actor, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const statusCode = 
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : typeof err.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;

  // Safe extraction of clean string message to prevent raw [object Object] output
  let errorMessage = 'An unexpected server error occurred.';
  if (typeof err === 'string' && err.trim() && err.trim() !== '[object Object]') {
    errorMessage = err.trim();
  } else if (err && typeof err.message === 'string' && err.message.trim() && err.message.trim() !== '[object Object]') {
    errorMessage = err.message.trim();
  } else if (err && typeof err.error === 'string' && err.error.trim() && err.error.trim() !== '[object Object]') {
    errorMessage = err.error.trim();
  } else if (err && typeof err.error?.message === 'string' && err.error.message.trim()) {
    errorMessage = err.error.message.trim();
  }

  console.error(`[Server Error] ${req.method} ${req.url} - Status ${statusCode}:`, err?.message || err);

  if (res.headersSent) {
    return _next(err);
  }

  return res.status(statusCode).json({ error: errorMessage });
});

// Start server and configure Vite middlewares in development
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV === 'production') {
    // Serve production build from dist
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      renderSeoHtml(req, res, () => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      });
    });
  } else {
    // In development, hook up Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    viteDevServer = vite;
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YEM MART full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

// In local or Cloud Run environments, start the listener. In Vercel serverless functions, export app.
const isDirectCliRun = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith('server.ts') || 
    process.argv[1].endsWith('server.js')
  )
);

if (!process.env.VERCEL && isDirectCliRun) {
  startServer();
}

export { app };
export default app;
