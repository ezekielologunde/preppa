-- 0139_create_multi_kitchen_order.sql
--
-- Adds create_multi_kitchen_order(p_orders jsonb) — an atomic alternative to
-- calling create_order in a client-side loop. The entire batch runs in a single
-- transaction: if any kitchen order fails (unavailable meal, wrong prepper,
-- self-order, etc.) every order in the batch rolls back, preventing the partial-
-- failure scenario where some kitchens succeed and others fail.
--
-- Each element of p_orders is a JSON object:
--   cart_item_ids  uuid[]          cart_items.id values for this kitchen's items
--   fulfillment    fulfillment_type 'delivery' | 'pickup' | 'meetup' | ...
--   address_id     uuid|null       required for delivery
--   note           text|null
--   tip            numeric         tip amount in dollars
--   scheduled_at   timestamptz|null
--   idempotency_key uuid|null      client-supplied dedup key
--
-- Returns uuid[] — one order ID per input spec, in the same order.

CREATE OR REPLACE FUNCTION public.create_multi_kitchen_order(
  p_orders jsonb
) RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid             := auth.uid();
  v_cart          uuid;
  v_order_ids     uuid[]           := ARRAY[]::uuid[];
  v_spec          jsonb;
  v_idx           int;
  v_n             int;
  v_order         uuid;
  v_prepper       uuid;
  v_prepper_count int;
  v_subtotal      numeric;
  v_delivery      numeric;
  v_total         numeric;
  v_tip           numeric;
  v_fulfillment   fulfillment_type;
  v_address       uuid;
  v_note          text;
  v_sched         timestamptz;
  v_idem          uuid;
  v_cart_item_ids uuid[];
  v_pending_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_cart FROM carts WHERE user_id = v_uid;
  IF v_cart IS NULL THEN
    RAISE EXCEPTION 'no cart found' USING ERRCODE = 'P0001';
  END IF;

  v_n := jsonb_array_length(p_orders);
  IF v_n < 1 THEN
    RAISE EXCEPTION 'orders array is empty' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM   orders
  WHERE  customer_id = v_uid
    AND  status = 'pending'
    AND  created_at > NOW() - INTERVAL '2 hours';

  IF v_pending_count + v_n > 5 THEN
    RAISE EXCEPTION 'too many pending orders — complete or cancel existing orders first'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_idx IN 0 .. v_n - 1 LOOP
    v_spec        := p_orders -> v_idx;
    v_fulfillment := (v_spec->>'fulfillment')::fulfillment_type;
    v_address     := (v_spec->>'address_id')::uuid;
    v_note        := v_spec->>'note';
    v_tip         := COALESCE((v_spec->>'tip')::numeric, 0);
    v_sched       := (v_spec->>'scheduled_at')::timestamptz;
    v_idem        := (v_spec->>'idempotency_key')::uuid;

    -- Idempotency: reuse existing order for this key
    IF v_idem IS NOT NULL THEN
      SELECT id INTO v_order
      FROM   orders
      WHERE  idempotency_key = v_idem AND customer_id = v_uid;
      IF FOUND THEN
        v_order_ids := v_order_ids || v_order;
        CONTINUE;
      END IF;
    END IF;

    -- Parse cart_item_ids from JSON string array
    SELECT ARRAY(SELECT t::uuid FROM jsonb_array_elements_text(v_spec->'cart_item_ids') AS t)
    INTO   v_cart_item_ids;

    IF array_length(v_cart_item_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'cart_item_ids is empty for order %', v_idx + 1 USING ERRCODE = 'P0001';
    END IF;

    -- All items must be in this user's cart and belong to exactly one prepper
    SELECT COUNT(DISTINCT m.prepper_id), MIN(m.prepper_id)
    INTO   v_prepper_count, v_prepper
    FROM   cart_items ci
    JOIN   meals m ON m.id = ci.meal_id
    WHERE  ci.id = ANY(v_cart_item_ids)
      AND  ci.cart_id = v_cart;

    IF COALESCE(v_prepper_count, 0) = 0 THEN
      RAISE EXCEPTION 'cart_item_ids for order % are not in your cart', v_idx + 1 USING ERRCODE = 'P0001';
    END IF;
    IF v_prepper_count > 1 THEN
      RAISE EXCEPTION 'items for order % span multiple kitchens', v_idx + 1 USING ERRCODE = 'P0001';
    END IF;

    -- Self-order prevention
    IF EXISTS (
      SELECT 1 FROM prepper_profiles WHERE id = v_prepper AND user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'you cannot order from your own kitchen' USING ERRCODE = 'P0001';
    END IF;

    -- All meals must be published
    IF EXISTS (
      SELECT 1
      FROM   cart_items ci
      JOIN   meals m ON m.id = ci.meal_id
      WHERE  ci.id = ANY(v_cart_item_ids)
        AND  ci.cart_id = v_cart
        AND  m.status <> 'published'
    ) THEN
      RAISE EXCEPTION 'order % contains an unavailable meal', v_idx + 1 USING ERRCODE = 'P0001';
    END IF;

    -- Server-side subtotal using DB prices (prevents client price manipulation)
    SELECT COALESCE(SUM(ci.quantity * (m.base_price + COALESCE(mv.price_delta, 0))), 0)
    INTO   v_subtotal
    FROM   cart_items ci
    JOIN   meals m ON m.id = ci.meal_id
    LEFT   JOIN meal_variants mv ON mv.id = ci.variant_id
    WHERE  ci.id = ANY(v_cart_item_ids)
      AND  ci.cart_id = v_cart;

    IF v_subtotal = 0 THEN
      RAISE EXCEPTION 'subtotal is zero for order %', v_idx + 1 USING ERRCODE = 'P0001';
    END IF;

    v_delivery := CASE
      WHEN v_fulfillment IN ('pickup', 'home_cook', 'meetup') THEN 0
      ELSE 3.99
    END;

    v_total := GREATEST(0, v_subtotal + v_delivery + COALESCE(v_tip, 0));

    INSERT INTO orders (
      customer_id, prepper_id, status, fulfillment_type, address_id,
      fulfillment_note, subtotal, delivery_fee, tip, total,
      idempotency_key, scheduled_at
    ) VALUES (
      v_uid, v_prepper, 'pending', v_fulfillment, v_address,
      v_note, v_subtotal, v_delivery, COALESCE(v_tip, 0), v_total,
      v_idem, v_sched
    )
    RETURNING id INTO v_order;

    INSERT INTO order_items (order_id, meal_id, variant_id, quantity, unit_price, total)
    SELECT v_order,
           ci.meal_id,
           ci.variant_id,
           ci.quantity,
           (m.base_price + COALESCE(mv.price_delta, 0)),
           ci.quantity * (m.base_price + COALESCE(mv.price_delta, 0))
    FROM   cart_items ci
    JOIN   meals m ON m.id = ci.meal_id
    LEFT   JOIN meal_variants mv ON mv.id = ci.variant_id
    WHERE  ci.id = ANY(v_cart_item_ids)
      AND  ci.cart_id = v_cart;

    v_order_ids := v_order_ids || v_order;
  END LOOP;

  -- Clear the cart only after all orders succeed — if any order above raised an
  -- exception the transaction rolls back and the cart is left intact.
  DELETE FROM cart_items WHERE cart_id = v_cart;

  RETURN v_order_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_multi_kitchen_order(jsonb) TO authenticated;
