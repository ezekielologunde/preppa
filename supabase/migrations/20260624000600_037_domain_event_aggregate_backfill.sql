-- ── 037 domain_event_aggregate_backfill ───────────────────────────────────────
-- Sprint 30 P0 (discovered while integration-testing the order flow): every
-- domain event emitted by migrations 028/029/030/033/034 inserts only
-- (event_type, payload), but domain_events.aggregate_type and aggregate_id are
-- NOT NULL. So order.verified, order.disputed, dispute.resolved,
-- escrow.auto_releasing, prepper.approved/rejected/suspended, and the cert cron
-- events ALL threw "null value in column aggregate_type" at runtime — the entire
-- escrow handoff, dispute, and prepper-approval pipelines were dead.
--
-- The event-processor (and replay console) route on aggregate_id, so relaxing
-- the NOT NULL constraint is wrong — they would receive null ids. Rewriting all
-- ~11 emitters (several embedded in pg_cron job bodies) is brittle.
--
-- Best fix: a single BEFORE INSERT trigger that backfills the two columns from
-- the payload when an emitter omits them. Fully-specified inserts (e.g.
-- emit_order_event) are untouched because the trigger only fills NULLs. This
-- corrects every existing emitter and any future one in one place.

CREATE OR REPLACE FUNCTION public.fill_domain_event_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Derive the aggregate id from whichever entity key the payload carries.
  IF NEW.aggregate_id IS NULL THEN
    NEW.aggregate_id := COALESCE(
      NULLIF(NEW.payload ->> 'order_id',       ''),
      NULLIF(NEW.payload ->> 'user_id',        ''),
      NULLIF(NEW.payload ->> 'listing_id',     ''),
      NULLIF(NEW.payload ->> 'kitchen_id',     ''),
      NULLIF(NEW.payload ->> 'application_id', '')
    )::UUID;
  END IF;

  -- Derive the aggregate type from the event-type namespace.
  IF NEW.aggregate_type IS NULL THEN
    NEW.aggregate_type := CASE
      WHEN NEW.event_type LIKE 'order.%'
        OR NEW.event_type LIKE 'escrow.%'
        OR NEW.event_type LIKE 'dispute.%' THEN 'order'
      WHEN NEW.event_type LIKE 'prepper.%'
        OR NEW.event_type LIKE 'cert.%'    THEN 'prepper'
      WHEN NEW.event_type LIKE 'listing.%' THEN 'listing'
      WHEN NEW.event_type LIKE 'payment.%' THEN 'payment'
      ELSE split_part(NEW.event_type, '.', 1)
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE INSERT so the fill happens prior to the NOT NULL check.
CREATE TRIGGER domain_events_fill_aggregate
  BEFORE INSERT ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.fill_domain_event_aggregate();
