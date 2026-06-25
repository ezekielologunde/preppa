-- ── 033 progressive_pin_lock ──────────────────────────────────────────────────
-- Sprint 30 red-team fix (CRITICAL): the flat 30-minute PIN lock let an attacker
-- brute-force a 4-digit PIN (10,000 combos) in ~10h by waiting out each window.
--
-- New policy — escalating lockout keyed on cumulative pin_attempts:
--     5–9   failed attempts → 30-minute lock
--     10–14 failed attempts → 24-hour lock
--     15+   failed attempts → permanent lock (requires admin reset)
-- This caps a brute-force attacker at ~14 guesses before a manual unlock is
-- required, making 4-digit PINs safe in practice.
--
-- Also (red-team MEDIUM): defensive CHECK so kitchen_capacity.orders_accepted
-- can never go negative even if a future decrement path is added.

-- ── Lock-interval helper ──────────────────────────────────────────────────────
-- Returns the lock duration for a given cumulative attempt count.
-- NULL means "permanent" (no automatic expiry; admin must reset).

CREATE OR REPLACE FUNCTION public._pin_lock_interval(p_attempts INTEGER)
RETURNS INTERVAL
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_attempts >= 15 THEN NULL                  -- permanent
    WHEN p_attempts >= 10 THEN INTERVAL '24 hours'
    WHEN p_attempts >= 5  THEN INTERVAL '30 minutes'
    ELSE INTERVAL '0'                                 -- not locked yet
  END
$$;

-- ── verify_order_pin (progressive lock) ───────────────────────────────────────
-- Same contract and return shape as migration 030; only the lock logic changes.

CREATE OR REPLACE FUNCTION public.verify_order_pin(
  p_order_id  UUID,
  p_pin_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      public.orders%ROWTYPE;
  v_prepper_id UUID;
  v_lock_iv    INTERVAL;
  v_next       INTEGER;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Only the prepper on this order can verify
  SELECT prepper_id INTO v_prepper_id
  FROM public.kitchens WHERE id = v_order.kitchen_id;
  IF v_prepper_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Idempotent: already verified
  IF v_order.is_verified THEN
    RETURN jsonb_build_object('success', true, 'already_verified', true);
  END IF;

  -- Progressive lock check, keyed on cumulative attempts.
  IF v_order.pin_locked_at IS NOT NULL THEN
    v_lock_iv := public._pin_lock_interval(v_order.pin_attempts);
    IF v_lock_iv IS NULL THEN
      RAISE EXCEPTION 'pin_locked_permanent'
        USING DETAIL = 'Too many incorrect attempts. Contact support to unlock.';
    ELSIF v_order.pin_locked_at + v_lock_iv > NOW() THEN
      RAISE EXCEPTION 'pin_locked'
        USING DETAIL = format('Locked until %s.', to_char(v_order.pin_locked_at + v_lock_iv, 'HH24:MI'));
    END IF;
    -- lock window has elapsed; allow this attempt to proceed
  END IF;

  IF v_order.verification_pin_hash IS NULL THEN
    RAISE EXCEPTION 'pin_not_set'
      USING DETAIL = 'Order has not been confirmed yet';
  END IF;

  -- Constant-time bcrypt comparison (pgcrypto)
  IF crypt(p_pin_input, v_order.verification_pin_hash) = v_order.verification_pin_hash THEN
    UPDATE public.orders SET
      is_verified     = TRUE,
      verified_at     = NOW(),
      pin_attempts    = 0,
      pin_locked_at   = NULL,
      auto_release_at = NOW() + INTERVAL '24 hours',
      updated_at      = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.domain_events (event_type, payload)
    VALUES (
      'order.verified',
      jsonb_build_object(
        'order_id',        p_order_id,
        'kitchen_id',      v_order.kitchen_id,
        'auto_release_at', NOW() + INTERVAL '24 hours'
      )
    );

    RETURN jsonb_build_object(
      'success',         true,
      'auto_release_at', (NOW() + INTERVAL '24 hours')
    );

  ELSE
    v_next := v_order.pin_attempts + 1;
    -- Re-anchor the lock clock on every failure at/after the 5th, so the
    -- escalating interval always measures from the most recent attempt.
    UPDATE public.orders SET
      pin_attempts  = v_next,
      pin_locked_at = CASE WHEN v_next >= 5 THEN NOW() ELSE pin_locked_at END,
      updated_at    = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success',         false,
      'attempts_used',   v_next,
      'locked',          v_next >= 5,
      'lock_tier',       CASE
                           WHEN v_next >= 15 THEN 'permanent'
                           WHEN v_next >= 10 THEN '24h'
                           WHEN v_next >= 5  THEN '30m'
                           ELSE 'none'
                         END
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) TO authenticated;

-- ── admin_unlock_order_pin ────────────────────────────────────────────────────
-- Tier 1+ support can clear a PIN lock (resets the attempt counter) so a
-- legitimate customer/prepper is not permanently stranded.

CREATE OR REPLACE FUNCTION public.admin_unlock_order_pin(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin_tier(1);

  UPDATE public.orders SET
    pin_attempts  = 0,
    pin_locked_at = NULL,
    updated_at    = NOW()
  WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (auth.uid(), 'unlock_order_pin', 'order', p_order_id, 'PIN lock cleared by support');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_unlock_order_pin(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_unlock_order_pin(UUID) TO authenticated;

-- ── Defensive: orders_accepted can never go negative ──────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kitchen_capacity_orders_accepted_nonneg'
  ) THEN
    ALTER TABLE public.kitchen_capacity
      ADD CONSTRAINT kitchen_capacity_orders_accepted_nonneg
      CHECK (orders_accepted >= 0);
  END IF;
END;
$$;
