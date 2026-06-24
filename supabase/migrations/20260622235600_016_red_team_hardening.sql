-- ── 016 red_team_hardening ────────────────────────────────────────────────────
-- Fixes for Sprint 11 red-team ship-blockers:
-- S-3: append-only audit trail (audit_logs + security_events)
-- S-4: admin_rebuild_projection zeroes read-models atomically with gate clear
-- S-5: admin_replay_dead_letter replay quota
-- S-6/S-7: per-hour cap for monetary admin actions (refund + escrow release)
-- + info-disclosure: tighten public_read on revenue projection tables

-- ── S-3: Append-only enforcement on audit tables ──────────────────────────────

CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append_only_table: % on % is blocked', TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

CREATE TRIGGER security_events_no_mutation
  BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

CREATE TRIGGER admin_action_log_no_mutation
  BEFORE DELETE ON public.admin_action_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();
-- (admin_action_log allows UPDATE only for reversal tracking — see reversed_at column)
-- UPDATE is allowed; DELETE is blocked.

-- ── S-6/S-7: Per-window quota for monetary admin actions ──────────────────────

CREATE TABLE public.admin_action_quota (
  admin_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start      TIMESTAMPTZ NOT NULL, -- date_trunc('hour', NOW())
  refunds_this_hour INTEGER NOT NULL DEFAULT 0,
  releases_this_hour INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (admin_id, window_start)
);

ALTER TABLE public.admin_action_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_quota ON public.admin_action_quota FOR SELECT TO authenticated
  USING (public.is_admin() AND admin_id = auth.uid());
CREATE POLICY service_role_quota ON public.admin_action_quota TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Soft cap constants
CREATE OR REPLACE FUNCTION public._admin_refund_cap()  RETURNS INTEGER LANGUAGE sql AS $$ SELECT 20 $$;
CREATE OR REPLACE FUNCTION public._admin_release_cap() RETURNS INTEGER LANGUAGE sql AS $$ SELECT 30 $$;

-- Internal: consume one quota slot. Returns FALSE if over cap.
CREATE OR REPLACE FUNCTION public._consume_admin_quota(
  p_action TEXT   -- 'refund' | 'release'
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('hour', NOW());
  v_rows   INTEGER;
  v_cap    INTEGER := CASE p_action
    WHEN 'refund'  THEN public._admin_refund_cap()
    WHEN 'release' THEN public._admin_release_cap()
    ELSE 5
  END;
  v_col TEXT := CASE p_action WHEN 'refund' THEN 'refunds_this_hour' ELSE 'releases_this_hour' END;
BEGIN
  -- Upsert the window row first (no count check here — separate UPDATE ensures atomicity)
  INSERT INTO public.admin_action_quota (admin_id, window_start)
  VALUES (auth.uid(), v_window) ON CONFLICT DO NOTHING;

  -- Atomic increment only if under cap
  IF p_action = 'refund' THEN
    UPDATE public.admin_action_quota SET
      refunds_this_hour = refunds_this_hour + 1
    WHERE admin_id = auth.uid()
      AND window_start = v_window
      AND refunds_this_hour < v_cap;
  ELSE
    UPDATE public.admin_action_quota SET
      releases_this_hour = releases_this_hour + 1
    WHERE admin_id = auth.uid()
      AND window_start = v_window
      AND releases_this_hour < v_cap;
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    PERFORM public.emit_security_event(
      'admin_quota_exceeded', auth.uid(), NULL, 'critical',
      jsonb_build_object('action', p_action, 'cap', v_cap, 'window', v_window)
    );
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._consume_admin_quota(TEXT) FROM PUBLIC;

-- Rewrite admin_refund_order with quota guard
CREATE OR REPLACE FUNCTION public.admin_refund_order(
  p_order_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_payment   public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Quota check (before any DB read to fail fast)
  IF NOT public._consume_admin_quota('refund') THEN
    RAISE EXCEPTION 'refund_quota_exceeded: max % refunds per hour', public._admin_refund_cap();
  END IF;

  -- Lock the payment row to prevent concurrent double-refund
  SELECT * INTO v_payment FROM public.payments
  WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  -- State guard
  IF v_payment.status NOT IN ('captured', 'in_escrow') THEN
    RAISE EXCEPTION 'payment_not_refundable: status=%', v_payment.status;
  END IF;

  -- Idempotency: already refunded
  IF v_payment.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_refunded';
  END IF;

  -- Amount is always re-derived from DB row — never trusted from caller
  UPDATE public.payments SET
    status      = 'refunded',
    refunded_at = NOW(),
    updated_at  = NOW()
  WHERE id = v_payment.id;

  UPDATE public.orders SET status = 'refunded', updated_at = NOW()
  WHERE id = p_order_id;

  SELECT public._admin_record(
    'refund_order', 'order', p_order_id, p_reason,
    jsonb_build_object(
      'payment_id',    v_payment.id,
      'amount_pence',  v_payment.amount_pence  -- authoritative from DB
    ),
    FALSE, 'payment.admin_refunded'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_refund_order(UUID, TEXT) TO authenticated;

-- Rewrite admin_release_escrow with quota guard
CREATE OR REPLACE FUNCTION public.admin_release_escrow(
  p_order_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_payment   public.payments%ROWTYPE;
  v_order     public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  IF NOT public._consume_admin_quota('release') THEN
    RAISE EXCEPTION 'release_quota_exceeded: max % releases per hour', public._admin_release_cap();
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  -- Policy: only release escrow for delivered orders (prevent premature payout)
  IF v_order.status NOT IN ('delivered', 'refunded') THEN
    RAISE EXCEPTION 'order_not_delivered: status=% — cannot release escrow before delivery',
      v_order.status;
  END IF;

  SELECT * INTO v_payment FROM public.payments
  WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  IF v_payment.status <> 'in_escrow' THEN
    RAISE EXCEPTION 'payment_not_in_escrow: status=%', v_payment.status;
  END IF;

  -- Guard double-release
  IF v_payment.released_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_released';
  END IF;

  UPDATE public.payments SET
    status      = 'released',
    released_at = NOW(),
    updated_at  = NOW()
  WHERE id = v_payment.id;

  SELECT public._admin_record(
    'release_escrow', 'payment', v_payment.id, p_reason,
    jsonb_build_object(
      'order_id',             p_order_id,
      'prepper_payout_pence', v_payment.prepper_payout_pence,
      'order_status',         v_order.status
    ),
    FALSE, 'payment.escrow_released'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_release_escrow(UUID, TEXT) TO authenticated;

-- ── S-4: admin_rebuild_projection — zero read-model atomically ─────────────

-- Rewrite to zero affected read-models in same transaction as gate clear
CREATE OR REPLACE FUNCTION public.admin_rebuild_projection(
  p_projection_name TEXT,
  p_dry_run         BOOLEAN DEFAULT FALSE,
  p_reason          TEXT DEFAULT 'projection rebuild'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session      UUID;
  v_oldest_event TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT MIN(occurred_at) INTO v_oldest_event FROM public.domain_events;
  IF v_oldest_event IS NULL THEN RAISE EXCEPTION 'no_events_to_replay'; END IF;

  PERFORM public.emit_security_event(
    'projection_rebuild_initiated', auth.uid(), NULL, 'warn',
    jsonb_build_object('projection', p_projection_name, 'dry_run', p_dry_run)
  );

  IF NOT p_dry_run THEN
    -- ATOMICALLY: clear gate + zero read-model counters in one transaction
    -- This prevents the double-count window where gate is cleared but replay is mid-flight.
    DELETE FROM public.projection_event_log
    WHERE projection_name = p_projection_name;

    -- Zero out the specific projection's counters so replay increments from zero
    CASE p_projection_name
      WHEN 'project_order_created' THEN
        UPDATE public.prepper_metrics SET
          total_orders = 0, total_revenue_pence = 0, cancelled_orders = 0,
          today_orders = 0, today_revenue_pence = 0,
          week_orders = 0, week_revenue_pence = 0,
          month_orders = 0, month_revenue_pence = 0, last_updated = NOW();
        UPDATE public.customer_metrics SET
          total_orders = 0, lifetime_value_pence = 0, average_order_pence = 0,
          cancelled_orders = 0, last_updated = NOW();
        UPDATE public.kitchen_metrics SET
          total_orders = 0, completed_orders = 0, cancelled_orders = 0,
          total_revenue_pence = 0, last_updated = NOW();
        UPDATE public.platform_metrics SET
          total_orders = 0, total_revenue_pence = 0, orders_today = 0,
          revenue_today_pence = 0, last_updated = NOW();
      WHEN 'project_order_cancelled' THEN
        UPDATE public.prepper_metrics SET cancelled_orders = 0, last_updated = NOW();
        UPDATE public.customer_metrics SET cancelled_orders = 0, last_updated = NOW();
        UPDATE public.kitchen_metrics SET cancelled_orders = 0, last_updated = NOW();
      WHEN 'increment_kitchen_orders' THEN
        UPDATE public.kitchen_capacity SET orders_accepted = 0;
      ELSE
        -- Unknown projection: only clear the gate; don't zero anything
        NULL;
    END CASE;
  END IF;

  -- Replay all events from the start
  SELECT public.admin_replay_range(
    v_oldest_event - INTERVAL '1 second',
    NOW(),
    p_projection_name,
    p_dry_run,
    p_reason
  ) INTO v_session;

  UPDATE public.replay_sessions SET replay_type = 'projection_rebuild' WHERE id = v_session;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_projection(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── S-5: admin_replay_dead_letter — quota (max 3 manual replays per dead letter) ──

-- Add replay_count to event_dead_letters to prevent drain abuse
ALTER TABLE public.event_dead_letters
  ADD COLUMN IF NOT EXISTS manual_replay_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.admin_replay_dead_letter(
  p_dead_letter_id UUID,
  p_reason         TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_event_id  UUID;
  v_replays   INTEGER;
  MAX_REPLAYS CONSTANT INTEGER := 3;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT event_id, manual_replay_count
  INTO v_event_id, v_replays
  FROM public.event_dead_letters
  WHERE id = p_dead_letter_id AND resolved_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'dead_letter_not_found_or_already_resolved'; END IF;

  IF v_replays >= MAX_REPLAYS THEN
    PERFORM public.emit_security_event(
      'dead_letter_replay_quota_exceeded', auth.uid(), NULL, 'critical',
      jsonb_build_object('dead_letter_id', p_dead_letter_id, 'replay_count', v_replays)
    );
    RAISE EXCEPTION 'replay_quota_exceeded: max % manual replays per dead letter', MAX_REPLAYS;
  END IF;

  -- Route through event_processing_log to ensure idempotency gate is respected.
  -- UPDATE is a no-op if already pending_retry (single attempt in flight).
  UPDATE public.event_processing_log SET
    status          = 'pending_retry',
    next_attempt_at = NOW(),
    attempt_count   = 0,
    error           = NULL,
    failure_reason  = NULL
  WHERE event_id = v_event_id AND status = 'dead_letter';

  -- If no EPL row exists, re-insert it
  IF NOT FOUND THEN
    INSERT INTO public.event_processing_log
      (event_id, event_type, status, next_attempt_at, attempt_count)
    SELECT id, event_type, 'pending_retry', NOW(), 0
    FROM public.domain_events WHERE id = v_event_id
    ON CONFLICT (event_id) DO UPDATE SET
      status = 'pending_retry', next_attempt_at = NOW(), attempt_count = 0,
      error = NULL, failure_reason = NULL;
  END IF;

  -- Increment replay count + mark resolved for queue management
  UPDATE public.event_dead_letters SET
    manual_replay_count = manual_replay_count + 1,
    resolved_at         = NOW(),
    resolved_by         = auth.uid(),
    resolution_note     = 'admin_replay: ' || p_reason
  WHERE id = p_dead_letter_id;

  SELECT public._admin_record(
    'replay_dead_letter', 'event_dead_letter', p_dead_letter_id, p_reason,
    jsonb_build_object('event_id', v_event_id, 'replay_number', v_replays + 1),
    FALSE, 'event.dead_letter_replayed'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_replay_dead_letter(UUID, TEXT) TO authenticated;

-- ── Info-disclosure: tighten public_read on revenue tables ───────────────────
-- kitchen_metrics.total_revenue_pence, platform_metrics.total_revenue_pence,
-- platform_health_metrics, and analytics_daily should not be public_read.
-- These contain financial data. Read access is tightened:
-- - kitchen_metrics: preppers read their own via kitchen FK
-- - platform_metrics/health: admin-only
-- - listing_stats: public (view/save counts fine; revenue IS a concern)

-- Drop the over-permissive public_read on platform_metrics (singleton)
DROP POLICY IF EXISTS public_read_platform_metrics ON public.platform_metrics;
CREATE POLICY admin_read_platform_metrics ON public.platform_metrics FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY service_role_read_platform_metrics ON public.platform_metrics TO service_role USING (TRUE);

-- Drop the public_read on platform_health_metrics
DROP POLICY IF EXISTS public_read_health ON public.platform_health_metrics;
CREATE POLICY admin_read_health ON public.platform_health_metrics FOR SELECT TO authenticated
  USING (public.is_admin());

-- kitchen_metrics: only the prepper who owns the kitchen should read their own metrics
DROP POLICY IF EXISTS public_read_kitchen_metrics ON public.kitchen_metrics;
CREATE POLICY preppers_own_kitchen_metrics ON public.kitchen_metrics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kitchens k
    WHERE k.id = kitchen_metrics.kitchen_id AND k.prepper_id = auth.uid()
  ));
-- admins still need it for the dashboard
CREATE POLICY admin_read_kitchen_metrics ON public.kitchen_metrics FOR SELECT TO authenticated
  USING (public.is_admin());

-- listing_stats: keep revenue private (orders_count/views are fine; pence is not)
-- Split: create a public view that exposes only non-financial fields
CREATE OR REPLACE VIEW public.listing_stats_public AS
  SELECT listing_id, views, saves, clicks, favorites, shares, average_rating
  FROM public.listing_stats;
-- (Revenue counters exposed only to the listing's prepper or admin)

-- ── Indexes for quota table ───────────────────────────────────────────────────
CREATE INDEX admin_quota_admin_idx  ON public.admin_action_quota (admin_id, window_start DESC);
