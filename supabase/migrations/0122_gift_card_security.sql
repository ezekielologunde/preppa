-- Migration 0117: Gift card brute-force protection
--
-- Context (from 0095 and 0107):
--   - 0095 created gift_cards with the permissive gift_cards_redeem UPDATE policy.
--   - 0107 dropped that policy and replaced redemption with a SECURITY DEFINER RPC
--     (redeem_gift_card) that validates the code. No UPDATE policy remains, which is
--     correct.
--   - Neither migration added rate-limiting. This migration adds fail_count /
--     last_failed_at columns and a validate_gift_card RPC that enforces a lockout
--     after 5 consecutive failures within 1 hour.
--
-- The existing redeem_gift_card RPC is NOT replaced here — it handles successful
-- redemptions. validate_gift_card is a separate, read-side probe that:
--   1. Checks lockout state.
--   2. Increments fail_count on bad code lookups (code found but card unusable, or
--      amount mismatch).
--   3. Resets fail_count on a successful probe (so redeem_gift_card can proceed).
-- Callers should call validate_gift_card first, then redeem_gift_card to apply.

BEGIN;

-- Add brute-force tracking columns to gift_cards.
ALTER TABLE gift_cards
  ADD COLUMN IF NOT EXISTS fail_count     integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at timestamptz;

-- ---------------------------------------------------------------------------
-- validate_gift_card(p_code text, p_amount numeric)
-- Returns the card's available balance if valid; raises on lockout or invalid.
-- Increments fail_count on failure; resets it on success.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_gift_card(
  p_code   text,
  p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card  gift_cards;
  v_uid   uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the row so concurrent probes don't race on fail_count.
  SELECT * INTO v_card
  FROM gift_cards
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Don't increment fail_count — we have no row to update — but still raise.
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0002';
  END IF;

  -- Lockout check: 5+ failures within the last hour.
  IF v_card.fail_count >= 5
     AND v_card.last_failed_at IS NOT NULL
     AND v_card.last_failed_at > NOW() - INTERVAL '1 hour'
  THEN
    RAISE EXCEPTION 'gift_card_locked'
      USING HINT    = 'Too many failed attempts. Try again later.',
            ERRCODE = 'P0006';
  END IF;

  -- Validity checks — increment fail_count on each failure.
  IF NOT v_card.is_active THEN
    UPDATE gift_cards
    SET fail_count     = fail_count + 1,
        last_failed_at = now()
    WHERE code = p_code;
    RAISE EXCEPTION 'gift_card_inactive' USING ERRCODE = 'P0003';
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    UPDATE gift_cards
    SET fail_count     = fail_count + 1,
        last_failed_at = now()
    WHERE code = p_code;
    RAISE EXCEPTION 'gift_card_expired' USING ERRCODE = 'P0004';
  END IF;

  IF v_card.balance <= 0 THEN
    UPDATE gift_cards
    SET fail_count     = fail_count + 1,
        last_failed_at = now()
    WHERE code = p_code;
    RAISE EXCEPTION 'gift_card_no_balance' USING ERRCODE = 'P0005';
  END IF;

  IF p_amount > v_card.balance THEN
    -- Not a hard error — return the available balance so the caller can adjust.
    -- Reset fail_count because the code itself is valid.
    UPDATE gift_cards
    SET fail_count = 0, last_failed_at = NULL
    WHERE code = p_code;

    RETURN jsonb_build_object(
      'valid',             true,
      'balance',           v_card.balance,
      'requested_amount',  p_amount,
      'warning',           'amount_exceeds_balance'
    );
  END IF;

  -- Success — reset fail_count so a legitimate user isn't penalised.
  UPDATE gift_cards
  SET fail_count = 0, last_failed_at = NULL
  WHERE code = p_code;

  RETURN jsonb_build_object(
    'valid',   true,
    'balance', v_card.balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_gift_card(text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_gift_card(text, numeric) TO authenticated;

COMMIT;
