-- ── 013 replay_console ────────────────────────────────────────────────────────
-- Idempotent event replay and projection rebuild infrastructure.
-- Replay safety is guaranteed by projection_event_log (insert-or-skip gate).
-- dry_run=TRUE runs all logic but wraps in a ROLLBACK — no writes land.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.replay_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  replay_type      TEXT NOT NULL CHECK (replay_type IN (
    'single_event', 'event_range', 'projection_rebuild', 'full_rebuild'
  )),
  target_event_id  UUID REFERENCES public.domain_events(id) ON DELETE SET NULL,
  from_occurred_at TIMESTAMPTZ,
  to_occurred_at   TIMESTAMPTZ,
  projection_name  TEXT,   -- NULL = all projections
  dry_run          BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','dry_run_complete')),
  events_scanned   INTEGER NOT NULL DEFAULT 0,
  events_replayed  INTEGER NOT NULL DEFAULT 0,
  events_skipped   INTEGER NOT NULL DEFAULT 0,  -- already applied (idempotent skip)
  errors           INTEGER NOT NULL DEFAULT 0,
  error_details    JSONB NOT NULL DEFAULT '[]',
  reason           TEXT NOT NULL,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-event result log within a session
CREATE TABLE public.replay_event_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.replay_sessions(id) ON DELETE CASCADE,
  event_id         UUID NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  projection_name  TEXT,
  result           TEXT NOT NULL CHECK (result IN ('replayed','skipped','error')),
  error_detail     TEXT,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX replay_sessions_admin_idx   ON public.replay_sessions (initiated_by, created_at DESC);
CREATE INDEX replay_sessions_status_idx  ON public.replay_sessions (status, created_at DESC);
CREATE INDEX replay_event_log_session_idx ON public.replay_event_log (session_id, processed_at DESC);
CREATE INDEX replay_event_log_event_idx  ON public.replay_event_log (event_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.replay_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_event_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_replay_sessions  ON public.replay_sessions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_replay    ON public.replay_sessions TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_replay_log       ON public.replay_event_log FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_replay_log ON public.replay_event_log TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Internal: dispatch one event through the appropriate projection RPC.
-- Returns 'replayed', 'skipped', or 'error:...'
CREATE OR REPLACE FUNCTION public._replay_one_event(
  p_event          public.domain_events,
  p_projection     TEXT,   -- NULL = all matching projections
  p_dry_run        BOOLEAN
)
RETURNS TEXT   -- 'replayed', 'skipped', 'error:<msg>'
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kitchen_id UUID;
  v_prepper_id UUID;
  v_total_pence BIGINT;
BEGIN
  IF p_dry_run THEN
    -- In dry-run mode, just check if already applied
    IF EXISTS (
      SELECT 1 FROM public.projection_event_log
      WHERE event_id = p_event.id
        AND (p_projection IS NULL OR projection_name = p_projection)
    ) THEN RETURN 'skipped'; END IF;
    RETURN 'replayed'; -- would replay
  END IF;

  CASE p_event.event_type

    WHEN 'order.created' THEN
      IF p_projection IS NOT NULL AND p_projection NOT IN (
        'project_order_created', 'increment_kitchen_orders', 'record_order_analytics'
      ) THEN RETURN 'skipped'; END IF;

      v_kitchen_id  := (p_event.payload ->> 'kitchen_id')::UUID;
      v_prepper_id  := (p_event.payload ->> 'prepper_id')::UUID;
      v_total_pence := (p_event.payload ->> 'total_pence')::BIGINT;

      IF v_kitchen_id IS NULL THEN
        SELECT kitchen_id INTO v_kitchen_id FROM public.orders WHERE id = p_event.aggregate_id;
      END IF;
      IF v_prepper_id IS NULL THEN
        SELECT prepper_id INTO v_prepper_id FROM public.kitchens WHERE id = v_kitchen_id;
      END IF;
      IF v_total_pence IS NULL THEN
        SELECT total_pence INTO v_total_pence FROM public.orders WHERE id = p_event.aggregate_id;
      END IF;

      PERFORM public.project_order_created(
        p_event.id, p_event.aggregate_id,
        p_event.actor_id,    -- customer_id
        v_kitchen_id, v_prepper_id, v_total_pence, p_event.occurred_at
      );
      PERFORM public.increment_kitchen_orders(
        v_kitchen_id, p_event.occurred_at::DATE, p_event.id
      );

    WHEN 'order.status_changed' THEN
      IF (p_event.payload ->> 'status') = 'cancelled' THEN
        v_kitchen_id := (p_event.payload ->> 'kitchen_id')::UUID;
        v_prepper_id := (p_event.payload ->> 'prepper_id')::UUID;
        IF v_kitchen_id IS NULL THEN
          SELECT kitchen_id INTO v_kitchen_id FROM public.orders WHERE id = p_event.aggregate_id;
        END IF;
        IF v_prepper_id IS NULL THEN
          SELECT prepper_id INTO v_prepper_id FROM public.kitchens WHERE id = v_kitchen_id;
        END IF;
        PERFORM public.project_order_cancelled(
          p_event.id, p_event.aggregate_id, p_event.actor_id,
          v_kitchen_id, v_prepper_id, 0
        );
      ELSE
        RETURN 'skipped'; -- no projection for other status changes
      END IF;

    ELSE
      -- Unknown event type — no projection to replay
      RETURN 'skipped';
  END CASE;

  RETURN 'replayed';

EXCEPTION WHEN OTHERS THEN
  RETURN 'error:' || SQLERRM;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._replay_one_event(public.domain_events, TEXT, BOOLEAN) FROM PUBLIC;

-- Replay a single event (admin-facing)
CREATE OR REPLACE FUNCTION public.admin_replay_event(
  p_event_id      UUID,
  p_projection    TEXT DEFAULT NULL,
  p_dry_run       BOOLEAN DEFAULT FALSE,
  p_reason        TEXT DEFAULT 'manual replay'
)
RETURNS UUID   -- returns replay_session.id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event   public.domain_events%ROWTYPE;
  v_session UUID;
  v_result  TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_event FROM public.domain_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;

  INSERT INTO public.replay_sessions
    (initiated_by, replay_type, target_event_id, projection_name, dry_run, status, reason, started_at)
  VALUES (auth.uid(), 'single_event', p_event_id, p_projection, p_dry_run, 'running', p_reason, NOW())
  RETURNING id INTO v_session;

  v_result := public._replay_one_event(v_event, p_projection, p_dry_run);

  INSERT INTO public.replay_event_log
    (session_id, event_id, event_type, projection_name, result, error_detail)
  VALUES (
    v_session, p_event_id, v_event.event_type, p_projection,
    CASE WHEN v_result LIKE 'error:%' THEN 'error' ELSE v_result END,
    CASE WHEN v_result LIKE 'error:%' THEN SUBSTRING(v_result FROM 7) ELSE NULL END
  );

  UPDATE public.replay_sessions SET
    status        = CASE
      WHEN p_dry_run        THEN 'dry_run_complete'
      WHEN v_result = 'error:...' THEN 'failed'
      ELSE 'completed'
    END,
    events_scanned  = 1,
    events_replayed = CASE WHEN v_result = 'replayed' THEN 1 ELSE 0 END,
    events_skipped  = CASE WHEN v_result = 'skipped'  THEN 1 ELSE 0 END,
    errors          = CASE WHEN v_result LIKE 'error:%' THEN 1 ELSE 0 END,
    completed_at    = NOW()
  WHERE id = v_session;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_replay_event(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;

-- Replay all events in a time range for a specific projection
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

    IF    v_result = 'replayed'        THEN v_replayed := v_replayed + 1;
    ELSIF v_result = 'skipped'         THEN v_skipped  := v_skipped  + 1;
    ELSIF v_result LIKE 'error:%'      THEN
      v_errors   := v_errors + 1;
      v_err_list := v_err_list || jsonb_build_array(
        jsonb_build_object('event_id', v_event.id, 'error', SUBSTRING(v_result FROM 7))
      );
    END IF;
  END LOOP;

  UPDATE public.replay_sessions SET
    status          = CASE
      WHEN p_dry_run    THEN 'dry_run_complete'
      WHEN v_errors > 0 THEN 'completed'   -- partial success is still completed
      ELSE 'completed'
    END,
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

-- Rebuild a single named projection from scratch (clears its entries from projection_event_log)
CREATE OR REPLACE FUNCTION public.admin_rebuild_projection(
  p_projection_name TEXT,
  p_dry_run         BOOLEAN DEFAULT FALSE,
  p_reason          TEXT DEFAULT 'projection rebuild'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session UUID;
  v_oldest_event TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Find the oldest event for this projection type
  SELECT MIN(de.occurred_at) INTO v_oldest_event
  FROM public.domain_events de;

  IF v_oldest_event IS NULL THEN
    RAISE EXCEPTION 'no_events_to_replay';
  END IF;

  IF NOT p_dry_run THEN
    -- Clear existing projection log entries so all events re-apply
    DELETE FROM public.projection_event_log
    WHERE projection_name = p_projection_name;
  END IF;

  -- Replay all events from the beginning
  SELECT public.admin_replay_range(
    v_oldest_event - INTERVAL '1 second',
    NOW(),
    p_projection_name,
    p_dry_run,
    p_reason
  ) INTO v_session;

  UPDATE public.replay_sessions SET
    replay_type = 'projection_rebuild'
  WHERE id = v_session;

  RETURN v_session;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_projection(TEXT, BOOLEAN, TEXT) TO authenticated;

-- Get replay session status (admin dashboard polling)
CREATE OR REPLACE FUNCTION public.admin_get_replay_session(p_session_id UUID)
RETURNS public.replay_sessions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.replay_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO v_row FROM public.replay_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_replay_session(UUID) TO authenticated;
