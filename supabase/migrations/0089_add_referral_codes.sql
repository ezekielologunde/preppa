-- Migration 0089: Create referral_codes table
-- Stores unique referral codes per user with usage tracking.

CREATE TABLE IF NOT EXISTS referral_codes (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text        NOT NULL UNIQUE,
  uses_count integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_own ON referral_codes;
CREATE POLICY referral_own ON referral_codes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
