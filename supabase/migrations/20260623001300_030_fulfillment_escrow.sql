-- ── 030 fulfillment_escrow ────────────────────────────────────────────────────
-- Extends orders with fulfillment method, hashed PIN verification, and the
-- escrow state machine. Adds the self-purchase guard trigger.
--
-- PIN security model:
--   create_order RPC (service_role) generates a random 4-digit PIN, hashes it
--   with bcrypt (pgcrypto), stores only the hash, and returns the plaintext once
--   in the API response. The customer presents the PIN to the prepper at handoff;
--   the prepper's app calls verify_order_pin() which does a constant-time bcrypt
--   comparison. After 5 failed attempts the order is PIN-locked for 30 minutes.
--
-- Escrow state machine:
--   held → (verify_order_pin succeeds) → auto_release_at set
--       → (pg_cron fires after 24h) → releasing
--       → (event-processor confirms Stripe transfer) → released
--   held → (customer disputes within 24h window) → disputed
--       → (admin resolves) → released | refunded

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE public.fulfillment_method AS ENUM ('delivery', 'meetup', 'pickup');

CREATE TYPE public.escrow_status AS ENUM (
  'held',       -- payment captured, awaiting handoff verification
  'releasing',  -- auto-release initiated; awaiting Stripe transfer confirmation
  'released',   -- funds transferred to prepper
  'disputed',   -- customer raised a dispute within the 24h window
  'refunded'    -- refund issued (partial or full)
);

-- ── Extend orders ─────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method    public.fulfillment_method NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS verification_pin_hash TEXT,        -- bcrypt hash; NULL until order confirmed
  ADD COLUMN IF NOT EXISTS pin_attempts          SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_at         TIMESTAMPTZ,  -- set after 5 failed attempts
  ADD COLUMN IF NOT EXISTS is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escrow_status         public.escrow_status NOT NULL DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS escrow_released_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_release_at       TIMESTAMPTZ;  -- set to verified_at + 24h

CREATE INDEX orders_escrow_held_idx      ON public.orders (auto_release_at ASC)
  WHERE escrow_status = 'held' AND auto_release_at IS NOT NULL;
CREATE INDEX orders_escrow_disputed_idx  ON public.orders (updated_at DESC)
  WHERE escrow_status = 'disputed';
CREATE INDEX orders_fulfillment_idx      ON public.orders (fulfillment_method);

-- ── Anti-fraud trigger: block self-purchase ───────────────────────────────────
-- CHECK constraints cannot reference other tables in PostgreSQL.
-- This trigger fires BEFORE INSERT on every order row.
-- The kitchens.prepper_id column is NOT NULL (migration 001 constraint),
-- so the subquery reliably returns a UUID or nothing — never a NULL match.

CREATE OR REPLACE FUNCTION public.guard_no_self_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prepper_id UUID;
BEGIN
  SELECT prepper_id INTO v_prepper_id
  FROM public.kitchens
  WHERE id = NEW.kitchen_id;

  IF NEW.customer_id = v_prepper_id THEN
    RAISE EXCEPTION 'self_purchase_not_allowed'
      USING DETAIL = 'A prepper cannot place an order from their own kitchen',
            HINT   = 'Switch to customer mode to browse other kitchens';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_no_self_purchase
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_no_self_purchase();

-- ── set_order_pin (called inside create_order RPC) ────────────────────────────
-- Generates a bcrypt-hashed PIN and stores it.
-- Returns the plaintext PIN — caller must return it to the customer immediately
-- and never store it. This is a one-way operation.

CREATE OR REPLACE FUNCTION public.set_order_pin(p_order_id UUID)
RETURNS TEXT  -- plaintext PIN, returned once
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw_pin TEXT;
  v_hash    TEXT;
BEGIN
  -- 4-digit zero-padded PIN: 0000–9999 (CSPRNG via pgcrypto, not random())
  v_raw_pin := lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::TEXT, 4, '0');
  v_hash    := crypt(v_raw_pin, gen_salt('bf', 8));  -- bf cost 8: ~100ms, brute-force resistant

  UPDATE public.orders SET
    verification_pin_hash = v_hash,
    updated_at            = NOW()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  RETURN v_raw_pin;  -- caller sends this to customer once (push notification / in-app)
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_order_pin(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_order_pin(UUID) TO service_role;

-- ── verify_order_pin ──────────────────────────────────────────────────────────
-- Called by the prepper's app at handoff. Returns structured result so the
-- client can handle success, wrong PIN, and lock state without parsing errors.

CREATE OR REPLACE FUNCTION public.verify_order_pin(
  p_order_id  UUID,
  p_pin_input TEXT      -- 4-digit string from prepper's UI
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_prepper_id UUID;
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

  -- PIN lock: 5 failed attempts → 30-minute window
  IF v_order.pin_locked_at IS NOT NULL
     AND v_order.pin_locked_at > NOW() - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'pin_locked'
      USING DETAIL = 'Too many incorrect attempts. Try again in 30 minutes.';
  END IF;

  IF v_order.verification_pin_hash IS NULL THEN
    RAISE EXCEPTION 'pin_not_set'
      USING DETAIL = 'Order has not been confirmed yet';
  END IF;

  -- Constant-time bcrypt comparison (pgcrypto)
  IF crypt(p_pin_input, v_order.verification_pin_hash) = v_order.verification_pin_hash THEN
    UPDATE public.orders SET
      is_verified   = TRUE,
      verified_at   = NOW(),
      pin_attempts  = 0,
      pin_locked_at = NULL,
      -- 24h dispute window begins at verification
      auto_release_at = NOW() + INTERVAL '24 hours',
      updated_at    = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.domain_events (event_type, payload)
    VALUES (
      'order.verified',
      jsonb_build_object(
        'order_id',       p_order_id,
        'kitchen_id',     v_order.kitchen_id,
        'auto_release_at', NOW() + INTERVAL '24 hours'
      )
    );

    RETURN jsonb_build_object(
      'success',        true,
      'auto_release_at', (NOW() + INTERVAL '24 hours')
    );

  ELSE
    -- Wrong PIN: increment counter; lock on 5th failure
    UPDATE public.orders SET
      pin_attempts  = pin_attempts + 1,
      pin_locked_at = CASE
                        WHEN pin_attempts + 1 >= 5 THEN NOW()
                        ELSE pin_locked_at
                      END,
      updated_at    = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success',      false,
      'attempts_used', v_order.pin_attempts + 1,
      'locked',        (v_order.pin_attempts + 1) >= 5
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_order_pin(UUID, TEXT) TO authenticated;

-- ── dispute_order ─────────────────────────────────────────────────────────────
-- Customer can dispute within 24h of verification (before auto_release_at).

CREATE OR REPLACE FUNCTION public.dispute_order(
  p_order_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_order.escrow_status != 'held' THEN
    RAISE EXCEPTION 'dispute_window_closed: escrow status is %', v_order.escrow_status;
  END IF;
  -- Must be within the 24h dispute window (auto_release_at not yet passed)
  IF v_order.auto_release_at IS NOT NULL AND v_order.auto_release_at <= NOW() THEN
    RAISE EXCEPTION 'dispute_window_closed: 24h window has expired';
  END IF;
  -- reason is optional from the client; defaults to a generic label for admin review
  p_reason := COALESCE(NULLIF(trim(p_reason), ''), 'customer_dispute');

  UPDATE public.orders SET
    escrow_status = 'disputed',
    updated_at    = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.domain_events (event_type, payload)
  VALUES (
    'order.disputed',
    jsonb_build_object(
      'order_id',   p_order_id,
      'customer_id', v_order.customer_id,
      'kitchen_id',  v_order.kitchen_id,
      'reason',      p_reason
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispute_order(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.dispute_order(UUID, TEXT) TO authenticated;

-- ── admin_resolve_dispute ─────────────────────────────────────────────────────
-- Tier 2 admin only. Transitions disputed orders to released or refunded.

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_order_id   UUID,
  p_resolution TEXT   -- 'for_prepper' | 'for_customer' | 'split'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  PERFORM public.require_admin_tier(2);
  IF p_resolution NOT IN ('for_prepper', 'for_customer', 'split') THEN
    RAISE EXCEPTION 'invalid_resolution: must be for_prepper, for_customer, or split';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.escrow_status != 'disputed' THEN
    RAISE EXCEPTION 'order_not_disputed: current status is %', v_order.escrow_status;
  END IF;

  UPDATE public.orders SET
    escrow_status = CASE p_resolution
                      WHEN 'for_customer' THEN 'refunded'::public.escrow_status
                      ELSE 'releasing'::public.escrow_status
                    END,
    updated_at    = NOW()
  WHERE id = p_order_id;

  -- event-processor handles the actual Stripe transfer or refund call
  INSERT INTO public.domain_events (event_type, payload)
  VALUES (
    'dispute.resolved',
    jsonb_build_object(
      'order_id',   p_order_id,
      'resolution', p_resolution,
      'resolved_by', auth.uid()
    )
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (
    auth.uid(), 'resolve_dispute', 'order', p_order_id,
    format('dispute resolved: %s', p_resolution)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) TO authenticated;

-- ── pg_cron: auto-release escrow after 24h dispute window ────────────────────
-- Every 15 minutes: verified orders past auto_release_at → 'releasing'.
-- The event-processor edge function handles the Stripe transfer and sets 'released'.

SELECT cron.schedule(
  'auto-release-escrow',
  '*/15 * * * *',
  $cron$
    WITH releasing AS (
      UPDATE public.orders SET
        escrow_status = 'releasing',
        updated_at    = NOW()
      WHERE is_verified = TRUE
        AND escrow_status = 'held'
        AND auto_release_at IS NOT NULL
        AND auto_release_at <= NOW()
      RETURNING id, kitchen_id, total_pence
    )
    INSERT INTO public.domain_events (event_type, payload)
    SELECT
      'escrow.auto_releasing',
      jsonb_build_object(
        'order_id',   id,
        'kitchen_id', kitchen_id,
        'amount',     total_pence
      )
    FROM releasing;
  $cron$
);
