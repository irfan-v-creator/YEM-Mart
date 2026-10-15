import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { store } from './server/store';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

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

function getAdminSession(req: express.Request): AdminSession | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
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
app.get('/api/products', (req, res) => {
  const { category, status, search } = req.query;
  const isAdmin = Boolean(getAdminSession(req));
  const list = store.getProducts({
    category: typeof category === 'string' ? category : undefined,
    status: typeof status === 'string' ? status : undefined,
    search: typeof search === 'string' ? search : undefined,
    isAdmin,
  });
  res.json(list);
});

app.get('/api/products/:id', (req, res) => {
  const product = store.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const isAdmin = Boolean(getAdminSession(req));
  if (product.status !== 'published' && !isAdmin) {
    return res.status(404).json({ error: 'Product not available' });
  }
  res.json(product);
});

app.post('/api/products', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const result = store.saveProduct(req.body, actor);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.product);
});

app.delete('/api/products/:id', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const success = store.deleteProduct(req.params.id, actor);
  if (!success) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true, message: 'Product deleted' });
});

app.post('/api/products/bulk-import', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array is required' });
  }
  const result = store.bulkImportProducts(rows, actor);
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
app.post('/api/inventory/adjust', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const { productId, variantSku, newStock, reason } = req.body;
  if (!productId || newStock === undefined) {
    return res.status(400).json({ error: 'productId and newStock are required' });
  }
  const success = store.adjustStock(productId, variantSku, Number(newStock), reason, actor);
  if (!success) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

// --- SETTINGS API ---
app.get('/api/settings', (req, res) => {
  res.json(store.getSettings());
});

app.put('/api/settings', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const updated = store.updateSettings(req.body, actor);
  res.json(updated);
});

// --- COUPONS API ---
app.get('/api/coupons', requireAdminAuth, (req, res) => {
  res.json(store.getCoupons());
});

app.post('/api/coupons', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const saved = store.saveCoupon(req.body, actor);
  res.json(saved);
});

app.delete('/api/coupons/:id', requireAdminAuth, (req, res) => {
  const actor = (req as any).adminSession?.actorName || 'Admin';
  const success = store.deleteCoupon(req.params.id, actor);
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
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // In development, hook up Vite dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
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
