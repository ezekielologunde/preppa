-- ── 005 reliability_layer ─────────────────────────────────────────────────────
-- Listing stats, daily analytics, security events, platform health metrics,
-- and the RPCs that write to them.

CREATE TYPE public.security_event_severity AS ENUM ('info', 'warn', 'critical');

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.listing_stats (
  listing_id     UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  views          INTEGER NOT NULL DEFAULT 0,
  saves          INTEGER NOT NULL DEFAULT 0,
  orders_count   INTEGER NOT NULL DEFAULT 0,
  revenue_pence  BIGINT NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  favorites      INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  cancellations  INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.analytics_daily (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepper_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  orders_count   INTEGER NOT NULL DEFAULT 0,
  revenue_pence  BIGINT NOT NULL DEFAULT 0,
  cancellations  INTEGER NOT NULL DEFAULT 0,
  new_customers  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (prepper_id, date)
);

CREATE TABLE public.security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id   UUID,
  ip_address  INET,
  user_agent  TEXT,
  payload     JSONB NOT NULL DEFAULT '{}',
  severity    public.security_event_severity NOT NULL DEFAULT 'info',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_health_metrics (
  id                          INTEGER PRIMARY KEY DEFAULT 1,
  retry_queue_depth           INTEGER NOT NULL DEFAULT 0,
  dead_letter_count           INTEGER NOT NULL DEFAULT 0,
  critical_security_events_24h INTEGER NOT NULL DEFAULT 0,
  unresolved_dead_letters     INTEGER NOT NULL DEFAULT 0,
  avg_event_processing_ms     INTEGER,
  orders_last_hour            INTEGER NOT NULL DEFAULT 0,
  payment_failures_24h        INTEGER NOT NULL DEFAULT 0,
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- Seed the singleton row
INSERT INTO public.platform_health_metrics (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX listing_stats_revenue_idx   ON public.listing_stats (revenue_pence DESC);
CREATE INDEX listing_stats_orders_idx    ON public.listing_stats (orders_count DESC);

CREATE INDEX analytics_daily_prepper_idx ON public.analytics_daily (prepper_id, date DESC);
CREATE INDEX analytics_daily_date_idx    ON public.analytics_daily (date DESC);

CREATE INDEX security_events_actor_idx   ON public.security_events (actor_id);
CREATE INDEX security_events_severity_idx ON public.security_events (severity, occurred_at DESC);
CREATE INDEX security_events_type_idx    ON public.security_events (event_type, occurred_at DESC);

-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.emit_security_event(
  p_event_type TEXT,
  p_actor_id   UUID,
  p_target_id  UUID,
  p_severity   public.security_event_severity,
  p_payload    JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_events
    (event_type, actor_id, target_id, severity, payload)
  VALUES (p_event_type, p_actor_id, p_target_id, p_severity, p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_retry_events()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec   RECORD;
BEGIN
  FOR v_rec IN
    SELECT epl.event_id, de.*
    FROM public.event_processing_log epl
    JOIN public.domain_events de ON de.id = epl.event_id
    WHERE epl.status = 'pending_retry'
      AND epl.next_attempt_at <= NOW()
    ORDER BY epl.next_attempt_at
    LIMIT 50
  LOOP
    UPDATE public.event_processing_log
    SET status = 'processing',
        last_attempt_at = NOW(),
        attempt_count = attempt_count + 1
    WHERE event_id = v_rec.event_id;

    PERFORM net.http_post(
      url     := 'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/event-processor',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := row_to_json(v_rec)::JSONB
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_platform_health()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lock_obtained BOOLEAN;
BEGIN
  -- Advisory lock prevents concurrent writes to the singleton row
  SELECT pg_try_advisory_lock(42001) INTO v_lock_obtained;
  IF NOT v_lock_obtained THEN RETURN; END IF;

  UPDATE public.platform_health_metrics SET
    retry_queue_depth = (
      SELECT COUNT(*) FROM public.event_processing_log
      WHERE status = 'pending_retry'
    ),
    dead_letter_count = (
      SELECT COUNT(*) FROM public.event_dead_letters
    ),
    critical_security_events_24h = (
      SELECT COUNT(*) FROM public.security_events
      WHERE severity = 'critical' AND occurred_at >= NOW() - INTERVAL '24 hours'
    ),
    unresolved_dead_letters = (
      SELECT COUNT(*) FROM public.event_dead_letters
      WHERE resolved_at IS NULL
    ),
    avg_event_processing_ms = (
      SELECT EXTRACT(EPOCH FROM AVG(processed_at - created_at)) * 1000
      FROM public.event_processing_log
      WHERE status = 'success' AND processed_at >= NOW() - INTERVAL '1 hour'
    )::INTEGER,
    orders_last_hour = (
      SELECT COUNT(*) FROM public.orders
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    ),
    payment_failures_24h = (
      SELECT COUNT(*) FROM public.payments
      WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
    ),
    computed_at = NOW()
  WHERE id = 1;

  PERFORM pg_advisory_unlock(42001);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_analytics(
  p_prepper_id    UUID,
  p_order_date    DATE,
  p_revenue_pence BIGINT,
  p_is_new_customer BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.analytics_daily
    (prepper_id, date, orders_count, revenue_pence, new_customers)
  VALUES (p_prepper_id, p_order_date, 1, p_revenue_pence,
    CASE WHEN p_is_new_customer THEN 1 ELSE 0 END)
  ON CONFLICT (prepper_id, date) DO UPDATE SET
    orders_count  = analytics_daily.orders_count + 1,
    revenue_pence = analytics_daily.revenue_pence + EXCLUDED.revenue_pence,
    new_customers = analytics_daily.new_customers + EXCLUDED.new_customers;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.listing_stats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_listing_stats ON public.listing_stats FOR SELECT TO public USING (true);
CREATE POLICY service_role_listing_stats ON public.listing_stats TO service_role USING (true) WITH CHECK (true);

CREATE POLICY preppers_own_analytics ON public.analytics_daily FOR SELECT TO authenticated
  USING (prepper_id = auth.uid());
CREATE POLICY service_role_analytics ON public.analytics_daily TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_security_events ON public.security_events TO service_role USING (true) WITH CHECK (true);

CREATE POLICY public_read_health ON public.platform_health_metrics FOR SELECT TO public USING (true);
CREATE POLICY service_role_health ON public.platform_health_metrics TO service_role USING (true) WITH CHECK (true);
