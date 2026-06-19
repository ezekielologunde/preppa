-- Migration 0091: Create payout_requests table
-- Preppers submit payout requests; admins process them.

CREATE TABLE IF NOT EXISTS payout_requests (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prepper_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         numeric     NOT NULL,
  status         text        NOT NULL DEFAULT 'pending',
  bank_name      text,
  account_number text,
  account_name   text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preppers see own requests" ON payout_requests;
CREATE POLICY "preppers see own requests" ON payout_requests
  FOR SELECT
  USING (prepper_id = auth.uid());

DROP POLICY IF EXISTS "preppers insert own requests" ON payout_requests;
CREATE POLICY "preppers insert own requests" ON payout_requests
  FOR INSERT
  WITH CHECK (prepper_id = auth.uid());
