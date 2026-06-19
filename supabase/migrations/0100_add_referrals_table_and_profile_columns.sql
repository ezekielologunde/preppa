-- Migration 0100: Add referrals table and referral columns to profiles
-- Tracks who referred whom and the resulting credit award.

CREATE TABLE IF NOT EXISTS referrals (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  code         text        NOT NULL,
  status       text                 DEFAULT 'pending',
  credit_amount numeric              DEFAULT 5.00,
  created_at   timestamptz          DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own referrals" ON referrals;
CREATE POLICY "Users can see their own referrals" ON referrals
  FOR SELECT
  USING (auth.uid() = referrer_id);

-- Add referral tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL;
