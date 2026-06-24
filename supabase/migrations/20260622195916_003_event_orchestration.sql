-- ── 003 event_orchestration ───────────────────────────────────────────────────
-- Domain event log, audit dead-letters, event processing log.

CREATE TABLE public.domain_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   UUID NOT NULL,
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  version        INTEGER NOT NULL DEFAULT 1,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.event_processing_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL UNIQUE REFERENCES public.domain_events(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'processing',
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  failure_reason   TEXT,
  last_attempt_at  TIMESTAMPTZ,
  next_attempt_at  TIMESTAMPTZ,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.event_dead_letters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  final_error      TEXT NOT NULL,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  payload_snapshot JSONB NOT NULL DEFAULT '{}',
  failed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note  TEXT
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX domain_events_aggregate_idx ON public.domain_events (aggregate_type, aggregate_id);
CREATE INDEX domain_events_type_idx      ON public.domain_events (event_type);
CREATE INDEX domain_events_occurred_idx  ON public.domain_events (occurred_at DESC);

CREATE INDEX epl_status_idx             ON public.event_processing_log (status);
CREATE INDEX epl_next_attempt_idx       ON public.event_processing_log (next_attempt_at)
  WHERE status = 'pending_retry';
CREATE INDEX epl_event_id_idx           ON public.event_processing_log (event_id);

CREATE INDEX edl_event_id_idx           ON public.event_dead_letters (event_id);
CREATE INDEX edl_resolved_idx           ON public.event_dead_letters (resolved_at)
  WHERE resolved_at IS NULL;
CREATE INDEX edl_failed_at_idx          ON public.event_dead_letters (failed_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.domain_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dead_letters   ENABLE ROW LEVEL SECURITY;

-- Domain events are written by service role (triggers) and read by service role
CREATE POLICY service_role_domain_events ON public.domain_events
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_epl ON public.event_processing_log
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_edl ON public.event_dead_letters
  TO service_role USING (true) WITH CHECK (true);

-- Actors can see events for their own aggregates
CREATE POLICY actors_own_events ON public.domain_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- Now that domain_events exists, wire up the order event trigger from 002
CREATE TRIGGER order_domain_events
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.emit_order_event();

-- listing event trigger (emit_listing_event fires from publish/status changes)
CREATE OR REPLACE FUNCTION public.emit_listing_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
  VALUES (
    CASE
      WHEN TG_OP = 'INSERT'         THEN 'listing.created'
      WHEN NEW.status = 'published' THEN 'listing.published'
      WHEN NEW.status = 'archived'  THEN 'listing.archived'
      WHEN NEW.status = 'deleted'   THEN 'listing.deleted'
      ELSE 'listing.updated'
    END,
    'listing', NEW.id, NEW.prepper_id,
    jsonb_build_object(
      'status', NEW.status,
      'name',   NEW.name,
      'price_pence', NEW.price_pence
    ),
    1
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_domain_events
  AFTER INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.emit_listing_event();
