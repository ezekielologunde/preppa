-- 0111_fix_create_order_gift_card_validation.sql
-- Security fix: create_order was trusting the client-supplied p_gift_card_amount
-- without validating it against the card's actual balance. A malicious client
-- could pass any amount and receive that discount.
-- Fix: validate the card (active, not expired, has balance) and clamp
-- v_gc_amount to LEAST(p_gift_card_amount, card.balance) before storing.

CREATE OR REPLACE FUNCTION public.create_order(
  p_fulfillment      fulfillment_type DEFAULT 'delivery',
  p_address_id       uuid             DEFAULT NULL,
  p_note             text             DEFAULT NULL,
  p_tip              numeric          DEFAULT 0,
  p_gift_card_code   text             DEFAULT NULL,
  p_gift_card_amount numeric          DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_order         uuid;
  v_subtotal      numeric;
  v_delivery      numeric;
  v_gc_amount     numeric := 0;
  v_total         numeric;
  v_card_balance  numeric;
  v_card_active   boolean;
  v_card_expires  timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(ci.quantity * m.price), 0)
  INTO   v_subtotal
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  WHERE  ci.user_id = v_uid;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'P0001';
  END IF;

  v_delivery := CASE
    WHEN p_fulfillment IN ('pickup', 'home_cook') THEN 0
    ELSE 3.99
  END;

  -- Validate and clamp gift card discount against real card state
  IF p_gift_card_code IS NOT NULL AND COALESCE(p_gift_card_amount, 0) > 0 THEN
    SELECT balance, is_active, expires_at
    INTO   v_card_balance, v_card_active, v_card_expires
    FROM   gift_cards
    WHERE  code = p_gift_card_code;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'gift card not found' USING ERRCODE = 'P0001';
    END IF;
    IF NOT COALESCE(v_card_active, false) THEN
      RAISE EXCEPTION 'gift card is not active' USING ERRCODE = 'P0001';
    END IF;
    IF v_card_expires IS NOT NULL AND v_card_expires < now() THEN
      RAISE EXCEPTION 'gift card has expired' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_card_balance, 0) <= 0 THEN
      RAISE EXCEPTION 'gift card has no remaining balance' USING ERRCODE = 'P0001';
    END IF;

    -- Clamp to actual balance — client cannot inflate this
    v_gc_amount := LEAST(GREATEST(0, COALESCE(p_gift_card_amount, 0)), v_card_balance);
  END IF;

  v_total := GREATEST(0, v_subtotal + v_delivery + COALESCE(p_tip, 0) - v_gc_amount);

  INSERT INTO orders (
    customer_id, status, fulfillment, address_id, note,
    subtotal, delivery_fee, tip, total,
    gift_card_code, gift_card_amount
  )
  SELECT
    v_uid, 'pending', p_fulfillment, p_address_id, p_note,
    v_subtotal, v_delivery, COALESCE(p_tip, 0), v_total,
    CASE WHEN v_gc_amount > 0 THEN p_gift_card_code ELSE NULL END,
    v_gc_amount
  RETURNING id INTO v_order;

  INSERT INTO order_items (order_id, meal_id, quantity, unit_price)
  SELECT v_order, ci.meal_id, ci.quantity, m.price
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  WHERE  ci.user_id = v_uid;

  DELETE FROM cart_items WHERE user_id = v_uid;

  -- Zero-total: gift card covers full amount — redeem inline and record payment
  IF v_total = 0 AND p_gift_card_code IS NOT NULL AND v_gc_amount > 0 THEN
    PERFORM redeem_gift_card(p_gift_card_code, v_gc_amount);
    PERFORM record_payment(v_order, 'gift_card:' || p_gift_card_code, 'succeeded', 0);
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(fulfillment_type, uuid, text, numeric, text, numeric) TO authenticated;
