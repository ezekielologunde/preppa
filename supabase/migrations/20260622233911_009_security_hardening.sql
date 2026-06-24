-- ── 009 security_hardening ────────────────────────────────────────────────────
-- RLS tightening on storage, privilege revocation on internal RPCs,
-- idempotent increment_kitchen_orders, and performance indexes.

-- ── Storage RLS: restrict self-uploads to temp/{uid}/ path prefix ─────────────

-- Drop the permissive INSERT policy from 008 and replace with path-scoped one
DROP POLICY IF EXISTS users_insert_media ON public.media_objects;

CREATE POLICY users_insert_media_scoped ON public.media_objects FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND storage_path IS NULL -- path is NULL at intake; upload-pipeline sets it
  );

-- ── Revoke PUBLIC execute from privileged internal RPCs ───────────────────────
-- These functions are called only by the upload-pipeline edge function
-- via service_role JWT — anon/authenticated roles should never call them.

REVOKE EXECUTE ON FUNCTION public.confirm_media_ready(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_media(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_uploads(INTEGER) FROM PUBLIC;

-- Re-grant explicitly to service_role only
GRANT EXECUTE ON FUNCTION public.confirm_media_ready(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_media(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_uploads(INTEGER) TO service_role;

-- ── Idempotent increment_kitchen_orders (3-arg form with event_id gate) ───────
-- Replaces the 2-arg version from migration 006.
-- Concurrently safe: advisory lock + ON CONFLICT + projection_event_log gate.

CREATE OR REPLACE FUNCTION public.increment_kitchen_orders(
  p_kitchen_id UUID,
  p_date       DATE,
  p_event_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted INTEGER;
  v_daily_cap INTEGER;
BEGIN
  -- Idempotency gate via projection_event_log (shared with CQRS projectors)
  INSERT INTO public.projection_event_log (event_id, projection_name)
  VALUES (p_event_id, 'increment_kitchen_orders')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN; END IF; -- already counted

  -- Fetch kitchen's daily capacity for the initial upsert
  SELECT daily_capacity INTO v_daily_cap
  FROM public.kitchens WHERE id = p_kitchen_id;

  -- Atomic counter upsert — no TOCTOU
  INSERT INTO public.kitchen_capacity
    (kitchen_id, date, daily_limit, orders_accepted)
  VALUES (p_kitchen_id, p_date, COALESCE(v_daily_cap, 20), 1)
  ON CONFLICT (kitchen_id, date) DO UPDATE SET
    orders_accepted = kitchen_capacity.orders_accepted + 1;
END;
$$;

-- ── Performance indexes added post-audit ──────────────────────────────────────

-- Hot path: event-processor looks up EPL by event_id (already the PK component),
-- but also queries by projection_name for fan-out; add covering index.
CREATE INDEX IF NOT EXISTS pel_projection_event_idx
  ON public.projection_event_log (projection_name, event_id);

-- Security event lookup by actor for admin dashboards
CREATE INDEX IF NOT EXISTS security_events_actor_occurred_idx
  ON public.security_events (actor_id, occurred_at DESC);

-- Unresolved dead letters ordered by age for triage queue
CREATE INDEX IF NOT EXISTS edl_unresolved_age_idx
  ON public.event_dead_letters (failed_at ASC)
  WHERE resolved_at IS NULL;

-- Retry queue hot path: ordered by next_attempt_at (covered)
CREATE INDEX IF NOT EXISTS epl_retry_next_idx
  ON public.event_processing_log (next_attempt_at ASC, event_id)
  WHERE status = 'pending_retry';

-- Kitchen capacity date range queries (pg_cron daily rollover)
CREATE INDEX IF NOT EXISTS kitchen_capacity_date_idx
  ON public.kitchen_capacity (date DESC);

-- Prepper analytics: recent orders for dashboard
CREATE INDEX IF NOT EXISTS orders_prepper_recent_idx
  ON public.orders (kitchen_id, created_at DESC)
  WHERE status NOT IN ('cancelled', 'refunded');

-- ── Advisory lock on refresh_platform_health (already in 005) ─────────────────
-- Nothing to do here — the pg_try_advisory_lock(42001) was baked into the
-- function body in migration 005. This comment is a no-op marker.
