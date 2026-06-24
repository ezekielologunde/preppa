-- ── 006 cqrs_projections ──────────────────────────────────────────────────────
-- Projection event log (idempotency gate), read-model tables,
-- and the RPC projectors that update them.

CREATE TABLE public.projection_event_log (
  event_id         UUID NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
  projection_name  TEXT NOT NULL,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, projection_name)
);

CREATE TABLE public.prepper_metrics (
  prepper_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_orders        INTEGER NOT NULL DEFAULT 0,
  total_revenue_pence BIGINT NOT NULL DEFAULT 0,
  cancelled_orders    INTEGER NOT NULL DEFAULT 0,
  today_orders        INTEGER NOT NULL DEFAULT 0,
  today_revenue_pence BIGINT NOT NULL DEFAULT 0,
  today_date          DATE,
  week_orders         INTEGER NOT NULL DEFAULT 0,
  week_revenue_pence  BIGINT NOT NULL DEFAULT 0,
  week_start_date     DATE,
  month_orders        INTEGER NOT NULL DEFAULT 0,
  month_revenue_pence BIGINT NOT NULL DEFAULT 0,
  month_start_date    DATE,
  average_rating      NUMERIC(3,2),
  completion_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_order_at       TIMESTAMPTZ,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.customer_metrics (
  customer_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_orders        INTEGER NOT NULL DEFAULT 0,
  lifetime_value_pence BIGINT NOT NULL DEFAULT 0,
  average_order_pence BIGINT NOT NULL DEFAULT 0,
  cancelled_orders    INTEGER NOT NULL DEFAULT 0,
  first_order_at      TIMESTAMPTZ,
  last_order_at       TIMESTAMPTZ,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.kitchen_metrics (
  kitchen_id          UUID PRIMARY KEY REFERENCES public.kitchens(id) ON DELETE CASCADE,
  total_orders        INTEGER NOT NULL DEFAULT 0,
  completed_orders    INTEGER NOT NULL DEFAULT 0,
  cancelled_orders    INTEGER NOT NULL DEFAULT 0,
  total_revenue_pence BIGINT NOT NULL DEFAULT 0,
  average_prep_minutes NUMERIC(6,1),
  utilization_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_order_at       TIMESTAMPTZ,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_metrics (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  total_orders     INTEGER NOT NULL DEFAULT 0,
  total_revenue_pence BIGINT NOT NULL DEFAULT 0,
  total_listings   INTEGER NOT NULL DEFAULT 0,
  active_listings  INTEGER NOT NULL DEFAULT 0,
  orders_today     INTEGER NOT NULL DEFAULT 0,
  revenue_today_pence BIGINT NOT NULL DEFAULT 0,
  today_date       DATE,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_metrics_singleton CHECK (id = 1)
);

-- Seed singletons
INSERT INTO public.platform_metrics (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX pel_projection_idx      ON public.projection_event_log (projection_name);
CREATE INDEX pel_applied_at_idx      ON public.projection_event_log (applied_at DESC);

CREATE INDEX prepper_metrics_revenue ON public.prepper_metrics (total_revenue_pence DESC);
CREATE INDEX customer_metrics_ltv    ON public.customer_metrics (lifetime_value_pence DESC);
CREATE INDEX kitchen_metrics_orders  ON public.kitchen_metrics (total_orders DESC);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Idempotency helper used by all projectors.
-- Returns TRUE if the event was already applied for this projection.
CREATE OR REPLACE FUNCTION public._projection_already_applied(
  p_event_id UUID, p_projection_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO public.projection_event_log (event_id, projection_name)
  VALUES (p_event_id, p_projection_name)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 0; -- 0 rows inserted → already applied
END;
$$;

CREATE OR REPLACE FUNCTION public.project_order_created(
  p_event_id      UUID,
  p_order_id      UUID,
  p_customer_id   UUID,
  p_kitchen_id    UUID,
  p_prepper_id    UUID,
  p_total_pence   BIGINT,
  p_occurred_at   TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._projection_already_applied(p_event_id, 'project_order_created') THEN RETURN; END IF;

  -- prepper_metrics
  INSERT INTO public.prepper_metrics (prepper_id, total_orders, total_revenue_pence, last_order_at, last_updated)
  VALUES (p_prepper_id, 1, p_total_pence, p_occurred_at, NOW())
  ON CONFLICT (prepper_id) DO UPDATE SET
    total_orders        = prepper_metrics.total_orders + 1,
    total_revenue_pence = prepper_metrics.total_revenue_pence + EXCLUDED.total_revenue_pence,
    last_order_at       = GREATEST(prepper_metrics.last_order_at, p_occurred_at),
    last_updated        = NOW();

  -- customer_metrics
  INSERT INTO public.customer_metrics (customer_id, total_orders, lifetime_value_pence,
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

  -- kitchen_metrics
  INSERT INTO public.kitchen_metrics (kitchen_id, total_orders, total_revenue_pence, last_order_at, last_updated)
  VALUES (p_kitchen_id, 1, p_total_pence, p_occurred_at, NOW())
  ON CONFLICT (kitchen_id) DO UPDATE SET
    total_orders        = kitchen_metrics.total_orders + 1,
    total_revenue_pence = kitchen_metrics.total_revenue_pence + p_total_pence,
    last_order_at       = GREATEST(kitchen_metrics.last_order_at, p_occurred_at),
    last_updated        = NOW();

  -- platform_metrics
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
  IF public._projection_already_applied(p_event_id, 'project_order_cancelled') THEN RETURN; END IF;

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

-- Initial 2-arg version (upgraded to 3-arg idempotent form in migration 009)
CREATE OR REPLACE FUNCTION public.increment_kitchen_orders(
  p_kitchen_id UUID,
  p_date       DATE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kitchen_capacity (kitchen_id, date, daily_limit, orders_accepted)
  SELECT p_kitchen_id, p_date, COALESCE(k.daily_capacity, 20), 1
  FROM public.kitchens k WHERE k.id = p_kitchen_id
  ON CONFLICT (kitchen_id, date) DO UPDATE SET
    orders_accepted = kitchen_capacity.orders_accepted + 1;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.projection_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prepper_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_metrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_metrics     ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_pel ON public.projection_event_log TO service_role USING (true) WITH CHECK (true);

CREATE POLICY preppers_own_metrics ON public.prepper_metrics FOR SELECT TO authenticated
  USING (prepper_id = auth.uid());
CREATE POLICY service_role_prepper_metrics ON public.prepper_metrics TO service_role USING (true) WITH CHECK (true);

CREATE POLICY customers_own_metrics ON public.customer_metrics FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY service_role_customer_metrics ON public.customer_metrics TO service_role USING (true) WITH CHECK (true);

CREATE POLICY public_read_kitchen_metrics ON public.kitchen_metrics FOR SELECT TO public USING (true);
CREATE POLICY service_role_kitchen_metrics ON public.kitchen_metrics TO service_role USING (true) WITH CHECK (true);

CREATE POLICY public_read_platform_metrics ON public.platform_metrics FOR SELECT TO public USING (true);
CREATE POLICY service_role_platform_metrics ON public.platform_metrics TO service_role USING (true) WITH CHECK (true);
