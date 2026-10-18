import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { store } from './server/store';
import { isSupabaseConfigured, getSupabaseClient } from './server/supabase';
import { Product } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let viteDevServer: any = null;

const app = express();

// Enable CORS and Preflight for AI Studio preview, cloud domains, and localhost
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-actor, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
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
const FALLBACK_ADMIN_PASSWORD = 'yem-admin-2026';
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || FALLBACK_ADMIN_PASSWORD).trim().replace(/^["']|["']$/g, '');
const AUTH_SECRET = process.env.ADMIN_AUTH_SECRET || ADMIN_PASSWORD || 'yem-mart-security-key-2026';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

interface AdminSession {
  token: string;
  role: 'owner' | 'manager' | 'fulfillment' | 'support';
  actorName: string;
  createdAt: number;
  expiresAt: number;
}

const adminSessions = new Map<string, AdminSession>();
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(req: express.Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function verifyAdminToken(token: string): AdminSession | null {
  if (!token) return null;
  const cleanToken = token.trim().replace(/^["']|["']$/g, '');
  
  // 1. Direct passkey as bearer token support (immediate fallback)
  if (cleanToken === FALLBACK_ADMIN_PASSWORD || (ADMIN_PASSWORD && cleanToken === ADMIN_PASSWORD)) {
    return {
      token: cleanToken,
      role: 'owner',
      actorName: 'Admin (Owner)',
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
    };
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

  // 3. Stateless self-verifying signed token (supports Vercel serverless / container restarts)
  try {
    const parts = cleanToken.split('.');
    if (parts.length === 2) {
      const [payloadB64, sig] = parts;
      const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
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
  // 3. Cookie header: "yem_admin_token=<token>"
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)yem_admin_token=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  }
  // 4. Query parameter fallback: "?admin_token=<token>"
  if (typeof req.query?.admin_token === 'string' && req.query.admin_token.trim()) {
    return req.query.admin_token.trim();
  }
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

// --- ADMIN LOGIN / AUTH ENDPOINTS ---
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const attemptRecord = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  const { password, role = 'owner' } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  const cleanInput = password.trim().replace(/^["']|["']$/g, '');
  const envPassword = (process.env.ADMIN_PASSWORD || '').trim().replace(/^["']|["']$/g, '');

  // Accept hardcoded fallback password "yem-admin-2026" alongside process.env.ADMIN_PASSWORD
  const isMatch =
    cleanInput === FALLBACK_ADMIN_PASSWORD ||
    (envPassword.length > 0 && cleanInput === envPassword) ||
    cleanInput === ADMIN_PASSWORD;

  if (isMatch) {
    // Legitimate admin login -> Always clear any previous lockout/attempts
    loginAttempts.delete(ip);

    const validRoles = ['owner', 'manager', 'fulfillment', 'support'] as const;
    const selectedRole = validRoles.includes(role as any) ? role : 'owner';
    const actorName = `Admin (${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)})`;
    const expiresAt = now + SESSION_DURATION_MS;

    // Create a self-contained signed token for resilience across serverless/container restarts
    const payload = {
      role: selectedRole,
      actorName,
      createdAt: now,
      expiresAt,
      salt: crypto.randomBytes(8).toString('hex'),
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

    // Set cookie header for browsers that support credentials/cookies
    res.setHeader(
      'Set-Cookie',
      `yem_admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; SameSite=Lax`
    );

    return res.status(200).json({
      success: true,
      token,
      role: session.role,
      actorName,
      expiresAt: session.expiresAt,
    });
  }

  // Failed attempt
  if (attemptRecord.lockedUntil > now) {
    const remainingSec = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    return res.status(429).json({ 
      error: `Too many failed login attempts. Try again in ${remainingSec} seconds.` 
    });
  }

  attemptRecord.count += 1;
  if (attemptRecord.count >= 10) {
    attemptRecord.lockedUntil = now + 15 * 60 * 1000;
    loginAttempts.set(ip, attemptRecord);
    return res.status(429).json({ 
      error: 'Too many failed login attempts. Account locked for 15 minutes.' 
    });
  }
  loginAttempts.set(ip, attemptRecord);

  return res.status(401).json({ 
    error: 'Invalid admin credentials. Please enter the correct store management key.' 
  });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    adminSessions.delete(token);
  }
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

// --- SEO ENDPOINTS ---
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const products = store.getProducts({ status: 'published' });
  const categories = ['Fashion', 'Accessories', 'Electronics', 'Home & Kitchen', 'Stationery', 'Kids', 'Gifts', 'Others'];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${host}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const cat of categories) {
    xml += `
  <url>
    <loc>${host}/?category=${encodeURIComponent(cat)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  for (const p of products) {
    xml += `
  <url>
    <loc>${host}/?product=${encodeURIComponent(p.id)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  xml += `\n</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

// --- PRODUCTS API ---
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

app.get('/api/products/:id', async (req, res) => {
  const product = store.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const isAdmin = Boolean(getAdminSession(req));
  if (product.status !== 'published' && !isAdmin) {
    return res.status(404).json({ error: 'Product not available' });
  }
  res.json(product);
});

app.post('/api/products', requireAdminAuth, async (req, res) => {
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

app.post('/api/products/bulk-import', requireAdminAuth, async (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  const result = await store.bulkImportProducts(rows, actor);
  res.json(result);
});

// --- CART VALIDATION API (TRUSTED SERVER-SIDE) ---
app.post('/api/cart/validate', (req, res) => {
  const { items, couponCode } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }
  const result = store.validateCart(items, couponCode);
  res.json(result);
});

// --- ORDERS API ---
// Strictly protected: Only authorized store managers can list all orders
app.get('/api/orders', requireAdminAuth, (req, res) => {
  const { status, search } = req.query;
  const list = store.getOrders({
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  res.json(list);
});

app.get('/api/orders/:id', requireAdminAuth, (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Customer can place order with server-side validation
app.post('/api/orders', (req, res) => {
  const { customer, items, couponCode } = req.body;
  if (!customer || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer details and items are required' });
  }
  const result = store.createOrder(customer, items, couponCode);
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
  const success = store.updateOrderStatus(req.params.id, status, note, actor);
  if (!success) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true, message: `Status updated to ${status}` });
});

// Admin-only payment verification (Customers CANNOT verify payments!)
app.put('/api/orders/:id/verify-payment', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const success = store.verifyPayment(req.params.id, actor);
  if (!success) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true, message: 'Payment verified and order confirmed' });
});

// Customer submission of UTR (Payment status -> submitted, NEVER verified)
app.post('/api/orders/:id/submit-utr', (req, res) => {
  const { utrNumber } = req.body;
  if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length < 6) {
    return res.status(400).json({ error: 'Valid 6-to-18 character UPI UTR number is required' });
  }
  const success = store.submitUtr(req.params.id, utrNumber.trim());
  if (!success) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true, message: 'UTR submitted for verification' });
});

// Customer order tracking with privacy masking (Requires order ID + matching phone)
app.post('/api/orders/track', (req, res) => {
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

// --- INVENTORY STOCK ADJUSTMENT (Admin-only) ---
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

// --- STORE REHYDRATION & CACHE INVALIDATION ---
app.post('/api/store/rehydrate', async (req, res) => {
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

// --- AUDIT & STOCK LOGS API (Admin-only) ---
app.get('/api/audit-logs', requireAdminAuth, (req, res) => {
  res.json(store.getAuditLogs());
});

app.get('/api/stock-logs', requireAdminAuth, (req, res) => {
  res.json(store.getStockLogs());
});

// Gemini Chatbot Endpoint with Google Search Grounding
app.post('/api/chat', async (req, res) => {
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
if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
