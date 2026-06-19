-- Migration: add 'paid' to meal_request_bids.status CHECK constraint
-- Required so the stripe-webhook can mark bids as paid after Stripe payment completes.

-- Drop old constraint (no-op if it doesn't exist or was named differently)
ALTER TABLE meal_request_bids DROP CONSTRAINT IF EXISTS meal_request_bids_status_check;

-- Add updated constraint with 'paid' included
ALTER TABLE meal_request_bids
  ADD CONSTRAINT meal_request_bids_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'paid'));
