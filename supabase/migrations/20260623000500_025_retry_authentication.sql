-- ── 025 retry_authentication ───────────────────────────────────────────────────
-- Fix: dispatch_retry_events was sending pg_net requests without an Authorization
-- header. The event-processor edge function validates Bearer tokens in production,
-- so every retry attempt was silently rejected with 401 and never processed.
--
-- Pattern: identical to dispatch_to_event_processor() in migration 004.
-- Vault secret: SERVICE_ROLE_KEY

-- ── TASK 1: Fix dispatch_retry_events ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dispatch_retry_events()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service_key TEXT;
  v_count       INTEGER := 0;
  v_rec         RECORD;
BEGIN
  -- Same vault read pattern as dispatch_to_event_processor (migration 004).
  -- Falls back to empty string so the function never hard-errors on vault failure.
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SERVICE_ROLE_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := '';
  END;

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
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
      ),
      body    := row_to_json(v_rec)::JSONB
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── TASK 2: Retry response monitoring ─────────────────────────────────────────

-- Counts 401/403 responses to the event-processor in the last 5 minutes,
-- emits a critical security event if any are found, and updates the singleton.
-- net._http_response is created by the pg_net extension.
CREATE OR REPLACE FUNCTION public.check_retry_auth_failures()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_failures INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_failures
  FROM net._http_response
  WHERE status_code IN (401, 403)
    AND created BETWEEN NOW() - INTERVAL '5 minutes' AND NOW();

  IF v_failures > 0 THEN
    PERFORM public.emit_security_event(
      'retry_auth_failures_detected', NULL, NULL, 'critical',
      jsonb_build_object('failure_count', v_failures, 'window_minutes', 5)
    );
  END IF;

  -- Write directly to singleton so admin_get_dashboard picks it up via row_to_json
  UPDATE public.platform_health_metrics
  SET retry_auth_failures_5min = v_failures
  WHERE id = 1;

  RETURN v_failures;
EXCEPTION WHEN OTHERS THEN
  -- net schema may not be accessible in all environments; don't crash health checks
  RAISE LOG 'check_retry_auth_failures: net schema not accessible: %', SQLERRM;
  RETURN 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_retry_auth_failures() FROM PUBLIC;

-- ── TASK 3: Add retry_auth_failures_5min to platform_health_metrics ───────────

ALTER TABLE public.platform_health_metrics
  ADD COLUMN IF NOT EXISTS retry_auth_failures_5min INTEGER NOT NULL DEFAULT 0;

-- ── TASK 4: Alert config for retry auth failures ───────────────────────────────

-- alert_configs.metric_name is UNIQUE; guard with NOT EXISTS to make idempotent.
INSERT INTO public.alert_configs (metric_name, threshold, comparison, severity, enabled, cooldown_mins, created_by)
SELECT 'retry_auth_failures_5min', 1, 'gt', 'critical', TRUE, 15, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.alert_configs WHERE metric_name = 'retry_auth_failures_5min'
);

-- ── TASK 2 continued: pg_cron for retry auth monitoring (every 5 minutes) ─────

INSERT INTO cron.job (schedule, command, jobname, database, username, active)
VALUES (
  '*/5 * * * *',
  'SELECT public.check_retry_auth_failures();',
  'check_retry_auth_failures',
  'postgres',
  'postgres',
  TRUE
)
ON CONFLICT (jobname) DO NOTHING;
