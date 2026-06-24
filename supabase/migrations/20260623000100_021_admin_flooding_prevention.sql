-- ── 021 admin_flooding_prevention ────────────────────────────────────────────
-- S-13: Prevent administrative endpoint flooding attacks.
--
-- Attack vectors closed:
--   1. Projection rebuild loops (admin calls admin_rebuild_projection 100x)
--   2. Dead-letter drain storm (50+ replays/hour platform-wide)
--   3. Event replay amplification (rapid admin_replay_range calls)
--   4. Platform-wide kill switch for all admin actions under active attack

-- ── (a) Projection rebuild cooldown table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_operation_locks (
  operation_key TEXT PRIMARY KEY,    -- e.g. 'rebuild:project_order_created'
  locked_until  TIMESTAMPTZ NOT NULL,
  locked_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.admin_operation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_read_op_locks ON public.admin_operation_locks FOR SELECT TO authenticated
  USING (public.is_admin());
-- No direct-write policy: only SECURITY DEFINER functions may mutate this table.
CREATE POLICY service_role_op_locks ON public.admin_operation_locks TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ── (b) Replay range quota column ────────────────────────────────────────────

ALTER TABLE public.admin_action_quota
  ADD COLUMN IF NOT EXISTS replay_ranges_this_hour INTEGER NOT NULL DEFAULT 0;

-- ── (c) Dead-letter global drain cap table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_deadletter_drain (
  window_start TIMESTAMPTZ PRIMARY KEY,  -- date_trunc('hour', NOW())
  drain_count  INT NOT NULL DEFAULT 0
);

ALTER TABLE public.admin_deadletter_drain ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_drain ON public.admin_deadletter_drain FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY service_role_drain ON public.admin_deadletter_drain TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ── (d) Platform-wide kill switch columns on platform_health_metrics ──────────

ALTER TABLE public.platform_health_metrics
  ADD COLUMN IF NOT EXISTS admin_actions_paused    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_actions_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_actions_paused_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Internal: replay quota consumer ──────────────────────────────────────────
-- Tracks per-admin replay_range calls; cap = 3 per hour.

CREATE OR REPLACE FUNCTION public._consume_admin_replay_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('hour', NOW());
  v_cap    CONSTANT INTEGER := 3;
  v_rows   INTEGER;
BEGIN
  INSERT INTO public.admin_action_quota (admin_id, window_start)
  VALUES (auth.uid(), v_window) ON CONFLICT DO NOTHING;

  UPDATE public.admin_action_quota SET
    replay_ranges_this_hour = replay_ranges_this_hour + 1
  WHERE admin_id     = auth.uid()
    AND window_start = v_window
    AND replay_ranges_this_hour < v_cap;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    PERFORM public.emit_security_event(
      'admin_replay_quota_exceeded', auth.uid(), NULL, 'critical',
      jsonb_build_object('cap', v_cap, 'window', v_window)
    );
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._consume_admin_replay_quota() FROM PUBLIC;

-- ── Internal: global dead-letter drain quota check/increment ─────────────────
-- Returns FALSE and raises when platform-wide drain >= 50 replays this hour.

CREATE OR REPLACE FUNCTION public._check_deadletter_drain_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window    TIMESTAMPTZ := date_trunc('hour', NOW());
  v_cap       CONSTANT INTEGER := 50;
  v_new_count INTEGER;
BEGIN
  INSERT INTO public.admin_deadletter_drain (window_start, drain_count)
  VALUES (v_window, 1)
  ON CONFLICT (window_start) DO UPDATE SET
    drain_count = admin_deadletter_drain.drain_count + 1
  RETURNING drain_count INTO v_new_count;

  IF v_new_count > v_cap THEN
    -- Roll back the increment we just applied
    UPDATE public.admin_deadletter_drain SET
      drain_count = drain_count - 1
    WHERE window_start = v_window;

    PERFORM public.emit_security_event(
      'deadletter_drain_quota_exceeded', auth.uid(), NULL, 'critical',
      jsonb_build_object('cap', v_cap, 'window', v_window, 'count', v_new_count - 1)
    );
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._check_deadletter_drain_quota() FROM PUBLIC;

-- ── Platform pause / resume ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_pause_all_actions(p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.platform_health_metrics SET
    admin_actions_paused    = TRUE,
    admin_actions_paused_at = NOW(),
    admin_actions_paused_by = auth.uid()
  WHERE id = 1;

  PERFORM public.emit_security_event(
    'admin_actions_paused', auth.uid(), NULL, 'critical',
    jsonb_build_object('reason', p_reason, 'paused_by', auth.uid())
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_pause_all_actions(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resume_all_actions(p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.platform_health_metrics SET
    admin_actions_paused    = FALSE,
    admin_actions_paused_at = NULL,
    admin_actions_paused_by = NULL
  WHERE id = 1;

  PERFORM public.emit_security_event(
    'admin_actions_resumed', auth.uid(), NULL, 'warn',
    jsonb_build_object('reason', p_reason, 'resumed_by', auth.uid())
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resume_all_actions(TEXT) TO authenticated;

-- ── Rewrite _admin_record: add kill-switch check ──────────────────────────────
-- All admin RPCs that call _admin_record will fail safely when paused.

CREATE OR REPLACE FUNCTION public._admin_record(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id   UUID,
  p_reason      TEXT,
  p_metadata    JSONB DEFAULT '{}',
  p_reversible  BOOLEAN DEFAULT FALSE,
  p_event_type  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id  UUID;
  v_action_id UUID;
  v_paused    BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Kill-switch: all admin actions blocked when paused
  SELECT admin_actions_paused INTO v_paused
  FROM public.platform_health_metrics WHERE id = 1;

  IF v_paused THEN
    RAISE EXCEPTION 'admin_actions_paused: all admin actions are currently suspended';
  END IF;

  IF p_event_type IS NOT NULL THEN
    INSERT INTO public.domain_events
      (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
    VALUES (
      p_event_type, p_target_type, COALESCE(p_target_id, gen_random_uuid()),
      auth.uid(),
      jsonb_build_object(
        'reason',      p_reason,
        'admin_id',    auth.uid(),
        'target_id',   p_target_id,
        'target_type', p_target_type
      ) || p_metadata,
      1
    )
    RETURNING id INTO v_event_id;
  END IF;

  INSERT INTO public.audit_logs
    (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(), p_action_type, p_target_type, p_target_id,
    p_metadata || jsonb_build_object('reason', p_reason, 'admin', TRUE)
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, metadata, domain_event_id, reversible)
  VALUES
    (auth.uid(), p_action_type, p_target_type, p_target_id, p_reason, p_metadata, v_event_id, p_reversible)
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._admin_record(TEXT, TEXT, UUID, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC;

-- ── Rewrite admin_rebuild_projection: cooldown lock ───────────────────────────

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
  v_lock_key     TEXT := 'rebuild:' || p_projection_name;
  v_locked_until TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Cooldown check: block rapid consecutive rebuilds of the same projection
  SELECT locked_until INTO v_locked_until
  FROM public.admin_operation_locks
  WHERE operation_key = v_lock_key AND locked_until > NOW();

  IF FOUND THEN
    RAISE EXCEPTION 'projection_rebuild_cooldown: retry after %', v_locked_until;
  END IF;

  SELECT MIN(occurred_at) INTO v_oldest_event FROM public.domain_events;
  IF v_oldest_event IS NULL THEN RAISE EXCEPTION 'no_events_to_replay'; END IF;

  PERFORM public.emit_security_event(
    'projection_rebuild_initiated', auth.uid(), NULL, 'warn',
    jsonb_build_object('projection', p_projection_name, 'dry_run', p_dry_run)
  );

  IF NOT p_dry_run THEN
    -- Acquire cooldown lock (10-minute window)
    INSERT INTO public.admin_operation_locks (operation_key, locked_until, locked_by)
    VALUES (v_lock_key, NOW() + INTERVAL '10 minutes', auth.uid())
    ON CONFLICT (operation_key) DO UPDATE SET
      locked_until = EXCLUDED.locked_until,
      locked_by    = EXCLUDED.locked_by;

    -- ATOMICALLY: clear gate + zero read-model counters
    DELETE FROM public.projection_event_log
    WHERE projection_name = p_projection_name;

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
        NULL;
    END CASE;
  END IF;

  -- Replay all events from the start (quota consumed here)
  SELECT public.admin_replay_range(
    v_oldest_event - INTERVAL '1 second',
    NOW(),
    p_projection_name,
    p_dry_run,
    p_reason
  ) INTO v_session;

  UPDATE public.replay_sessions SET replay_type = 'projection_rebuild' WHERE id = v_session;

  -- Release cooldown lock after successful rebuild
  IF NOT p_dry_run THEN
    DELETE FROM public.admin_operation_locks WHERE operation_key = v_lock_key;
  END IF;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_projection(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── Rewrite admin_replay_range: per-admin hourly cap ─────────────────────────

CREATE OR REPLACE FUNCTION public.admin_replay_range(
  p_from_time     TIMESTAMPTZ,
  p_to_time       TIMESTAMPTZ,
  p_projection    TEXT DEFAULT NULL,
  p_dry_run       BOOLEAN DEFAULT FALSE,
  p_reason        TEXT DEFAULT 'range replay'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session   UUID;
  v_event     public.domain_events%ROWTYPE;
  v_result    TEXT;
  v_replayed  INTEGER := 0;
  v_skipped   INTEGER := 0;
  v_errors    INTEGER := 0;
  v_scanned   INTEGER := 0;
  v_err_list  JSONB := '[]';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_to_time <= p_from_time THEN RAISE EXCEPTION 'invalid_time_range'; END IF;
  IF p_to_time - p_from_time > INTERVAL '7 days' THEN
    RAISE EXCEPTION 'range_too_large: max 7 days per replay session';
  END IF;

  -- Per-admin hourly cap: max 3 replay_range calls per hour
  IF NOT public._consume_admin_replay_quota() THEN
    RAISE EXCEPTION 'replay_range_quota_exceeded: max 3 replay range calls per hour';
  END IF;

  INSERT INTO public.replay_sessions
    (initiated_by, replay_type, from_occurred_at, to_occurred_at, projection_name,
     dry_run, status, reason, started_at)
  VALUES (auth.uid(), 'event_range', p_from_time, p_to_time, p_projection,
    p_dry_run, 'running', p_reason, NOW())
  RETURNING id INTO v_session;

  FOR v_event IN
    SELECT * FROM public.domain_events
    WHERE occurred_at BETWEEN p_from_time AND p_to_time
    ORDER BY occurred_at ASC
  LOOP
    v_scanned := v_scanned + 1;
    v_result := public._replay_one_event(v_event, p_projection, p_dry_run);

    INSERT INTO public.replay_event_log
      (session_id, event_id, event_type, projection_name, result, error_detail)
    VALUES (
      v_session, v_event.id, v_event.event_type, p_projection,
      CASE WHEN v_result LIKE 'error:%' THEN 'error' ELSE v_result END,
      CASE WHEN v_result LIKE 'error:%' THEN SUBSTRING(v_result FROM 7) ELSE NULL END
    );

    IF    v_result = 'replayed'   THEN v_replayed := v_replayed + 1;
    ELSIF v_result = 'skipped'    THEN v_skipped  := v_skipped  + 1;
    ELSIF v_result LIKE 'error:%' THEN
      v_errors   := v_errors + 1;
      v_err_list := v_err_list || jsonb_build_array(
        jsonb_build_object('event_id', v_event.id, 'error', SUBSTRING(v_result FROM 7))
      );
    END IF;
  END LOOP;

  UPDATE public.replay_sessions SET
    status          = CASE WHEN p_dry_run THEN 'dry_run_complete' ELSE 'completed' END,
    events_scanned  = v_scanned,
    events_replayed = v_replayed,
    events_skipped  = v_skipped,
    errors          = v_errors,
    error_details   = v_err_list,
    completed_at    = NOW()
  WHERE id = v_session;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_replay_range(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── Rewrite admin_replay_dead_letter: add global drain cap ───────────────────

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

  -- Global drain cap: platform-wide 50 dead-letter replays per hour
  IF NOT public._check_deadletter_drain_quota() THEN
    RAISE EXCEPTION 'deadletter_drain_quota_exceeded: max 50 dead-letter replays per hour platform-wide';
  END IF;

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

  UPDATE public.event_processing_log SET
    status          = 'pending_retry',
    next_attempt_at = NOW(),
    attempt_count   = 0,
    error           = NULL,
    failure_reason  = NULL
  WHERE event_id = v_event_id AND status = 'dead_letter';

  IF NOT FOUND THEN
    INSERT INTO public.event_processing_log
      (event_id, event_type, status, next_attempt_at, attempt_count)
    SELECT id, event_type, 'pending_retry', NOW(), 0
    FROM public.domain_events WHERE id = v_event_id
    ON CONFLICT (event_id) DO UPDATE SET
      status = 'pending_retry', next_attempt_at = NOW(), attempt_count = 0,
      error = NULL, failure_reason = NULL;
  END IF;

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

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admin_op_locks_expiry_idx
  ON public.admin_operation_locks (locked_until);

CREATE INDEX IF NOT EXISTS admin_deadletter_drain_window_idx
  ON public.admin_deadletter_drain (window_start DESC);
