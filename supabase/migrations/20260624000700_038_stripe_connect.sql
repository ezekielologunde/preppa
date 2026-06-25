-- ── 038 stripe_connect ────────────────────────────────────────────────────────
-- Sprint 31: production Stripe Connect on the CURRENT schema (001-037).
--
-- The legacy stripe-connect / stripe-webhook edge fns target the dead pre-reset
-- schema (prepper_profiles.stripe_account_id, gift_cards, …). This migration
-- builds the Connect data model on the live identity model: a prepper is
-- auth.users + kitchens.prepper_id (UNIQUE). Genuine production blocker → schema
-- evolution justified; reuses payment_operations (023) for the DB-first transfer.
--
-- Tables:
--   stripe_accounts          — one Connect Express account per prepper + capability/balance state
--   payouts                  — payout records reconciled from Stripe webhooks
--   processed_stripe_events  — webhook idempotency (referenced by webhook fn but never created)
--
-- Money flow (no payout before verified fulfilment — enforced in the RPCs):
--   capture → payments.in_escrow → verify_order_pin → escrow.auto_releasing
--     → stripe-transfer edge fn → _begin_release_operation (DB first)
--     → stripe.transfers.create → _complete_release_operation
--     → payout.* webhooks → payouts table

-- ── stripe_accounts ───────────────────────────────────────────────────────────

CREATE TABLE public.stripe_accounts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepper_id                  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id           TEXT UNIQUE,
  status                      TEXT NOT NULL DEFAULT 'not_connected'
    CHECK (status IN ('not_connected','pending','active','restricted','disabled')),
  charges_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted           BOOLEAN NOT NULL DEFAULT FALSE,
  disabled_reason             TEXT,
  requirements_due            JSONB NOT NULL DEFAULT '[]',
  requirements_eventually_due JSONB NOT NULL DEFAULT '[]',
  country                     TEXT,
  business_type               TEXT,            -- 'individual' | 'company'
  default_currency            TEXT NOT NULL DEFAULT 'gbp',
  available_pence             BIGINT NOT NULL DEFAULT 0,
  pending_pence               BIGINT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stripe_accounts_status_idx     ON public.stripe_accounts (status);
CREATE INDEX stripe_accounts_stripe_id_idx  ON public.stripe_accounts (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE TRIGGER stripe_accounts_updated_at
  BEFORE UPDATE ON public.stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_accounts_own_read ON public.stripe_accounts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND prepper_id = auth.uid());
CREATE POLICY stripe_accounts_admin_read ON public.stripe_accounts FOR SELECT TO authenticated
  USING (public.is_admin());
-- No direct client writes — all mutations via SECURITY DEFINER RPCs / webhooks.
CREATE POLICY stripe_accounts_no_client_write ON public.stripe_accounts FOR INSERT TO authenticated
  WITH CHECK (FALSE);
CREATE POLICY stripe_accounts_service_role ON public.stripe_accounts
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── payouts ───────────────────────────────────────────────────────────────────

CREATE TABLE public.payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepper_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payout_id TEXT UNIQUE,
  amount_pence     BIGINT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'gbp',
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_transit','paid','failed','canceled')),
  failure_code     TEXT,
  failure_message  TEXT,
  arrival_date     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payouts_prepper_idx ON public.payouts (prepper_id, created_at DESC);
CREATE INDEX payouts_status_idx  ON public.payouts (status) WHERE status IN ('pending','failed');

CREATE TRIGGER payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payouts_own_read ON public.payouts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND prepper_id = auth.uid());
CREATE POLICY payouts_admin_read ON public.payouts FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY payouts_no_client_write ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (FALSE);
CREATE POLICY payouts_service_role ON public.payouts
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── processed_stripe_events (webhook idempotency) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id    TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY processed_stripe_events_service_role ON public.processed_stripe_events
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Prepper-facing reads ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_stripe_account()
RETURNS public.stripe_accounts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.stripe_accounts WHERE prepper_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_stripe_account() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_stripe_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_payouts(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.payouts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.payouts
  WHERE prepper_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_payouts(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_payouts(INTEGER) TO authenticated;

-- ── service_role: sync account state from Stripe (edge fn + webhooks) ─────────

CREATE OR REPLACE FUNCTION public.upsert_stripe_account(p_prepper_id UUID, p_data JSONB)
RETURNS public.stripe_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.stripe_accounts; v_status TEXT;
BEGIN
  v_status := COALESCE(p_data->>'status', 'pending');
  INSERT INTO public.stripe_accounts AS sa (
    prepper_id, stripe_account_id, status, charges_enabled, payouts_enabled,
    details_submitted, disabled_reason, requirements_due, requirements_eventually_due,
    country, business_type, default_currency, available_pence, pending_pence)
  VALUES (
    p_prepper_id,
    p_data->>'stripe_account_id',
    v_status,
    COALESCE((p_data->>'charges_enabled')::BOOLEAN, FALSE),
    COALESCE((p_data->>'payouts_enabled')::BOOLEAN, FALSE),
    COALESCE((p_data->>'details_submitted')::BOOLEAN, FALSE),
    p_data->>'disabled_reason',
    COALESCE(p_data->'requirements_due', '[]'::JSONB),
    COALESCE(p_data->'requirements_eventually_due', '[]'::JSONB),
    p_data->>'country',
    p_data->>'business_type',
    COALESCE(p_data->>'default_currency', 'gbp'),
    COALESCE((p_data->>'available_pence')::BIGINT, 0),
    COALESCE((p_data->>'pending_pence')::BIGINT, 0))
  ON CONFLICT (prepper_id) DO UPDATE SET
    stripe_account_id           = COALESCE(EXCLUDED.stripe_account_id, sa.stripe_account_id),
    status                      = EXCLUDED.status,
    charges_enabled             = EXCLUDED.charges_enabled,
    payouts_enabled             = EXCLUDED.payouts_enabled,
    details_submitted           = EXCLUDED.details_submitted,
    disabled_reason             = EXCLUDED.disabled_reason,
    requirements_due            = EXCLUDED.requirements_due,
    requirements_eventually_due = EXCLUDED.requirements_eventually_due,
    country                     = COALESCE(EXCLUDED.country, sa.country),
    business_type               = COALESCE(EXCLUDED.business_type, sa.business_type),
    default_currency            = EXCLUDED.default_currency,
    available_pence             = EXCLUDED.available_pence,
    pending_pence               = EXCLUDED.pending_pence,
    updated_at                  = NOW()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_stripe_account(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_stripe_account(UUID, JSONB) TO service_role;

-- ── service_role: record/reconcile a payout from webhooks ─────────────────────

CREATE OR REPLACE FUNCTION public.record_payout(p_prepper_id UUID, p_data JSONB)
RETURNS public.payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.payouts;
BEGIN
  INSERT INTO public.payouts AS p (
    prepper_id, stripe_payout_id, amount_pence, currency, status,
    failure_code, failure_message, arrival_date)
  VALUES (
    p_prepper_id,
    p_data->>'stripe_payout_id',
    (p_data->>'amount_pence')::BIGINT,
    COALESCE(p_data->>'currency', 'gbp'),
    COALESCE(p_data->>'status', 'pending'),
    p_data->>'failure_code',
    p_data->>'failure_message',
    NULLIF(p_data->>'arrival_date','')::TIMESTAMPTZ)
  ON CONFLICT (stripe_payout_id) DO UPDATE SET
    status          = EXCLUDED.status,
    failure_code    = EXCLUDED.failure_code,
    failure_message = EXCLUDED.failure_message,
    arrival_date    = COALESCE(EXCLUDED.arrival_date, p.arrival_date),
    updated_at      = NOW()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_payout(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_payout(UUID, JSONB) TO service_role;

-- ── DB-first escrow RELEASE operation (mirrors _begin_refund_operation) ───────
-- No payout before verified fulfilment: requires the order verified and escrow
-- in a releasing/held-verified state, and the prepper's account payouts_enabled.

CREATE OR REPLACE FUNCTION public._begin_release_operation(p_order_id UUID)
RETURNS public.payment_operations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order    public.orders%ROWTYPE;
  v_payment  public.payments%ROWTYPE;
  v_op       public.payment_operations%ROWTYPE;
  v_acct     public.stripe_accounts%ROWTYPE;
  v_prepper  UUID;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Gate: only verified fulfilment may release funds.
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

  -- Idempotency: reuse any in-flight/completed release op.
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

CREATE OR REPLACE FUNCTION public._complete_release_operation(
  p_operation_id UUID, p_stripe_transfer_id TEXT, p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_operations SET
    status = 'completed', stripe_transfer_id = p_stripe_transfer_id, completed_at = NOW()
  WHERE id = p_operation_id AND status IN ('pending','processing');

  UPDATE public.payments SET status = 'released', released_at = NOW(), updated_at = NOW()
  WHERE order_id = p_order_id;

  UPDATE public.orders SET escrow_status = 'released', escrow_released_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._complete_release_operation(UUID, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._complete_release_operation(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public._fail_release_operation(p_operation_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_operations SET status = 'failed', failed_at = NOW(), failure_reason = p_reason
  WHERE id = p_operation_id AND status IN ('pending','processing');
END;
$$;
REVOKE EXECUTE ON FUNCTION public._fail_release_operation(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._fail_release_operation(UUID, TEXT) TO service_role;

-- ── Admin oversight (Tier 1+) ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_stripe_accounts(p_status TEXT DEFAULT NULL)
RETURNS SETOF public.stripe_accounts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin_tier(1);
  RETURN QUERY
    SELECT * FROM public.stripe_accounts
    WHERE p_status IS NULL OR status = p_status
    ORDER BY updated_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_stripe_accounts(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_stripe_accounts(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_failed_payouts()
RETURNS SETOF public.payouts
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin_tier(1);
  RETURN QUERY
    SELECT * FROM public.payouts WHERE status = 'failed' ORDER BY updated_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_failed_payouts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_failed_payouts() TO authenticated;
