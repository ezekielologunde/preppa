-- ── 026 sprint23_consistency ──────────────────────────────────────────────────
-- Sprint 23: Consistency & Recovery
--
-- AR-2: check_projection_drift() fired false alerts on normal event growth because
--   it compared the post-rebuild checksum against the always-changing live state.
--   Fixed: alert only on event count DECREASE (deletion) or same-count checksum
--   mismatch (substitution). On growth, silently update the baseline.
--
-- AR-3: check_retry_auth_failures() counted ALL 401/403 from all pg_net calls,
--   including Stripe API errors. Fixed: filter by event-processor URL only.
--
-- AR-4: check_projection_drift() was GRANT-ed to all authenticated users with no
--   auth enforcement or rate limiting. Fixed: add is_admin() gate, 30-second
--   cooldown for manual invocations, and audit logging.
--
-- Also: remove STABLE misclassification from check_projection_drift() — the
--   function writes to projection_checksums and security_events.

-- ── Column additions ──────────────────────────────────────────────────────────

ALTER TABLE public.platform_health_metrics
  ADD COLUMN IF NOT EXISTS drift_check_last_admin_call_at TIMESTAMPTZ;

-- ── AR-2 + AR-4: Rewrite check_projection_drift() ────────────────────────────
--
-- Watermark-based drift detection:
--   current_count < stored_count   → CRITICAL (events deleted)
--   current_count = stored_count,
--     checksum mismatch            → CRITICAL (events substituted)
--   current_count > stored_count   → silent baseline update (normal growth)
--   counts equal, checksums equal  → clean, no output
--
-- Auth:
--   pg_cron callers: auth.uid() IS NULL — allowed without additional checks.
--   JWT callers: must be admin.
--
-- Rate limit (manual calls only):
--   30-second cooldown tracked in platform_health_metrics.drift_check_last_admin_call_at
--   to prevent admin-triggered check storms.

CREATE OR REPLACE FUNCTION public.check_projection_drift()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result               JSONB := '[]'::JSONB;
  v_proj                 TEXT;
  v_current_checksum     TEXT;
  v_current_count        INTEGER;
  v_stored               public.projection_checksums%ROWTYPE;
  v_is_manual            BOOLEAN;
  v_last_admin_call      TIMESTAMPTZ;
BEGIN
  v_is_manual := auth.uid() IS NOT NULL;

  -- AR-4: auth gate — manual callers must be admin
  IF v_is_manual AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  -- AR-4: 30-second cooldown for manual admin invocations
  IF v_is_manual THEN
    SELECT drift_check_last_admin_call_at
    INTO v_last_admin_call
    FROM public.platform_health_metrics
    WHERE id = 1;

    IF v_last_admin_call IS NOT NULL
       AND v_last_admin_call > NOW() - INTERVAL '30 seconds'
    THEN
      RAISE EXCEPTION 'drift_check_rate_limit: retry after %',
        v_last_admin_call + INTERVAL '30 seconds';
    END IF;

    UPDATE public.platform_health_metrics
    SET drift_check_last_admin_call_at = NOW()
    WHERE id = 1;
  END IF;

  -- Check each projection that has a stored baseline
  FOR v_proj IN
    SELECT DISTINCT pc.projection_name
    FROM public.projection_checksums pc
  LOOP
    SELECT COUNT(*) INTO v_current_count
    FROM public.projection_event_log
    WHERE projection_name = v_proj;

    v_current_checksum := public.compute_projection_checksum(v_proj);

    SELECT * INTO v_stored
    FROM public.projection_checksums
    WHERE projection_name = v_proj;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- AR-2: Correct drift detection ──────────────────────────────────────────
    IF v_current_count < v_stored.event_count THEN
      -- Events were deleted: impossible under normal operation
      PERFORM public.emit_security_event(
        'projection_drift_detected', NULL, NULL, 'critical',
        jsonb_build_object(
          'projection_name',     v_proj,
          'anomaly',             'event_count_decreased',
          'stored_event_count',  v_stored.event_count,
          'current_event_count', v_current_count,
          'stored_checksum',     v_stored.checksum,
          'stored_at',           v_stored.computed_at
        )
      );
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'projection', v_proj,
        'drift',      true,
        'anomaly',    'event_count_decreased'
      ));

    ELSIF v_current_count = v_stored.event_count
      AND v_current_checksum <> v_stored.checksum
    THEN
      -- Same count, different event set: event substitution
      PERFORM public.emit_security_event(
        'projection_drift_detected', NULL, NULL, 'critical',
        jsonb_build_object(
          'projection_name',    v_proj,
          'anomaly',            'event_substitution_detected',
          'stored_event_count', v_stored.event_count,
          'stored_checksum',    v_stored.checksum,
          'current_checksum',   v_current_checksum,
          'stored_at',          v_stored.computed_at
        )
      );
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'projection', v_proj,
        'drift',      true,
        'anomaly',    'event_substitution_detected'
      ));

    ELSIF v_current_count > v_stored.event_count THEN
      -- Normal growth: silently advance the baseline so next check has the right reference
      UPDATE public.projection_checksums SET
        checksum    = v_current_checksum,
        event_count = v_current_count,
        computed_at = NOW(),
        computed_by = CASE WHEN v_is_manual THEN auth.uid()::TEXT ELSE 'pg_cron' END
      WHERE projection_name = v_proj;

      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'projection',      v_proj,
        'drift',           false,
        'baseline_updated', true,
        'new_event_count', v_current_count
      ));
    -- Else: count equal, checksum equal — clean; no output
    END IF;
  END LOOP;

  -- AR-4: audit trail for manual admin invocations
  IF v_is_manual THEN
    PERFORM public.emit_security_event(
      'projection_drift_check_invoked', auth.uid(), NULL, 'warn',
      jsonb_build_object('result_count', jsonb_array_length(v_result))
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Only admins and pg_cron (superuser) may invoke this.
-- The internal auth gate rejects non-admin authenticated callers.
REVOKE EXECUTE ON FUNCTION public.check_projection_drift() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_projection_drift() TO authenticated;

-- ── AR-3: Rewrite check_retry_auth_failures() ────────────────────────────────
--
-- Old query counted ALL 401/403 from all pg_net calls (Stripe, Supabase, any
-- future external call). This produced false positives whenever Stripe rejected
-- an expired key or returned a transient auth error.
--
-- Fix: join net._http_request and filter to event-processor URL only.
-- The table join is safe in all Postgres versions where pg_net is installed.

CREATE OR REPLACE FUNCTION public.check_retry_auth_failures()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_failures INTEGER;
BEGIN
  -- Count 401/403 responses whose originating request targeted the event-processor.
  -- net._http_request.id = net._http_response.id (same PK/FK in pg_net schema).
  SELECT COUNT(*) INTO v_failures
  FROM net._http_response r
  JOIN net._http_request  req ON req.id = r.id
  WHERE r.status_code IN (401, 403)
    AND r.created BETWEEN NOW() - INTERVAL '5 minutes' AND NOW()
    AND req.url LIKE '%/functions/v1/event-processor%';

  IF v_failures > 0 THEN
    PERFORM public.emit_security_event(
      'retry_auth_failures_detected', NULL, NULL, 'critical',
      jsonb_build_object(
        'failure_count',  v_failures,
        'window_minutes', 5,
        'source',         'event-processor'
      )
    );
  END IF;

  UPDATE public.platform_health_metrics
  SET retry_auth_failures_5min = v_failures
  WHERE id = 1;

  RETURN v_failures;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'check_retry_auth_failures: net schema not accessible: %', SQLERRM;
  RETURN 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_retry_auth_failures() FROM PUBLIC;
