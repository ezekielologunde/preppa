BEGIN;

-- Add idempotency key column to orders to prevent duplicate order creation on network retry
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- The create_order RPC needs updating to:
-- 1. Accept p_idempotency_key uuid parameter
-- 2. INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
-- 3. Check if pending orders >= 3 for this customer in the last 2 hours
-- NOTE: This migration adds the column; the RPC update requires CREATE OR REPLACE FUNCTION
-- which must be in a separate migration after reading the full current RPC definition.

-- pg_cron: cancel stale pending orders (no payment after 30 minutes)
-- Run in Supabase Dashboard after enabling pg_cron:
-- SELECT cron.schedule('cancel-stale-orders', '*/5 * * * *', $$
--   UPDATE orders SET status = 'cancelled'
--   WHERE status = 'pending'
--     AND created_at < NOW() - INTERVAL '30 minutes'
--     AND id NOT IN (SELECT order_id FROM payments WHERE status = 'succeeded')
-- $$);

COMMIT;
