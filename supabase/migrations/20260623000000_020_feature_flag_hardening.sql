-- ── 020 feature_flag_hardening ────────────────────────────────────────────────
-- S-12: Harden evaluate_flag and admin flag RPCs against:
-- - Forced rollout via client-supplied user_id in context JSONB
-- - Bulk enumeration via unbounded evaluate_flag calls
-- - Kill-switch toggled off immediately to use it as a DoS weapon
--
-- Also: admin flag RPCs were already authenticated-only; confirmed below.

-- ── Rate-limit table for evaluate_flag ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flag_eval_rate_limit (
  user_id      UUID        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,   -- date_trunc('minute', NOW())
  eval_count   INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.flag_eval_rate_limit ENABLE ROW LEVEL SECURITY;
-- Only service_role reads/writes; no direct client access
CREATE POLICY service_role_frl ON public.flag_eval_rate_limit
  TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX frl_user_window_idx ON public.flag_eval_rate_limit (user_id, window_start DESC);

-- ── Kill-switch cooldown column ───────────────────────────────────────────────

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS kill_switch_toggled_at TIMESTAMPTZ;

-- ── evaluate_flag: fix user_id sourcing + add rate limiting ──────────────────
-- BUG FIX: v_user_id was derived from client-supplied p_context->>'user_id'.
-- A caller could supply any UUID to land in a desired percentage bucket.
-- Fix: always derive user_id from auth.uid(); ignore the context field.
-- Callers may still pass country/city/postcode/is_prepper/app_version in context.

CREATE OR REPLACE FUNCTION public.evaluate_flag(
  p_key     TEXT,
  p_context JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag       public.feature_flags%ROWTYPE;
  -- user_id comes from the verified JWT, never from client context
  v_user_id    TEXT := auth.uid()::TEXT;
  v_is_prepper BOOLEAN := COALESCE((p_context ->> 'is_prepper')::BOOLEAN, FALSE);
  v_country    TEXT := p_context ->> 'country';
  v_city       TEXT := p_context ->> 'city';
  v_postcode   TEXT := p_context ->> 'postcode';
  v_version    TEXT := p_context ->> 'app_version';
  v_hash       INTEGER;
  v_window     TIMESTAMPTZ;
  v_rows       INTEGER;
  RATE_LIMIT   CONSTANT INTEGER := 500; -- max flag evals per minute per user
BEGIN
  -- Rate-limit authenticated callers only; anon returns FALSE immediately
  -- to avoid polluting the table and to deny unauthenticated enumeration.
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  v_window := date_trunc('minute', NOW());

  -- Upsert the rate-limit row and increment in one statement
  INSERT INTO public.flag_eval_rate_limit (user_id, window_start, eval_count)
  VALUES (auth.uid(), v_window, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET eval_count = flag_eval_rate_limit.eval_count + 1;

  -- Read back the count and reject if over limit
  SELECT eval_count INTO v_rows
  FROM public.flag_eval_rate_limit
  WHERE user_id = auth.uid() AND window_start = v_window;

  IF v_rows > RATE_LIMIT THEN
    PERFORM public.emit_security_event(
      'flag_eval_rate_limited', auth.uid(), NULL, 'warn',
      jsonb_build_object('flag_key', p_key, 'count', v_rows, 'window', v_window)
    );
    RAISE EXCEPTION 'flag_eval_rate_limited';
  END IF;

  -- ── Flag lookup ──────────────────────────────────────────────────────────────

  SELECT * INTO v_flag FROM public.feature_flags
  WHERE key = p_key AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_flag.kill_switch THEN RETURN FALSE; END IF;
  IF NOT v_flag.enabled THEN RETURN FALSE; END IF;
  IF v_flag.expires_at IS NOT NULL AND NOW() > v_flag.expires_at THEN RETURN FALSE; END IF;

  -- Explicit user exclusion
  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id
      AND target_type = 'user'
      AND target_value = v_user_id
      AND enabled = FALSE
  ) THEN RETURN FALSE; END IF;

  -- Explicit user inclusion
  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id
      AND target_type = 'user'
      AND target_value = v_user_id
      AND enabled = TRUE
  ) THEN RETURN TRUE; END IF;

  -- Prepper cohort
  IF v_is_prepper AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id AND target_type = 'prepper' AND enabled = TRUE
  ) THEN RETURN TRUE; END IF;

  -- Geographic (country → city exclusion → return)
  IF v_country IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id AND target_type = 'country'
      AND target_value = v_country AND enabled = TRUE
  ) THEN
    IF v_city IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.feature_flag_targets
      WHERE flag_id = v_flag.id AND target_type = 'city'
        AND target_value = v_city AND enabled = FALSE
    ) THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  IF v_city IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id AND target_type = 'city'
      AND target_value = v_city AND enabled = TRUE
  ) THEN RETURN TRUE; END IF;

  -- Percentage rollout: hash uses the JWT-derived user_id, not caller context
  IF v_flag.global_rollout_pct > 0 AND v_user_id IS NOT NULL THEN
    v_hash := ABS(HASHTEXT(v_user_id || ':' || p_key)) % 100;
    IF v_hash < v_flag.global_rollout_pct THEN RETURN TRUE; END IF;
  END IF;

  IF v_flag.global_rollout_pct = 100 THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;
-- Grant stays the same; anon is now rejected inside the function body
GRANT EXECUTE ON FUNCTION public.evaluate_flag(TEXT, JSONB) TO authenticated, anon;

-- ── admin_kill_flag: record toggled_at on activation ─────────────────────────

CREATE OR REPLACE FUNCTION public.admin_kill_flag(
  p_key    TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;

  UPDATE public.feature_flags SET
    kill_switch            = TRUE,
    enabled                = FALSE,
    kill_switch_toggled_at = NOW(),
    updated_by             = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'killed',
    jsonb_build_object('kill_switch', FALSE, 'enabled', v_flag.enabled),
    jsonb_build_object('kill_switch', TRUE,  'enabled', FALSE),
    p_reason
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_kill_flag(TEXT, TEXT) TO authenticated;

-- ── admin_toggle_flag: enforce 30s cooldown before lifting kill switch ────────

CREATE OR REPLACE FUNCTION public.admin_toggle_flag(
  p_key     TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;

  -- Cannot enable a kill-switched flag directly; call admin_unkill_flag first
  IF v_flag.kill_switch AND p_enabled THEN
    RAISE EXCEPTION 'flag_is_kill_switched';
  END IF;

  UPDATE public.feature_flags
  SET enabled = p_enabled, updated_by = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'toggled',
    jsonb_build_object('enabled', v_flag.enabled),
    jsonb_build_object('enabled', p_enabled),
    p_reason
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_flag(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ── admin_unkill_flag: lift kill switch with cooldown enforcement ─────────────
-- Separate RPC (replaces ad-hoc UPDATE) so the cooldown cannot be bypassed.
-- 30-second cooldown prevents toggling kill_switch as a rapid DoS mechanism.

CREATE OR REPLACE FUNCTION public.admin_unkill_flag(
  p_key    TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag public.feature_flags%ROWTYPE;
  COOLDOWN CONSTANT INTERVAL := INTERVAL '30 seconds';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  IF NOT v_flag.kill_switch THEN RAISE EXCEPTION 'flag_not_kill_switched'; END IF;

  -- Cooldown: kill_switch must have been on for at least 30s before we allow lift
  IF v_flag.kill_switch_toggled_at IS NOT NULL AND
     v_flag.kill_switch_toggled_at > NOW() - COOLDOWN THEN
    RAISE EXCEPTION 'kill_switch_cooldown: must wait 30 seconds before lifting';
  END IF;

  UPDATE public.feature_flags SET
    kill_switch            = FALSE,
    kill_switch_toggled_at = NULL,
    updated_by             = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'unkilled',
    jsonb_build_object('kill_switch', TRUE),
    jsonb_build_object('kill_switch', FALSE),
    p_reason
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unkill_flag(TEXT, TEXT) TO authenticated;
