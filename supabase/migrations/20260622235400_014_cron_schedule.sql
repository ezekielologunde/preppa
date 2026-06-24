-- ── 014 cron_schedule ─────────────────────────────────────────────────────────
-- pg_cron registrations for all background maintenance jobs.
-- Requires pg_cron extension (available on Supabase Pro+).
-- On free tier: call these manually or via external scheduler.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Refresh platform health every minute (already exists from 005; confirm scheduled)
SELECT cron.schedule(
  'refresh-platform-health',
  '* * * * *',
  'SELECT public.refresh_platform_health()'
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-platform-health'
);

-- Snap observability metrics every minute
SELECT cron.schedule(
  'snap-metrics',
  '* * * * *',
  'SELECT public.snap_metrics()'
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'snap-metrics'
);

-- Dispatch retry events every minute (idempotent; picks up pending_retry events)
SELECT cron.schedule(
  'dispatch-retry-events',
  '* * * * *',
  'SELECT public.dispatch_retry_events()'
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'dispatch-retry-events'
);

-- Cleanup stale uploads every hour
SELECT cron.schedule(
  'cleanup-stale-uploads',
  '0 * * * *',
  'SELECT public.cleanup_stale_uploads(24)'
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-uploads'
);

-- Prune metrics snapshots older than 90 days (retain history)
SELECT cron.schedule(
  'prune-metrics-history',
  '0 2 * * *',
  $$DELETE FROM public.metrics_snapshots WHERE snapped_at < NOW() - INTERVAL '90 days'$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prune-metrics-history'
);

-- Prune audit_logs older than 365 days (compliance: 1-year retention)
SELECT cron.schedule(
  'prune-audit-logs',
  '0 3 * * *',
  $$DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '365 days'$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prune-audit-logs'
);

-- Prune admin_action_log older than 365 days (same compliance retention)
SELECT cron.schedule(
  'prune-admin-action-log',
  '0 3 * * *',
  $$DELETE FROM public.admin_action_log WHERE created_at < NOW() - INTERVAL '365 days' AND reversed_at IS NOT NULL$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prune-admin-action-log'
);

-- Deactivate expired feature flags daily
SELECT cron.schedule(
  'expire-feature-flags',
  '0 0 * * *',
  $$UPDATE public.feature_flags SET enabled = FALSE, updated_at = NOW()
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND enabled = TRUE$$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-feature-flags'
);
