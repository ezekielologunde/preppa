-- Extend create_order() with gift card support.
-- When p_gift_card_code is provided, the gift card amount is subtracted from
-- the order total. If the gift card covers the full amount (total = 0),
-- the card is redeemed and the payment is recorded inline so the order
-- proceeds without Stripe.

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
  v_uid         uuid := auth.uid();
  v_order       uuid;
  v_subtotal    numeric;
  v_delivery    numeric;
  v_gc_amount   numeric;
  v_total       numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Compute subtotal from cart items
  SELECT COALESCE(SUM(ci.quantity * m.price), 0)
  INTO   v_subtotal
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  WHERE  ci.user_id = v_uid;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'cart is empty' USING ERRCODE = 'P0001';
  END IF;

  -- Delivery fee (simple flat or free if pickup/home_cook)
  v_delivery := CASE
    WHEN p_fulfillment IN ('pickup', 'home_cook') THEN 0
    ELSE 3.99
  END;

  v_gc_amount := GREATEST(0, COALESCE(p_gift_card_amount, 0));
  v_total     := GREATEST(0, v_subtotal + v_delivery + COALESCE(p_tip, 0) - v_gc_amount);

  -- Insert the order
  INSERT INTO orders (
    customer_id, status, fulfillment, address_id, note,
    subtotal, delivery_fee, tip, total,
    gift_card_code, gift_card_amount
  )
  SELECT
    v_uid, 'pending', p_fulfillment, p_address_id, p_note,
    v_subtotal, v_delivery, COALESCE(p_tip, 0), v_total,
    p_gift_card_code, v_gc_amount
  RETURNING id INTO v_order;

  -- Move cart items to order_items
  INSERT INTO order_items (order_id, meal_id, quantity, unit_price)
  SELECT v_order, ci.meal_id, ci.quantity, m.price
  FROM   cart_items ci
  JOIN   meals m ON m.id = ci.meal_id
  WHERE  ci.user_id = v_uid;

  DELETE FROM cart_items WHERE user_id = v_uid;

  -- Zero-total: gift card covers everything — redeem inline and mark paid
  IF v_total = 0 AND p_gift_card_code IS NOT NULL THEN
    PERFORM redeem_gift_card(p_gift_card_code, v_gc_amount);
    PERFORM record_payment(v_order, 'gift_card:' || p_gift_card_code, 'succeeded', 0);
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(fulfillment_type, uuid, text, numeric, text, numeric) TO authenticated;
