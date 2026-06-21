-- 0141_remove_legacy_payout_bank_columns.sql
--
-- Stripe Connect is now the exclusive payout method — preppers link their bank
-- via the stripe-connect edge function and receive funds directly from Stripe.
-- The old bank-detail columns (filled with 'stripe_connect' sentinel values
-- since the UI switched) serve no purpose and add unnecessary schema noise.

ALTER TABLE payout_requests
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS account_number,
  DROP COLUMN IF EXISTS account_number_encrypted,
  DROP COLUMN IF EXISTS account_number_masked,
  DROP COLUMN IF EXISTS account_name;
