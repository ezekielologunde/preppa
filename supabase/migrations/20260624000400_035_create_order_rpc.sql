-- ── 035 create_order_rpc ──────────────────────────────────────────────────────
-- Sprint 30 P0: the order-creation backend never existed. Migration comments
-- referenced a "create_order RPC (service_role)" but no such function was ever
-- written, and the legacy stripe-checkout edge function targets the old
-- pre-reset schema (orders.total, meals, USD). Customers literally cannot order.
--
-- This RPC is the schema-correct (001-034) creation path. It atomically:
--   1. validates the listing is published and its kitchen is open
--   2. blocks self-purchase early (triggers also enforce it)
--   3. computes GBP totals + 10% platform fee
--   4. inserts the order (escrow 'held'), the order item, and a pending payment
--   5. issues a one-time bcrypt-hashed handoff PIN (returned in plaintext once)
--
-- Payment CAPTURE is intentionally out of scope here — it lands with Stripe
-- Connect (separate P0). The order enters the escrow/PIN fulfillment flow with a
-- pending payment; the event bus drives capacity projection + notifications via
-- the existing order.created trigger.

CREATE OR REPLACE FUNCTION public.create_order(
  p_listing_id         UUID,
  p_quantity           INTEGER DEFAULT 1,
  p_fulfillment_method public.fulfillment_method DEFAULT 'pickup',
  p_notes              TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_listing  public.listings%ROWTYPE;
  v_kstatus  public.kitchen_status;
  v_total    INTEGER;
  v_fee      INTEGER;
  v_order_id UUID;
  v_pin      TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'invalid_quantity: must be between 1 and 10';
  END IF;

  SELECT * INTO v_listing FROM public.listings
  WHERE id = p_listing_id AND status = 'published' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_unavailable'; END IF;
  IF v_listing.kitchen_id IS NULL THEN RAISE EXCEPTION 'listing_has_no_kitchen'; END IF;

  -- Early, friendly self-purchase guard (the INSERT triggers also enforce this)
  IF v_listing.prepper_id = v_uid THEN
    RAISE EXCEPTION 'self_purchase_not_allowed';
  END IF;

  -- Kitchen must be open for orders
  v_kstatus := public.get_kitchen_status(v_listing.kitchen_id);
  IF v_kstatus IN ('booked','offline','vacation','emergency_pause') THEN
    RAISE EXCEPTION 'kitchen_not_accepting_orders: %', v_kstatus;
  END IF;

  v_total := v_listing.price_pence * p_quantity;
  v_fee   := round(v_total * 0.10);  -- 10% platform fee

  INSERT INTO public.orders (
    customer_id, kitchen_id, status, total_pence, platform_fee_pence,
    fulfillment_method, notes, escrow_status)
  VALUES (
    v_uid, v_listing.kitchen_id, 'pending', v_total, v_fee,
    p_fulfillment_method, NULLIF(trim(p_notes), ''), 'held')
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, listing_id, listing_name, quantity, unit_pence)
  VALUES (v_order_id, v_listing.id, v_listing.name, p_quantity, v_listing.price_pence);

  INSERT INTO public.payments (
    order_id, status, amount_pence, platform_fee_pence, prepper_payout_pence, currency)
  VALUES (
    v_order_id, 'pending', v_total, v_fee, v_total - v_fee, 'gbp');

  -- One-time handoff PIN: bcrypt hash stored on the order, plaintext returned once.
  v_pin := public.set_order_pin(v_order_id);

  RETURN jsonb_build_object(
    'order_id',    v_order_id,
    'pin',         v_pin,
    'total_pence', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order(UUID, INTEGER, public.fulfillment_method, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_order(UUID, INTEGER, public.fulfillment_method, TEXT) TO authenticated;
