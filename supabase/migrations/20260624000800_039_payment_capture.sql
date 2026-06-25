-- ── 039 payment_capture ───────────────────────────────────────────────────────
-- Sprint 31 (capture half): the front of the money loop — customer pays →
-- funds in escrow. create_order leaves payments.status = 'pending'; the
-- stripe-checkout edge fn creates a PaymentIntent and the webhook calls
-- record_payment_capture on payment_intent.succeeded.
--
-- Integrity (payment_integrity): no transfer may fire on an unpaid order, so
-- _begin_release_operation now also requires the payment to be captured/in_escrow.
-- This closes the gap where a verified order with an unpaid (pending) payment
-- could otherwise reach the release path.

-- ── service_role: mark a payment captured & held in escrow ────────────────────

CREATE OR REPLACE FUNCTION public.record_payment_capture(
  p_order_id          UUID,
  p_payment_intent_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  -- Idempotent: already captured/held/released → no-op.
  IF v_payment.status IN ('captured','in_escrow','released') THEN RETURN; END IF;

  UPDATE public.payments SET
    status                   = 'in_escrow',
    stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, p_payment_intent_id),
    captured_at              = NOW(),
    updated_at               = NOW()
  WHERE order_id = p_order_id;

  -- Order stays 'pending' (awaiting prepper confirmation); escrow already 'held'.
  INSERT INTO public.domain_events (event_type, payload)
  VALUES ('order.paid', jsonb_build_object('order_id', p_order_id, 'payment_intent', p_payment_intent_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_payment_capture(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_payment_capture(UUID, TEXT) TO service_role;

-- ── service_role: mark a payment failed (payment_intent.payment_failed) ───────

CREATE OR REPLACE FUNCTION public.record_payment_failed(
  p_order_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  -- Never override a captured payment with a stale failure.
  IF v_payment.status IN ('captured','in_escrow','released','refunded') THEN RETURN; END IF;

  UPDATE public.payments SET status = 'failed', updated_at = NOW() WHERE order_id = p_order_id;

  INSERT INTO public.domain_events (event_type, payload)
  VALUES ('order.payment_failed', jsonb_build_object('order_id', p_order_id, 'reason', COALESCE(p_reason,'card_declined')));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_payment_failed(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_payment_failed(UUID, TEXT) TO service_role;

-- ── Tighten release gate: require a captured payment ──────────────────────────
-- Recreates _begin_release_operation (038) with the added payment-status check.

CREATE OR REPLACE FUNCTION public._begin_release_operation(p_order_id UUID)
RETURNS public.payment_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE; v_payment public.payments%ROWTYPE;
  v_op public.payment_operations%ROWTYPE; v_acct public.stripe_accounts%ROWTYPE; v_prepper UUID;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT v_order.is_verified THEN RAISE EXCEPTION 'order_not_verified'; END IF;
  IF v_order.escrow_status NOT IN ('releasing','held') THEN
    RAISE EXCEPTION 'order_not_releasable: escrow=%', v_order.escrow_status;
  END IF;

  SELECT prepper_id INTO v_prepper FROM public.kitchens WHERE id = v_order.kitchen_id;
  SELECT * INTO v_acct FROM public.stripe_accounts WHERE prepper_id = v_prepper;
  IF NOT FOUND OR NOT v_acct.payouts_enabled THEN
    RAISE EXCEPTION 'prepper_payouts_not_enabled';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  -- payment_integrity: never transfer funds that were never captured.
  IF v_payment.status NOT IN ('captured','in_escrow') THEN
    RAISE EXCEPTION 'payment_not_captured: status=%', v_payment.status;
  END IF;

  SELECT * INTO v_op FROM public.payment_operations
  WHERE payment_id = v_payment.id AND operation_type = 'release'
    AND status IN ('pending','processing','completed');
  IF FOUND THEN
    IF v_op.status = 'completed' THEN RAISE EXCEPTION 'already_released: operation_id=%', v_op.id; END IF;
    RETURN v_op;
  END IF;

  INSERT INTO public.payment_operations (
    payment_id, operation_type, initiated_by, status,
    stripe_idempotency_key, amount_pence, currency, reason, metadata)
  VALUES (
    v_payment.id, 'release', NULL, 'pending',
    'release_' || p_order_id::TEXT, v_payment.prepper_payout_pence, v_payment.currency,
    'escrow release transfer',
    jsonb_build_object('order_id', p_order_id, 'prepper_id', v_prepper,
                       'stripe_account_id', v_acct.stripe_account_id))
  RETURNING * INTO v_op;
  RETURN v_op;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._begin_release_operation(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._begin_release_operation(UUID) TO service_role;
