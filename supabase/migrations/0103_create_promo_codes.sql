-- Migration 0103: Create promo_codes table
-- Admin-managed promotional discount codes applied at checkout.

CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code            text        NOT NULL UNIQUE,
  description     text,
  discount_type   text        NOT NULL,  -- 'percent' | 'fixed'
  discount_value  numeric     NOT NULL,
  min_order_value numeric     NOT NULL DEFAULT 0,
  max_uses        integer,
  uses_count      integer     NOT NULL DEFAULT 0,
  expires_at      timestamptz,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Customers can read active codes (to validate at checkout)
DROP POLICY IF EXISTS promo_codes_read ON promo_codes;
CREATE POLICY promo_codes_read ON promo_codes
  FOR SELECT
  USING (active = true);
