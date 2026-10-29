-- ============================================================================
-- YEM MART — Customer Saved Addresses & Atomic Default Address Migration
-- Migration Name: 20261029_customer_addresses_and_defaults.sql
-- Scope: public.customer_addresses table, deterministic deduplication,
--        partial unique index, hardened SECURITY DEFINER RPC function,
--        Row Level Security (RLS) policies, and least-privilege role grants.
--
-- EXECUTION NOTICE:
-- - This script is designed to run in Supabase SQL Editor by a project admin.
-- - Wrapped in an atomic transaction (BEGIN ... COMMIT).
-- - Fully idempotent and safe to re-run.
-- - Strictly preserves existing data: resolving duplicate defaults modifies
--   only the is_default flag; NO address records are deleted.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Create customer_addresses table if not exists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
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

-- ----------------------------------------------------------------------------
-- 2. Fast lookup index by user_id
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id 
ON public.customer_addresses(user_id);

-- ----------------------------------------------------------------------------
-- 3. Deterministic Pre-Index Deduplication
-- Resolves any existing duplicate default addresses before creating the unique
-- index. Retains the most recently updated default address (or newest record)
-- and unsets is_default for older duplicates. Does NOT delete any rows.
-- ----------------------------------------------------------------------------
WITH ranked_defaults AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id 
           ORDER BY updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM public.customer_addresses
  WHERE is_default = true
)
UPDATE public.customer_addresses
SET is_default = false
WHERE id IN (
  SELECT id FROM ranked_defaults WHERE rn > 1
);

-- ----------------------------------------------------------------------------
-- 4. Strict Concurrency Guard: Enforce at most ONE default address per customer
-- Partial unique index guarantees at database-level that concurrent requests
-- cannot create or leave multiple default addresses for the same user.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_default_address_per_user
ON public.customer_addresses (user_id)
WHERE is_default = true;

-- ----------------------------------------------------------------------------
-- 5. Hardened Atomic RPC Function for Default Address Switching
-- Uses SECURITY DEFINER with fixed search_path = public.
-- Enforces trusted caller model:
--   - 'service_role' (trusted backend with SUPABASE_SERVICE_ROLE_KEY): allowed.
--   - 'authenticated' (direct caller): auth.uid() must be non-null and match p_user_id.
--   - All other roles ('anon', unauthenticated, mismatched caller): rejected with 42501.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_customer_default_address(
    p_user_id UUID, 
    p_address_id VARCHAR
)
RETURNS public.customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_address public.customer_addresses;
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

  -- Verify the target address exists and strictly belongs to the customer
  SELECT * INTO v_address 
  FROM public.customer_addresses 
  WHERE id = p_address_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found or unauthorized' USING ERRCODE = 'P0002';
  END IF;

  -- 1. Atomically reset existing default addresses for this customer only
  UPDATE public.customer_addresses
  SET is_default = false, updated_at = NOW()
  WHERE user_id = p_user_id AND is_default = true AND id != p_address_id;

  -- 2. Mark the target address as default
  UPDATE public.customer_addresses
  SET is_default = true, updated_at = NOW()
  WHERE id = p_address_id AND user_id = p_user_id
  RETURNING * INTO v_address;

  RETURN v_address;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Configuration
-- ----------------------------------------------------------------------------
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- Customer RLS Policies: Authenticated users can only access and modify their own records
DROP POLICY IF EXISTS "Customers can select own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can select own addresses" ON public.customer_addresses 
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can insert own addresses" ON public.customer_addresses 
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can update own addresses" ON public.customer_addresses 
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can delete own addresses" ON public.customer_addresses 
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. Least-Privilege Role Grants & Permissions
-- ----------------------------------------------------------------------------
-- Ensure basic schema usage
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Revoke all table-level access from PUBLIC and anon (unauthenticated visitors)
REVOKE ALL ON TABLE public.customer_addresses FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_addresses FROM anon;

-- Authenticated customers receive standard DML access, strictly bounded by RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;

-- Service role and postgres maintain administrative access for backend operations
GRANT ALL PRIVILEGES ON TABLE public.customer_addresses TO postgres, service_role;

-- Revoke RPC execution privileges from untrusted caller roles
REVOKE ALL ON FUNCTION public.set_customer_default_address(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_customer_default_address(UUID, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.set_customer_default_address(UUID, VARCHAR) FROM authenticated;

-- Grant RPC execution exclusively to postgres and service_role
GRANT EXECUTE ON FUNCTION public.set_customer_default_address(UUID, VARCHAR) TO postgres, service_role;

-- ----------------------------------------------------------------------------
-- 8. PostgREST Schema Cache Reload
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
