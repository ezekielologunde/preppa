-- Migration 0116: Per-user promo code tracking and referral fraud prevention
--
-- promo_code_uses — prevents the same user from applying the same promo code twice.
--   The unique constraint (promo_code_id, user_id) is the enforcement mechanism;
--   the application layer should catch the unique-violation and surface a friendly error.
--
-- referrals — adds a self-referral check constraint.
--   Migration 0100 did NOT add a UNIQUE constraint on referred_id, so we add one here
--   to prevent a single user from being referred multiple times (bonus farming).

BEGIN;

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id  uuid        NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id       uuid        REFERENCES orders(id) ON DELETE SET NULL,
  used_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_uses_unique UNIQUE (promo_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS promo_code_uses_user_idx
  ON promo_code_uses(user_id);

ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own promo uses" ON promo_code_uses;
CREATE POLICY "Users can view their own promo uses"
  ON promo_code_uses FOR SELECT
  USING (user_id = auth.uid());

-- Referral fraud prevention: a user cannot refer themselves.
-- (Migration 0100 created the referrals table without this constraint.)
ALTER TABLE referrals
  ADD CONSTRAINT IF NOT EXISTS referrals_no_self_referral
    CHECK (referrer_id <> referred_id);

-- Prevent a referred_id from appearing more than once (one referral credit per user).
-- Migration 0100 did not add this uniqueness constraint.
ALTER TABLE referrals
  ADD CONSTRAINT IF NOT EXISTS referrals_unique_referred
    UNIQUE (referred_id);

COMMIT;
