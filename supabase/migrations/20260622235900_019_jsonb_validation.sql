-- ── 019 jsonb_validation ──────────────────────────────────────────────────────
-- S-11: JSONB injection prevention.
-- Validates size, depth, key count, and dangerous keys on JSONB columns that
-- accept caller-controlled input: domain_events.payload, notifications.data,
-- admin_action_log.metadata.

-- ── Depth validator ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_jsonb_depth(
  val       JSONB,
  max_depth INT,
  _cur      INT DEFAULT 0   -- internal recursion counter, not for callers
)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_child JSONB;
BEGIN
  -- NULL or scalar is never a depth concern
  IF val IS NULL OR jsonb_typeof(val) IN ('null', 'string', 'number', 'boolean') THEN
    RETURN TRUE;
  END IF;

  -- Already at limit → reject
  IF _cur >= max_depth THEN
    RETURN FALSE;
  END IF;

  IF jsonb_typeof(val) = 'object' THEN
    FOR v_child IN SELECT value FROM jsonb_each(val) LOOP
      IF NOT public.validate_jsonb_depth(v_child, max_depth, _cur + 1) THEN
        RETURN FALSE;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(val) = 'array' THEN
    FOR v_child IN SELECT value FROM jsonb_array_elements(val) LOOP
      IF NOT public.validate_jsonb_depth(v_child, max_depth, _cur + 1) THEN
        RETURN FALSE;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_jsonb_depth(JSONB, INT, INT) FROM PUBLIC;

-- ── Payload validator (utility callable by edge functions) ────────────────────

CREATE OR REPLACE FUNCTION public.validate_jsonb_payload(
  p_payload   JSONB,
  p_max_bytes INT DEFAULT 65536,
  p_max_depth INT DEFAULT 8,
  p_max_keys  INT DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- NULL payload is always valid (caller decides if nullable)
  IF p_payload IS NULL THEN
    RETURN;
  END IF;

  -- Size guard: octet_length works on TEXT and measures bytes, not characters
  IF octet_length(p_payload::TEXT) > p_max_bytes THEN
    RAISE EXCEPTION 'jsonb_payload_too_large: % bytes (max %)',
      octet_length(p_payload::TEXT), p_max_bytes;
  END IF;

  -- Depth guard (recursive)
  IF NOT public.validate_jsonb_depth(p_payload, p_max_depth) THEN
    RAISE EXCEPTION 'jsonb_too_deeply_nested: max depth % exceeded', p_max_depth;
  END IF;

  -- Top-level key count guard (arrays count elements as "keys")
  IF jsonb_typeof(p_payload) = 'object' AND
     (SELECT COUNT(*) FROM jsonb_object_keys(p_payload)) > p_max_keys THEN
    RAISE EXCEPTION 'jsonb_too_many_keys: max % keys exceeded', p_max_keys;
  END IF;

  -- Prototype-pollution key guard (top-level only — sufficient to block the attack)
  IF p_payload ? '__proto__' OR p_payload ? 'constructor' OR p_payload ? 'prototype' THEN
    RAISE EXCEPTION 'jsonb_dangerous_key: prototype-pollution key detected';
  END IF;
END;
$$;
-- Internal helpers stay revoked; this one is the public surface for edge functions
REVOKE EXECUTE ON FUNCTION public.validate_jsonb_payload(JSONB, INT, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_jsonb_payload(JSONB, INT, INT, INT) TO service_role, authenticated;

-- ── Trigger: domain_events.payload ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_domain_event_payload()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 64KB, depth 8, 100 keys — generous enough for legitimate events
  PERFORM public.validate_jsonb_payload(NEW.payload, 65536, 8, 100);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_domain_event_payload() FROM PUBLIC;

CREATE TRIGGER domain_events_validate_payload
  BEFORE INSERT ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.check_domain_event_payload();

-- ── Trigger: notifications.data ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_notification_data()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Stricter: 16KB, depth 5, 50 keys — notifications are thin UI payloads
  PERFORM public.validate_jsonb_payload(NEW.data, 16384, 5, 50);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_notification_data() FROM PUBLIC;

CREATE TRIGGER notifications_validate_data
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.check_notification_data();

-- ── CHECK constraint: admin_action_log.metadata ───────────────────────────────
-- Append-only table: CHECK is the right mechanism (no trigger needed).
-- Wrap in DO block to make the migration idempotent.

DO $$
BEGIN
  ALTER TABLE public.admin_action_log
    ADD CONSTRAINT metadata_size_check
    CHECK (octet_length(metadata::TEXT) <= 65536);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
