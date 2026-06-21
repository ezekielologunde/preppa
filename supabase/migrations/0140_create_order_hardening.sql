-- 0140_create_order_hardening.sql
--
-- Two security hardening fixes for create_order (single-kitchen path):
--
--  1. Gift card SELECT FOR UPDATE — prevents concurrent double-spend.
--     Without this, two simultaneous checkout calls with the same gift card
--     code both read the same positive balance, both pass validation, and
--     both deduct from the same card.
--
--  2. Self-order prevention — a prepper can no longer place an order at
--     their own kitchen (edge case but trivially exploitable for free meals).

CREATE OR REPLACE FUNCTION public.create_order(
  p_fulfillment      fulfillment_type  DEFAULT 'delivery',
  p_address_id       uuid              DEFAULT NULL,
  p_note             text              DEFAULT NULL,
  p_tip              numeric           DEFAULT 0,
  p_gift_card_code   text              DEFAULT NULL,
  p_gift_card_amount numeric           DEFAULT 0,
  p_idempotency_key  uuid              DEFAULT NULL,
  p_scheduled_at     timestamptz       DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid        := auth.uid();
  v_cart          uuid;
  v_prepper       uuid;
  v_count         int;
  v_order         uuid;
  v_subtotal      numeric;
  v_delivery      numeric;
  v_gc_amount     numeric     := 0;
  v_total         numeric;
  v_card_balance  numeric;
  v_card_active   boolean;
  v_card_expires  timestamptz;
  v_pending_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency: return existing order if this key was already used by this user
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order
    FROM   orders
    WHERE  idempotency_key = p_idempotency_key
      AND  customer_id = v_uid;
    IF FOUND THEN RETURN v_order; END IF;
  END IF;

  -- 3-pending-order cap: prevent runaway duplicate submissions
  SELECT COUNT(*) INTO v_pending_count
  FROM   orders
  WHERE  customer_id = v_uid
    AND  status = 'pending'
    AND  created_at > NOW() - INTERVAL '2 hours';

  IF v_pending_count >= 3 THEN
    RAISE EXCEPTION 'too many pending orders — complete or cancel existing orders first'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve cart for this user
  SELECT id INTO v_cart FROM carts WHERE user_id = v_uid;
  IF v_cart IS NULL THEN
    RAISE EXCEPTION 'no cart found' USING ERRCODE = 'P0001';
  END IF;

  -- Ensure single prepper in cart
  SELECT COUNT(DISTINCT m.prepper_id), MIN(m.prepper_id::text)::uuid
  INTO   v_count, v_prepper
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  WHERE  ci.cart_id = v_cart;

  IF COALESCE(v_count, 0) = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'P0001';
  END IF;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'cart has items from multiple kitchens' USING ERRCODE = 'P0001';
  END IF;

  -- Self-order prevention
  IF EXISTS (
    SELECT 1 FROM prepper_profiles WHERE id = v_prepper AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'you cannot order from your own kitchen' USING ERRCODE = 'P0001';
  END IF;

  -- Reject if any meal is not published
  IF EXISTS (
    SELECT 1 FROM cart_items ci
    JOIN   meals m ON m.id = ci.meal_id
    WHERE  ci.cart_id = v_cart AND m.status <> 'published'
  ) THEN
    RAISE EXCEPTION 'cart contains an unavailable meal' USING ERRCODE = 'P0001';
  END IF;

  -- Server-side subtotal using base_price (prevents client price manipulation)
  SELECT COALESCE(SUM(ci.quantity * (m.base_price + COALESCE(mv.price_delta, 0))), 0)
  INTO   v_subtotal
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  LEFT JOIN meal_variants mv ON mv.id = ci.variant_id
  WHERE  ci.cart_id = v_cart;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'P0001';
  END IF;

  v_delivery := CASE
    WHEN p_fulfillment IN ('pickup', 'home_cook', 'meetup') THEN 0
    ELSE 3.99
  END;

  -- Validate and clamp gift card discount.
  -- FOR UPDATE locks the row so a concurrent redemption blocks until this
  -- transaction commits, preventing double-spend on the same card.
  IF p_gift_card_code IS NOT NULL AND COALESCE(p_gift_card_amount, 0) > 0 THEN
    SELECT balance, is_active, expires_at
    INTO   v_card_balance, v_card_active, v_card_expires
    FROM   gift_cards
    WHERE  code = p_gift_card_code
    FOR UPDATE;

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

    v_gc_amount := LEAST(GREATEST(0, COALESCE(p_gift_card_amount, 0)), v_card_balance);
  END IF;

  v_total := GREATEST(0, v_subtotal + v_delivery + COALESCE(p_tip, 0) - v_gc_amount);

  INSERT INTO orders (
    customer_id, prepper_id, status, fulfillment_type, address_id, fulfillment_note,
    subtotal, delivery_fee, tip, total,
    gift_card_code, gift_card_amount, idempotency_key, scheduled_at
  ) VALUES (
    v_uid, v_prepper, 'pending', p_fulfillment, p_address_id, p_note,
    v_subtotal, v_delivery, COALESCE(p_tip, 0), v_total,
    CASE WHEN v_gc_amount > 0 THEN p_gift_card_code ELSE NULL END,
    v_gc_amount, p_idempotency_key, p_scheduled_at
  )
  RETURNING id INTO v_order;

  INSERT INTO order_items (order_id, meal_id, variant_id, quantity, unit_price, total)
  SELECT v_order, ci.meal_id, ci.variant_id, ci.quantity,
         (m.base_price + COALESCE(mv.price_delta, 0)),
         (m.base_price + COALESCE(mv.price_delta, 0)) * ci.quantity
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  LEFT JOIN meal_variants mv ON mv.id = ci.variant_id
  WHERE  ci.cart_id = v_cart;

  DELETE FROM cart_items WHERE cart_id = v_cart;

  -- Zero-total: gift card covers everything — redeem inline and record payment
  IF v_total = 0 AND p_gift_card_code IS NOT NULL AND v_gc_amount > 0 THEN
    PERFORM redeem_gift_card(p_gift_card_code, v_gc_amount);
    PERFORM record_payment(v_order, 'gift_card:' || p_gift_card_code, 'succeeded', 0);
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(
  fulfillment_type, uuid, text, numeric, text, numeric, uuid, timestamptz
) TO authenticated;
