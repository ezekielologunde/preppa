-- ── 012 observability ─────────────────────────────────────────────────────────
-- Historical metric snapshots, threshold-based alerting, and the RPCs that
-- feed observability data from edge functions + pg_cron.

-- ── Tables ────────────────────────────────────────────────────────────────────

-- Time-series snapshots of platform_health_metrics (taken every minute by pg_cron)
CREATE TABLE public.metrics_snapshots (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Event pipeline
  retry_queue_depth             INTEGER NOT NULL DEFAULT 0,
  dead_letter_count             INTEGER NOT NULL DEFAULT 0,
  unresolved_dead_letters       INTEGER NOT NULL DEFAULT 0,
  avg_event_processing_ms       INTEGER,
  -- Security
  critical_security_events_24h  INTEGER NOT NULL DEFAULT 0,
  -- Orders
  orders_last_hour              INTEGER NOT NULL DEFAULT 0,
  payment_failures_24h          INTEGER NOT NULL DEFAULT 0,
  -- Latency (populated by edge functions via record_latency_metric)
  p50_api_ms                    INTEGER,
  p95_api_ms                    INTEGER,
  p99_api_ms                    INTEGER,
  p50_db_ms                     INTEGER,
  p95_db_ms                     INTEGER,
  p50_projection_lag_ms         INTEGER,
  p95_projection_lag_ms         INTEGER,
  -- Throughput
  event_throughput_per_min      INTEGER,
  notification_queue_depth      INTEGER,
  -- Storage
  storage_objects_pending       INTEGER,
  storage_objects_quarantined   INTEGER,
  -- Users
  active_users_last_hour        INTEGER,
  active_kitchens_last_hour     INTEGER,
  active_orders_now             INTEGER,
  snapped_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw latency samples (written by edge functions; aggregated into snapshots)
CREATE TABLE public.latency_samples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation   TEXT NOT NULL,   -- 'api_rpc', 'db_query', 'edge_fn', 'projection', 'notification', 'storage', 'payment'
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert threshold configuration
CREATE TABLE public.alert_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name   TEXT NOT NULL UNIQUE,
  threshold     NUMERIC NOT NULL,
  comparison    TEXT NOT NULL CHECK (comparison IN ('gt', 'lt', 'gte', 'lte')),
  severity      public.security_event_severity NOT NULL DEFAULT 'warn',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_mins INTEGER NOT NULL DEFAULT 15,  -- min minutes between repeated alerts
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggered alerts (written when a snapshot breaches a threshold)
CREATE TABLE public.active_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES public.alert_configs(id) ON DELETE CASCADE,
  metric_name     TEXT NOT NULL,
  threshold       NUMERIC NOT NULL,
  observed_value  NUMERIC NOT NULL,
  severity        public.security_event_severity NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot_id     UUID REFERENCES public.metrics_snapshots(id) ON DELETE SET NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX metrics_snapshots_time_idx  ON public.metrics_snapshots (snapped_at DESC);
CREATE INDEX latency_samples_op_idx      ON public.latency_samples (operation, recorded_at DESC);
CREATE INDEX latency_samples_time_idx    ON public.latency_samples (recorded_at DESC);
-- Auto-expire latency samples after 24h (no pg_partman needed; pruned by pg_cron)
CREATE INDEX latency_samples_expire_idx  ON public.latency_samples (recorded_at)
  WHERE recorded_at < NOW() - INTERVAL '24 hours';
CREATE INDEX active_alerts_open_idx      ON public.active_alerts (triggered_at DESC)
  WHERE resolved_at IS NULL;

-- ── Seed default alert thresholds ─────────────────────────────────────────────

INSERT INTO public.alert_configs (metric_name, threshold, comparison, severity, cooldown_mins) VALUES
  ('retry_queue_depth',           100,  'gt',  'warn',     15),
  ('retry_queue_depth',           500,  'gt',  'critical', 5),
  ('unresolved_dead_letters',     10,   'gt',  'warn',     60),
  ('unresolved_dead_letters',     50,   'gt',  'critical', 15),
  ('critical_security_events_24h',5,    'gt',  'warn',     30),
  ('critical_security_events_24h',20,   'gt',  'critical', 10),
  ('payment_failures_24h',        10,   'gt',  'warn',     30),
  ('avg_event_processing_ms',     5000, 'gt',  'warn',     15),
  ('avg_event_processing_ms',     30000,'gt',  'critical', 5),
  ('p95_api_ms',                  2000, 'gt',  'warn',     15),
  ('p95_api_ms',                  10000,'gt',  'critical', 5)
ON CONFLICT (metric_name) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latency_samples   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_alerts     ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_read_snapshots   ON public.metrics_snapshots FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY service_role_snapshots ON public.metrics_snapshots TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY service_role_latency   ON public.latency_samples TO service_role USING (TRUE) WITH CHECK (TRUE);
-- Edge functions write latency; no client access
CREATE POLICY admin_read_latency     ON public.latency_samples FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY admin_alert_configs    ON public.alert_configs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_alert_cfg ON public.alert_configs TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_active_alerts    ON public.active_alerts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_alerts    ON public.active_alerts TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Called by edge functions to record a latency sample
CREATE OR REPLACE FUNCTION public.record_latency(
  p_operation   TEXT,
  p_duration_ms INTEGER,
  p_success     BOOLEAN DEFAULT TRUE,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.latency_samples (operation, duration_ms, success, metadata)
  VALUES (p_operation, p_duration_ms, p_success, p_metadata);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_latency(TEXT, INTEGER, BOOLEAN, JSONB) TO service_role;

-- Snap platform_health_metrics + latency percentiles into metrics_snapshots
-- Called by pg_cron every minute.
CREATE OR REPLACE FUNCTION public.snap_metrics()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_health  public.platform_health_metrics%ROWTYPE;
  v_snap_id UUID;
  v_p50_api INTEGER; v_p95_api INTEGER; v_p99_api INTEGER;
  v_p50_db  INTEGER; v_p95_db  INTEGER;
  v_p50_lag INTEGER; v_p95_lag INTEGER;
  v_throughput INTEGER;
BEGIN
  SELECT * INTO v_health FROM public.platform_health_metrics WHERE id = 1;

  -- API percentiles from last 5 minutes
  SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::INTEGER,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::INTEGER
  INTO v_p50_api, v_p95_api, v_p99_api
  FROM public.latency_samples
  WHERE operation = 'api_rpc' AND recorded_at >= NOW() - INTERVAL '5 minutes';

  SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::INTEGER,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER
  INTO v_p50_db, v_p95_db
  FROM public.latency_samples
  WHERE operation = 'db_query' AND recorded_at >= NOW() - INTERVAL '5 minutes';

  -- Projection lag: time from domain_event.occurred_at to projection_event_log.applied_at
  SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (pel.applied_at - de.occurred_at)) * 1000)::INTEGER,
    PERCENTILE_CONT(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (pel.applied_at - de.occurred_at)) * 1000)::INTEGER
  INTO v_p50_lag, v_p95_lag
  FROM public.projection_event_log pel
  JOIN public.domain_events de ON de.id = pel.event_id
  WHERE pel.applied_at >= NOW() - INTERVAL '5 minutes';

  -- Event throughput (events per minute over last 5 minutes)
  SELECT COUNT(*) / 5 INTO v_throughput
  FROM public.domain_events
  WHERE occurred_at >= NOW() - INTERVAL '5 minutes';

  INSERT INTO public.metrics_snapshots (
    retry_queue_depth, dead_letter_count, unresolved_dead_letters,
    avg_event_processing_ms, critical_security_events_24h,
    orders_last_hour, payment_failures_24h,
    p50_api_ms, p95_api_ms, p99_api_ms,
    p50_db_ms, p95_db_ms,
    p50_projection_lag_ms, p95_projection_lag_ms,
    event_throughput_per_min,
    notification_queue_depth,
    storage_objects_pending, storage_objects_quarantined,
    active_users_last_hour, active_kitchens_last_hour, active_orders_now
  ) VALUES (
    v_health.retry_queue_depth, v_health.dead_letter_count, v_health.unresolved_dead_letters,
    v_health.avg_event_processing_ms, v_health.critical_security_events_24h,
    v_health.orders_last_hour, v_health.payment_failures_24h,
    v_p50_api, v_p95_api, v_p99_api,
    v_p50_db, v_p95_db,
    v_p50_lag, v_p95_lag,
    v_throughput,
    (SELECT COUNT(*) FROM public.notifications WHERE NOT read AND created_at >= NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM public.media_objects WHERE pipeline_status = 'pending'),
    (SELECT COUNT(*) FROM public.media_objects WHERE pipeline_status = 'quarantined'),
    (SELECT COUNT(DISTINCT customer_id) FROM public.orders WHERE created_at >= NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(DISTINCT kitchen_id) FROM public.orders WHERE created_at >= NOW() - INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM public.orders WHERE status IN ('confirmed','preparing','ready','in_transit'))
  )
  RETURNING id INTO v_snap_id;

  -- Check thresholds and fire alerts
  PERFORM public._check_alert_thresholds(v_snap_id);

  -- Prune latency samples older than 24h
  DELETE FROM public.latency_samples WHERE recorded_at < NOW() - INTERVAL '24 hours';

  RETURN v_snap_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._check_alert_thresholds(p_snap_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_snap     public.metrics_snapshots%ROWTYPE;
  v_config   RECORD;
  v_observed NUMERIC;
BEGIN
  SELECT * INTO v_snap FROM public.metrics_snapshots WHERE id = p_snap_id;

  FOR v_config IN
    SELECT * FROM public.alert_configs WHERE enabled = TRUE
  LOOP
    -- Extract the observed value for this metric
    v_observed := CASE v_config.metric_name
      WHEN 'retry_queue_depth'           THEN v_snap.retry_queue_depth
      WHEN 'unresolved_dead_letters'     THEN v_snap.unresolved_dead_letters
      WHEN 'critical_security_events_24h' THEN v_snap.critical_security_events_24h
      WHEN 'payment_failures_24h'        THEN v_snap.payment_failures_24h
      WHEN 'avg_event_processing_ms'     THEN v_snap.avg_event_processing_ms
      WHEN 'p95_api_ms'                  THEN v_snap.p95_api_ms
      WHEN 'p95_db_ms'                   THEN v_snap.p95_db_ms
      WHEN 'p95_projection_lag_ms'       THEN v_snap.p95_projection_lag_ms
      ELSE NULL
    END;

    CONTINUE WHEN v_observed IS NULL;

    -- Check if threshold breached
    CONTINUE WHEN NOT (
      (v_config.comparison = 'gt'  AND v_observed >  v_config.threshold) OR
      (v_config.comparison = 'gte' AND v_observed >= v_config.threshold) OR
      (v_config.comparison = 'lt'  AND v_observed <  v_config.threshold) OR
      (v_config.comparison = 'lte' AND v_observed <= v_config.threshold)
    );

    -- Cooldown check: skip if we fired this alert recently
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.active_alerts
      WHERE config_id = v_config.id
        AND triggered_at >= NOW() - (v_config.cooldown_mins || ' minutes')::INTERVAL
        AND resolved_at IS NULL
    );

    INSERT INTO public.active_alerts
      (config_id, metric_name, threshold, observed_value, severity, snapshot_id)
    VALUES
      (v_config.id, v_config.metric_name, v_config.threshold, v_observed, v_config.severity, p_snap_id);

    -- Emit security event for critical alerts
    IF v_config.severity = 'critical' THEN
      PERFORM public.emit_security_event(
        'alert.critical_threshold_breached', NULL, NULL, 'critical',
        jsonb_build_object('metric', v_config.metric_name, 'observed', v_observed, 'threshold', v_config.threshold)
      );
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._check_alert_thresholds(UUID) FROM PUBLIC;

-- Admin resolves an alert
CREATE OR REPLACE FUNCTION public.admin_resolve_alert(
  p_alert_id UUID,
  p_reason   TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  UPDATE public.active_alerts SET resolved_at = NOW(), resolved_by = auth.uid()
  WHERE id = p_alert_id AND resolved_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resolve_alert(UUID, TEXT) TO authenticated;

-- Admin queries recent snapshots for dashboard
CREATE OR REPLACE FUNCTION public.admin_get_metrics_history(
  p_hours INTEGER DEFAULT 24
)
RETURNS SETOF public.metrics_snapshots
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  RETURN QUERY
    SELECT * FROM public.metrics_snapshots
    WHERE snapped_at >= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY snapped_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_metrics_history(INTEGER) TO authenticated;
