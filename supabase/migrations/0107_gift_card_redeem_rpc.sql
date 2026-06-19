-- Replace the open gift_cards UPDATE RLS with a SECURITY DEFINER RPC.
-- The previous UPDATE policy let any auth user claim any active card —
-- the code (secret) was never verified. This RPC requires the caller to
-- supply the code, atomically decrements the balance, and is the only
-- write path for redemption.

DROP POLICY IF EXISTS gift_cards_redeem ON gift_cards;

-- Callers cannot UPDATE gift_cards directly at all now.
-- They must go through redeem_gift_card().

CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_code    text,
  p_amount  numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card  gift_cards;
  v_uid   uuid := auth.uid();
  v_new_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the row to prevent concurrent double-redemptions
  SELECT * INTO v_card
  FROM gift_cards
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid code' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_card.is_active THEN
    RAISE EXCEPTION 'gift card is inactive' USING ERRCODE = 'P0003';
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RAISE EXCEPTION 'gift card has expired' USING ERRCODE = 'P0004';
  END IF;

  IF v_card.balance <= 0 THEN
    RAISE EXCEPTION 'gift card has no remaining balance' USING ERRCODE = 'P0005';
  END IF;

  v_new_balance := GREATEST(0, v_card.balance - p_amount);

  UPDATE gift_cards
  SET
    balance     = v_new_balance,
    redeemed_by = COALESCE(v_card.redeemed_by, v_uid),
    is_active   = CASE WHEN v_new_balance = 0 THEN false ELSE is_active END
  WHERE code = p_code;

  RETURN jsonb_build_object(
    'applied',           LEAST(p_amount, v_card.balance),
    'remaining_balance', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric) TO authenticated;
