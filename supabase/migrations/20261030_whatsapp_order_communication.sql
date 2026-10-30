-- ============================================================================
-- YEM MART — WhatsApp Order Communication Migration
-- Migration Name: 20261030_whatsapp_order_communication.sql
-- Scope: Add whatsapp_number, is_whatsapp_same_as_phone, and
--        whatsapp_messages JSONB log column to public.orders table.
--
-- EXECUTION NOTICE:
-- - Reviewable SQL migration only. Do NOT run against live production
--   without explicit store administrator approval.
-- - Wrapped in an atomic transaction (BEGIN ... COMMIT).
-- - Fully idempotent and safe to re-run.
-- - Backward compatible: all additions are nullable or have safe defaults.
-- ============================================================================

BEGIN;

-- 1. Ensure orders table exists and add WhatsApp columns if not present
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_whatsapp_same_as_phone BOOLEAN DEFAULT false;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS whatsapp_messages JSONB DEFAULT '[]'::jsonb;

-- 2. Index for fast customer phone and WhatsApp lookups
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp_number 
ON public.orders(whatsapp_number)
WHERE whatsapp_number IS NOT NULL;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
