-- ── 017 notification_hardening ────────────────────────────────────────────────
-- S-8: Bulk Notification Abuse hardening.
-- Closes: mass spam, duplicate replay, large payload, priority abuse,
--         trigger cascade amplification, global platform storm.

-- ── Rate-tracking tables ──────────────────────────────────────────────────────

-- Per-sender hourly window counters (all senders: service role + admin)
CREATE TABLE public.notification_send_log (
  sender_id    UUID NOT NULL,               -- auth.uid() or a stable service UUID
  window_start TIMESTAMPTZ NOT NULL,        -- date_trunc('hour', NOW())
  sent_count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sender_id, window_start)
);

ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own window (for self-service rate dashboards); no direct insert
CREATE POLICY notif_log_own_read ON public.notification_send_log FOR SELECT TO authenticated
  USING (sender_id = auth.uid());
CREATE POLICY notif_log_admin_read ON public.notification_send_log FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY notif_log_service ON public.notification_send_log TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Dedup table: prevents the same message reaching the same user within 5 minutes
CREATE TABLE public.notification_dedup (
  user_id    UUID NOT NULL,
  dedup_key  TEXT NOT NULL,                 -- MD5(type || ':' || title || ':' || LEFT(body,200))
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, dedup_key)
);

ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;

-- No direct client access; only service_role writes via safe_send_notification
CREATE POLICY notif_dedup_service ON public.notification_dedup TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Global storm counter: singleton row, id=1
CREATE TABLE public.platform_notification_counters (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  current_minute_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
  current_minute_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT singleton_notif_counter CHECK (id = 1)
);

INSERT INTO public.platform_notification_counters (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_notification_counters ENABLE ROW LEVEL SECURITY;

-- Admins can inspect the counter; no client writes
CREATE POLICY notif_counter_admin ON public.platform_notification_counters FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY notif_counter_service ON public.platform_notification_counters TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX notif_send_log_sender_idx ON public.notification_send_log (sender_id, window_start DESC);
CREATE INDEX notif_dedup_expires_idx   ON public.notification_dedup (expires_at);

-- ── safe_send_notification ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.safe_send_notification(
  p_user_id  UUID,
  p_type     TEXT,
  p_title    TEXT,
  p_body     TEXT,
  p_data     JSONB DEFAULT '{}',
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dedup_key      TEXT;
  v_window         TIMESTAMPTZ := date_trunc('hour', NOW());
  v_minute_now     TIMESTAMPTZ := date_trunc('minute', NOW());
  v_rate_cap       INTEGER;
  v_rows           INTEGER;
  v_notif_id       UUID;
  GLOBAL_STORM_CAP CONSTANT INTEGER := 10000;
BEGIN
  -- ── 1. Payload size guard (16 KB hard cap) ────────────────────────────────
  IF octet_length(p_data::TEXT) > 16384 THEN
    RAISE EXCEPTION 'notification_payload_too_large: max 16384 bytes, got %',
      octet_length(p_data::TEXT);
  END IF;

  -- ── 2. Priority escalation guard ─────────────────────────────────────────
  -- Only the database service_role may send urgent notifications.
  -- authenticated callers (including admin RPC) use 'high' at most.
  IF p_priority = 'urgent' AND current_role <> 'service_role' THEN
    RAISE EXCEPTION 'priority_escalation_denied: urgent priority requires service_role';
  END IF;

  -- ── 3. Dedup check: skip if same message within 5 minutes ────────────────
  v_dedup_key := md5(p_type || ':' || p_title || ':' || LEFT(p_body, 200));

  INSERT INTO public.notification_dedup (user_id, dedup_key, expires_at)
  VALUES (p_user_id, v_dedup_key, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (user_id, dedup_key) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  -- Conflict = duplicate within window → silently skip
  IF v_rows = 0 THEN
    RETURN NULL;
  END IF;

  -- ── 4. Per-sender hourly rate limit ──────────────────────────────────────
  -- service_role has a higher cap since it drives automated workflows
  v_rate_cap := CASE current_role WHEN 'service_role' THEN 200 ELSE 50 END;

  INSERT INTO public.notification_send_log (sender_id, window_start, sent_count)
  VALUES (auth.uid(), v_window, 1)
  ON CONFLICT (sender_id, window_start) DO UPDATE
    SET sent_count = notification_send_log.sent_count + 1
    WHERE notification_send_log.sent_count < v_rate_cap;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- The WHERE guard blocked the increment — sender is over cap
    PERFORM public.emit_security_event(
      'notification_sender_rate_exceeded', auth.uid(), p_user_id, 'warn',
      jsonb_build_object('cap', v_rate_cap, 'window', v_window)
    );
    RETURN NULL;
  END IF;

  -- ── 5. Global platform storm guard ───────────────────────────────────────
  -- Roll the minute window if it has expired, then increment
  UPDATE public.platform_notification_counters SET
    current_minute_start = CASE
      WHEN current_minute_start < v_minute_now THEN v_minute_now
      ELSE current_minute_start
    END,
    current_minute_count = CASE
      WHEN current_minute_start < v_minute_now THEN 1
      ELSE current_minute_count + 1
    END
  WHERE id = 1;

  -- Re-read the current count to check against cap
  PERFORM 1 FROM public.platform_notification_counters
  WHERE id = 1 AND current_minute_count <= GLOBAL_STORM_CAP;

  IF NOT FOUND THEN
    PERFORM public.emit_security_event(
      'notification_global_storm', auth.uid(), NULL, 'critical',
      jsonb_build_object('cap', GLOBAL_STORM_CAP, 'minute', v_minute_now)
    );
    RETURN NULL;
  END IF;

  -- ── 6. Insert notification ────────────────────────────────────────────────
  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  VALUES (
    p_user_id,
    p_type::public.notification_type,
    p_title,
    p_body,
    p_data,
    p_priority
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- Only service_role may call safe_send_notification directly.
-- admin_bulk_notify (authenticated) calls it via SECURITY DEFINER elevation.
REVOKE EXECUTE ON FUNCTION public.safe_send_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_send_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT)
  TO service_role;

-- ── admin_bulk_notify ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_bulk_notify(
  p_user_ids UUID[],
  p_type     TEXT,
  p_title    TEXT,
  p_body     TEXT,
  p_data     JSONB DEFAULT '{}',
  p_reason   TEXT DEFAULT 'admin_bulk_notify'
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window      TIMESTAMPTZ := date_trunc('hour', NOW());
  v_sent        INTEGER := 0;
  v_sent_this_hour INTEGER;
  v_uid         UUID;
  v_result      UUID;
  BULK_CAP      CONSTANT INTEGER := 1000;   -- max recipients per call
  ADMIN_HOUR_CAP CONSTANT INTEGER := 5000;  -- max per admin per hour
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- ── Hard recipient cap per call ───────────────────────────────────────────
  IF cardinality(p_user_ids) > BULK_CAP THEN
    RAISE EXCEPTION 'bulk_notify_cap_exceeded: max % recipients per call, got %',
      BULK_CAP, cardinality(p_user_ids);
  END IF;

  -- ── Admin hourly global bulk cap ──────────────────────────────────────────
  -- Read current window total for this admin before sending
  SELECT COALESCE(sent_count, 0)
  INTO v_sent_this_hour
  FROM public.notification_send_log
  WHERE sender_id = auth.uid() AND window_start = v_window;

  IF COALESCE(v_sent_this_hour, 0) >= ADMIN_HOUR_CAP THEN
    PERFORM public.emit_security_event(
      'admin_bulk_notify_hour_cap', auth.uid(), NULL, 'critical',
      jsonb_build_object('cap', ADMIN_HOUR_CAP, 'window', v_window)
    );
    RAISE EXCEPTION 'admin_bulk_notify_hour_cap_exceeded: max % per hour', ADMIN_HOUR_CAP;
  END IF;

  -- ── Send to each recipient (dedup inside safe_send_notification) ──────────
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    -- Temporarily elevate: safe_send_notification is service_role-only,
    -- but we are SECURITY DEFINER so we execute as the function owner (postgres).
    -- We pass auth.uid() as the sender for rate-limit tracking via notification_send_log.
    SELECT public.safe_send_notification(v_uid, p_type, p_title, p_body, p_data, 'normal')
    INTO v_result;

    IF v_result IS NOT NULL THEN
      v_sent := v_sent + 1;
    END IF;
  END LOOP;

  -- ── Write audit trail ─────────────────────────────────────────────────────
  PERFORM public._admin_record(
    'bulk_notify',
    'user',
    NULL,
    p_reason,
    jsonb_build_object(
      'type',            p_type,
      'title',           p_title,
      'recipient_count', cardinality(p_user_ids),
      'sent_count',      v_sent
    ),
    FALSE,
    'notification.bulk_sent'
  );

  RETURN v_sent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_notify(UUID[], TEXT, TEXT, TEXT, JSONB, TEXT)
  TO authenticated;
