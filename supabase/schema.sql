-- ============================================================================
-- YEM MART — Production Supabase PostgreSQL Schema & Permissions
-- Migration Date: October 2026
-- Aligned with src/types/index.ts
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. STORE SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    store_name VARCHAR(150) NOT NULL DEFAULT 'YEM MART',
    tagline VARCHAR(255) DEFAULT 'Your Everyday Store',
    whatsapp_number VARCHAR(20) NOT NULL DEFAULT '917510447887',
    support_phone VARCHAR(20) DEFAULT '7510447887',
    support_email VARCHAR(100) DEFAULT 'support@yemmart.com',
    upi_id VARCHAR(100) DEFAULT 'yemmart@okaxis',
    address TEXT DEFAULT 'Main Road, Kozhikode, Kerala 673001',
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 40.00,
    free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 499.00,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    announcement_text TEXT DEFAULT 'Free Delivery on Orders Above ₹499 | Kerala Delivery in 24–48 Hours',
    coverage_area TEXT DEFAULT 'All 14 Districts across Kerala & Selected Metro Hubs',
    office_city VARCHAR(100) DEFAULT 'Kozhikode',
    allow_cod BOOLEAN NOT NULL DEFAULT true,
    allow_upi BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist even if table was created previously
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS allow_cod BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS allow_upi BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS support_phone VARCHAR(20) DEFAULT '7510447887';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20) NOT NULL DEFAULT '917510447887';

-- ----------------------------------------------------------------------------
-- 2. PRODUCTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(150),
    category VARCHAR(100) NOT NULL,
    short_summary TEXT,
    description TEXT,
    highlights JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '{}'::jsonb,
    rating NUMERIC(3, 2) DEFAULT 4.50,
    review_count INTEGER DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    discount_percentage INTEGER DEFAULT 0,
    images JSONB DEFAULT '[]'::jsonb,
    main_image TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_in_stock BOOLEAN NOT NULL DEFAULT true,
    stock_count INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    sku VARCHAR(100),
    badge VARCHAR(50),
    is_featured BOOLEAN DEFAULT false,
    is_best_deal BOOLEAN DEFAULT false,
    is_new_arrival BOOLEAN DEFAULT false,
    required_variant_type VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'scheduled', 'archived', 'active')),
    scheduled_publish_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist even if table was created previously
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_deal BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS required_variant_type VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS scheduled_publish_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- ----------------------------------------------------------------------------
-- 3. PRODUCT VARIANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'size',
    sku VARCHAR(100),
    size VARCHAR(50),
    color VARCHAR(50),
    price NUMERIC(10, 2),
    original_price NUMERIC(10, 2),
    stock_count INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);

-- ----------------------------------------------------------------------------
-- 4. COUPONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'flat', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) DEFAULT 0.00,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INTEGER,
    times_used INTEGER NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist even if table was created previously
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ----------------------------------------------------------------------------
-- 5. ORDERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(150),
    address TEXT NOT NULL,
    city VARCHAR(100),
    pincode VARCHAR(20) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    coupon_code VARCHAR(50),
    total NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cod', 'upi', 'online')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'submitted', 'verified', 'failed', 'refunded', 'paid')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'prepared' CHECK (order_status IN ('prepared', 'whatsapp_pending', 'payment_submitted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pending')),
    utr_number VARCHAR(100),
    payment_submitted_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    is_restocked_on_cancellation BOOLEAN DEFAULT false,
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist even if table was created previously
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_restocked_on_cancellation BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created_at ON orders(payment_status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. ORDER ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(100) REFERENCES products(id) ON DELETE SET NULL,
    variant_id VARCHAR(100) REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(150),
    variant_sku VARCHAR(100),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ----------------------------------------------------------------------------
-- 7. ORDER STATUS HISTORY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by VARCHAR(100) DEFAULT 'system',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON order_status_history(order_id);

-- ----------------------------------------------------------------------------
-- 8. STOCK ADJUSTMENT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_adjustment_logs (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255),
    variant_sku VARCHAR(100),
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    actor VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON stock_adjustment_logs(product_id);

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100) NOT NULL DEFAULT 'admin',
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. ROLE PERMISSIONS & GRANTS (CRITICAL FOR SUPABASE SERVICE_ROLE & ANON)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 10. CUSTOMER ADDRESSES TABLE (AUTHENTICATED CUSTOMER SAVED ADDRESSES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_addresses (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    landmark TEXT,
    district VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    label VARCHAR(30) NOT NULL DEFAULT 'Home' CHECK (label IN ('Home', 'Work', 'Other')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id ON customer_addresses(user_id);

-- Deterministic Pre-Index Deduplication: ensure at most 1 default address per customer
WITH ranked_defaults AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id 
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM customer_addresses
  WHERE is_default = true
)
UPDATE customer_addresses
SET is_default = false
WHERE id IN (
  SELECT id FROM ranked_defaults WHERE rn > 1
);

-- Strict Concurrency Guard: Enforce at most one default address per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_default_address_per_user
ON customer_addresses (user_id)
WHERE is_default = true;

-- Hardened Atomic RPC function for default address switching
CREATE OR REPLACE FUNCTION set_customer_default_address(p_user_id UUID, p_address_id VARCHAR)
RETURNS customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address customer_addresses;
BEGIN
  -- Strict caller validation: enforce trusted caller model
  IF auth.role() = 'service_role' THEN
    -- Trusted server-side call via backend SUPABASE_SERVICE_ROLE_KEY
    NULL;
  ELSIF auth.role() = 'authenticated' THEN
    -- Direct authenticated call: auth.uid() must be non-null and match p_user_id exactly
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: Caller identity does not match customer ID' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized: Caller role not permitted' USING ERRCODE = '42501';
  END IF;

  -- Verify target address exists and strictly belongs to the customer
  SELECT * INTO v_address FROM customer_addresses 
  WHERE id = p_address_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found or unauthorized' USING ERRCODE = 'P0002';
  END IF;

  -- Atomically reset existing defaults for this customer only
  UPDATE customer_addresses
  SET is_default = false, updated_at = NOW()
  WHERE user_id = p_user_id AND is_default = true AND id != p_address_id;

  -- Mark target address as default
  UPDATE customer_addresses
  SET is_default = true, updated_at = NOW()
  WHERE id = p_address_id AND user_id = p_user_id
  RETURNING * INTO v_address;

  RETURN v_address;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. ROLE PERMISSIONS & LEAST-PRIVILEGE GRANTS
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Revoke all table-level access from PUBLIC and anon for sensitive customer data
REVOKE ALL ON TABLE customer_addresses FROM PUBLIC;
REVOKE ALL ON TABLE customer_addresses FROM anon;

-- Grant least-privilege DML to authenticated users (governed by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE customer_addresses TO authenticated;

-- Service role and postgres maintain administrative access
GRANT ALL PRIVILEGES ON TABLE customer_addresses TO postgres, service_role;

-- Revoke RPC execution privileges from untrusted caller roles
REVOKE ALL ON FUNCTION set_customer_default_address(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_customer_default_address(UUID, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION set_customer_default_address(UUID, VARCHAR) FROM authenticated;

-- Grant RPC execution strictly to postgres and service_role
GRANT EXECUTE ON FUNCTION set_customer_default_address(UUID, VARCHAR) TO postgres, service_role;

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Public storefront read access
DROP POLICY IF EXISTS "Public can view store settings" ON store_settings;
CREATE POLICY "Public can view store settings" ON store_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Public can view variants" ON product_variants;
CREATE POLICY "Public can view variants" ON product_variants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active coupons" ON coupons;
CREATE POLICY "Public can view active coupons" ON coupons FOR SELECT USING (is_active = true);

-- Customer Addresses RLS: Customers can only manage their own addresses
DROP POLICY IF EXISTS "Customers can select own addresses" ON customer_addresses;
CREATE POLICY "Customers can select own addresses" ON customer_addresses 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own addresses" ON customer_addresses;
CREATE POLICY "Customers can insert own addresses" ON customer_addresses 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own addresses" ON customer_addresses;
CREATE POLICY "Customers can update own addresses" ON customer_addresses 
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own addresses" ON customer_addresses;
CREATE POLICY "Customers can delete own addresses" ON customer_addresses 
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reload PostgREST schema cache to ensure new columns and grants take effect immediately
NOTIFY pgrst, 'reload schema';


