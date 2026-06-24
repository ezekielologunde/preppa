-- ── 024 projection_rebuild_isolation ─────────────────────────────────────────
-- F-03: Serialise projection rebuilds against live writes using advisory locks.
--
-- Problem: admin_rebuild_projection clears projection_event_log then replays.
-- Live writes between clear and replay pass the idempotency gate legitimately,
-- then get zeroed when the read-model is reset — producing permanent under-counts.
--
-- Fix:
--   Live projection functions acquire a SHARED xact-level advisory lock.
--   Rebuild acquires an EXCLUSIVE session-level advisory lock before touching
--   the gate or read-models. Exclusive blocks all shared holders; shared holders
--   are compatible with each other.
--
-- After rebuild: a checksum is stored. pg_cron detects drift every 5 minutes.

-- ── (a) Lock ID derivation ────────────────────────────────────────────────────
-- Maps a projection name to a deterministic BIGINT advisory lock key.
-- IMMUTABLE so Postgres can inline the call.

CREATE OR REPLACE FUNCTION public._projection_lock_id(p_projection_name TEXT)
RETURNS BIGINT
LANGUAGE sql IMMUTABLE AS $$
  SELECT ABS(HASHTEXT(p_projection_name))::BIGINT
$$;
REVOKE EXECUTE ON FUNCTION public._projection_lock_id(TEXT) FROM PUBLIC;

-- ── (b) Live projection function rewrites ─────────────────────────────────────
-- Each acquires a SHARED xact-level advisory lock before touching the gate
-- or any read-model. Multiple concurrent live writes are compatible (shared).
-- A rebuild's exclusive lock blocks all shared waiters until replay is done.

CREATE OR REPLACE FUNCTION public.project_order_created(
  p_event_id    UUID,
  p_order_id    UUID,
  p_customer_id UUID,
  p_kitchen_id  UUID,
  p_prepper_id  UUID,
  p_total_pence BIGINT,
  p_occurred_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Blocks if a rebuild holds the exclusive lock for this projection.
  PERFORM pg_advisory_xact_lock_shared(
    public._projection_lock_id('project_order_created')
  );

  IF public._projection_already_applied(p_event_id, 'project_order_created') THEN
    RETURN;
  END IF;

  INSERT INTO public.prepper_metrics
    (prepper_id, total_orders, total_revenue_pence, last_order_at, last_updated)
  VALUES (p_prepper_id, 1, p_total_pence, p_occurred_at, NOW())
  ON CONFLICT (prepper_id) DO UPDATE SET
    total_orders        = prepper_metrics.total_orders + 1,
    total_revenue_pence = prepper_metrics.total_revenue_pence + EXCLUDED.total_revenue_pence,
    last_order_at       = GREATEST(prepper_metrics.last_order_at, p_occurred_at),
    last_updated        = NOW();

  INSERT INTO public.customer_metrics
    (customer_id, total_orders, lifetime_value_pence,
     average_order_pence, first_order_at, last_order_at, last_updated)
  VALUES (p_customer_id, 1, p_total_pence, p_total_pence, p_occurred_at, p_occurred_at, NOW())
  ON CONFLICT (customer_id) DO UPDATE SET
    total_orders         = customer_metrics.total_orders + 1,
    lifetime_value_pence = customer_metrics.lifetime_value_pence + p_total_pence,
    average_order_pence  = (customer_metrics.lifetime_value_pence + p_total_pence)
                           / (customer_metrics.total_orders + 1),
    first_order_at       = LEAST(customer_metrics.first_order_at, p_occurred_at),
    last_order_at        = GREATEST(customer_metrics.last_order_at, p_occurred_at),
    last_updated         = NOW();

  INSERT INTO public.kitchen_metrics
    (kitchen_id, total_orders, total_revenue_pence, last_order_at, last_updated)
  VALUES (p_kitchen_id, 1, p_total_pence, p_occurred_at, NOW())
  ON CONFLICT (kitchen_id) DO UPDATE SET
    total_orders        = kitchen_metrics.total_orders + 1,
    total_revenue_pence = kitchen_metrics.total_revenue_pence + p_total_pence,
    last_order_at       = GREATEST(kitchen_metrics.last_order_at, p_occurred_at),
    last_updated        = NOW();

  UPDATE public.platform_metrics SET
    total_orders        = total_orders + 1,
    total_revenue_pence = total_revenue_pence + p_total_pence,
    last_updated        = NOW()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_order_cancelled(
  p_event_id    UUID,
  p_order_id    UUID,
  p_customer_id UUID,
  p_kitchen_id  UUID,
  p_prepper_id  UUID,
  p_total_pence BIGINT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    public._projection_lock_id('project_order_cancelled')
  );

  IF public._projection_already_applied(p_event_id, 'project_order_cancelled') THEN
    RETURN;
  END IF;

  UPDATE public.prepper_metrics SET
    cancelled_orders = cancelled_orders + 1,
    last_updated     = NOW()
  WHERE prepper_id = p_prepper_id;

  UPDATE public.customer_metrics SET
    cancelled_orders = cancelled_orders + 1,
    last_updated     = NOW()
  WHERE customer_id = p_customer_id;

  UPDATE public.kitchen_metrics SET
    cancelled_orders = cancelled_orders + 1,
    last_updated     = NOW()
  WHERE kitchen_id = p_kitchen_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_kitchen_orders(
  p_kitchen_id UUID,
  p_date       DATE,
  p_event_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted  INTEGER;
  v_daily_cap INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    public._projection_lock_id('increment_kitchen_orders')
  );

  INSERT INTO public.projection_event_log (event_id, projection_name)
  VALUES (p_event_id, 'increment_kitchen_orders')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN; END IF;

  SELECT daily_capacity INTO v_daily_cap
  FROM public.kitchens WHERE id = p_kitchen_id;

  INSERT INTO public.kitchen_capacity
    (kitchen_id, date, daily_limit, orders_accepted)
  VALUES (p_kitchen_id, p_date, COALESCE(v_daily_cap, 20), 1)
  ON CONFLICT (kitchen_id, date) DO UPDATE SET
    orders_accepted = kitchen_capacity.orders_accepted + 1;
END;
$$;

-- ── (c) Projection checksums ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projection_checksums (
  projection_name TEXT        PRIMARY KEY,
  checksum        TEXT        NOT NULL,  -- MD5 of sorted applied event UUIDs
  event_count     INTEGER     NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by     TEXT        NOT NULL DEFAULT 'system'  -- 'system' or auth.uid()::text
);

ALTER TABLE public.projection_checksums ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_read_checksums ON public.projection_checksums
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY service_role_checksums ON public.projection_checksums
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Deterministic fingerprint of all event UUIDs applied to a projection.
-- Sorted by event_id so insertion order does not affect the result.
CREATE OR REPLACE FUNCTION public.compute_projection_checksum(p_projection_name TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT MD5(STRING_AGG(event_id::TEXT, ',' ORDER BY event_id))
  FROM public.projection_event_log
  WHERE projection_name = p_projection_name
$$;
REVOKE EXECUTE ON FUNCTION public.compute_projection_checksum(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.record_projection_checksum(p_projection_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_checksum TEXT;
  v_count    INTEGER;
BEGIN
  v_checksum := public.compute_projection_checksum(p_projection_name);

  SELECT COUNT(*) INTO v_count
  FROM public.projection_event_log
  WHERE projection_name = p_projection_name;

  INSERT INTO public.projection_checksums
    (projection_name, checksum, event_count, computed_at, computed_by)
  VALUES (p_projection_name, v_checksum, v_count, NOW(), 'system')
  ON CONFLICT (projection_name) DO UPDATE SET
    checksum    = EXCLUDED.checksum,
    event_count = EXCLUDED.event_count,
    computed_at = EXCLUDED.computed_at,
    computed_by = EXCLUDED.computed_by;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_projection_checksum(TEXT) FROM PUBLIC;

-- ── (d) Rewrite admin_rebuild_projection with exclusive advisory lock ──────────
-- Session-level (not xact-level) because the rebuild spans multiple internal
-- transactions during admin_replay_range. Released explicitly in all paths.

CREATE OR REPLACE FUNCTION public.admin_rebuild_projection(
  p_projection_name TEXT,
  p_dry_run         BOOLEAN DEFAULT FALSE,
  p_reason          TEXT    DEFAULT 'projection rebuild'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session      UUID;
  v_oldest_event TIMESTAMPTZ;
  v_lock_key     TEXT    := 'rebuild:' || p_projection_name;
  v_locked_until TIMESTAMPTZ;
  v_lock_id      BIGINT  := public._projection_lock_id(p_projection_name);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- 10-minute cooldown: prevents rapid consecutive rebuilds (migration 021)
  SELECT locked_until INTO v_locked_until
  FROM public.admin_operation_locks
  WHERE operation_key = v_lock_key AND locked_until > NOW();

  IF FOUND THEN
    RAISE EXCEPTION 'projection_rebuild_cooldown: retry after %', v_locked_until;
  END IF;

  -- Non-blocking exclusive try: fail fast if another rebuild is already running
  -- or if live writes are currently holding shared locks (contention signal).
  IF NOT pg_try_advisory_lock(v_lock_id) THEN
    RAISE EXCEPTION 'projection_rebuild_locked: another rebuild or active projection write is in progress';
  END IF;

  -- All further work is inside a protected block so the lock is always released.
  BEGIN
    SELECT MIN(occurred_at) INTO v_oldest_event FROM public.domain_events;
    IF v_oldest_event IS NULL THEN
      RAISE EXCEPTION 'no_events_to_replay';
    END IF;

    PERFORM public.emit_security_event(
      'projection_rebuild_initiated', auth.uid(), NULL, 'warn',
      jsonb_build_object('projection', p_projection_name, 'dry_run', p_dry_run)
    );

    IF NOT p_dry_run THEN
      -- Cooldown lock: prevent a second rebuild from starting after we release
      -- the advisory lock at the end of this run.
      INSERT INTO public.admin_operation_locks (operation_key, locked_until, locked_by)
      VALUES (v_lock_key, NOW() + INTERVAL '10 minutes', auth.uid())
      ON CONFLICT (operation_key) DO UPDATE SET
        locked_until = EXCLUDED.locked_until,
        locked_by    = EXCLUDED.locked_by;

      -- Gate clear + read-model zero happen while exclusive lock is held.
      -- No live write can enter project_order_created / project_order_cancelled
      -- / increment_kitchen_orders until we release below.
      DELETE FROM public.projection_event_log
      WHERE projection_name = p_projection_name;

      CASE p_projection_name
        WHEN 'project_order_created' THEN
          UPDATE public.prepper_metrics SET
            total_orders = 0, total_revenue_pence = 0, cancelled_orders = 0,
            today_orders = 0, today_revenue_pence = 0,
            week_orders  = 0, week_revenue_pence  = 0,
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
          UPDATE public.prepper_metrics  SET cancelled_orders = 0, last_updated = NOW();
          UPDATE public.customer_metrics SET cancelled_orders = 0, last_updated = NOW();
          UPDATE public.kitchen_metrics  SET cancelled_orders = 0, last_updated = NOW();
        WHEN 'increment_kitchen_orders' THEN
          UPDATE public.kitchen_capacity SET orders_accepted = 0;
        ELSE NULL;
      END CASE;
    END IF;

    -- Replay consumes admin hourly quota (from migration 021).
    SELECT public.admin_replay_range(
      v_oldest_event - INTERVAL '1 second',
      NOW(),
      p_projection_name,
      p_dry_run,
      p_reason
    ) INTO v_session;

    UPDATE public.replay_sessions
    SET replay_type = 'projection_rebuild'
    WHERE id = v_session;

    IF NOT p_dry_run THEN
      -- Snapshot the applied-event set for drift detection.
      PERFORM public.record_projection_checksum(p_projection_name);

      -- Remove the cooldown lock; replay is done.
      DELETE FROM public.admin_operation_locks WHERE operation_key = v_lock_key;
    END IF;

    PERFORM pg_advisory_unlock(v_lock_id);
  EXCEPTION WHEN OTHERS THEN
    -- Always release even on failure; never leave an exclusive lock dangling.
    PERFORM pg_advisory_unlock(v_lock_id);
    RAISE;
  END;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_projection(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── (e) Drift detection ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_projection_drift()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result          JSONB := '[]'::JSONB;
  v_proj            TEXT;
  v_current_checksum TEXT;
  v_stored          public.projection_checksums%ROWTYPE;
BEGIN
  FOR v_proj IN
    SELECT DISTINCT projection_name FROM public.projection_event_log
  LOOP
    v_current_checksum := public.compute_projection_checksum(v_proj);

    SELECT * INTO v_stored
    FROM public.projection_checksums
    WHERE projection_name = v_proj;

    IF FOUND AND v_stored.checksum <> v_current_checksum THEN
      PERFORM public.emit_security_event(
        'projection_drift_detected', NULL, NULL, 'critical',
        jsonb_build_object(
          'projection_name',   v_proj,
          'stored_checksum',   v_stored.checksum,
          'current_checksum',  v_current_checksum,
          'stored_event_count', v_stored.event_count,
          'stored_at',         v_stored.computed_at
        )
      );
      v_result := v_result || jsonb_build_array(
        jsonb_build_object('projection', v_proj, 'drift', true)
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_projection_drift() TO authenticated;

-- ── (f) pg_cron: drift check every 5 minutes ─────────────────────────────────

INSERT INTO cron.job (schedule, command, nodename, nodeport, database, username)
SELECT
  '*/5 * * * *',
  'SELECT public.check_projection_drift()',
  'localhost',
  5432,
  current_database(),
  current_user
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE command LIKE '%check_projection_drift%'
);

-- ── (g) Index to speed checksum reads ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS proj_checksums_computed_at_idx
  ON public.projection_checksums (computed_at DESC);
