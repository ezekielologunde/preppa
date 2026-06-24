-- ── 011 feature_flags ─────────────────────────────────────────────────────────
-- Server-side feature flag service. Clients NEVER receive flag internals.
-- evaluate_flag() is the ONLY function clients may call — it returns BOOLEAN.
-- Flag targeting is evaluated entirely within the DB; no client-side logic.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.feature_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               TEXT NOT NULL UNIQUE,          -- e.g. 'new_search_ui'
  name              TEXT NOT NULL,
  description       TEXT,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE, -- global on/off
  global_rollout_pct INTEGER NOT NULL DEFAULT 0     -- 0–100; 100 = full rollout
    CHECK (global_rollout_pct BETWEEN 0 AND 100),
  min_app_version   TEXT,                           -- semver: '2.1.0'
  expires_at        TIMESTAMPTZ,                    -- NULL = no expiry
  kill_switch       BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = force-disabled for all
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at        TIMESTAMPTZ                     -- soft delete
);

-- Targeting rules: enable/disable flag for specific users, preppers, regions
CREATE TABLE public.feature_flag_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id      UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN (
    'user', 'prepper', 'country', 'city', 'postcode',
    'user_cohort', 'prepper_cohort'
  )),
  target_value TEXT NOT NULL,   -- user UUID, 'GB', 'London', 'EC1', cohort key
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = explicitly exclude
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- Immutable audit trail for every flag change
CREATE TABLE public.feature_flag_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id      UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  admin_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action       TEXT NOT NULL,    -- 'created','toggled','rollout_changed','killed','target_added','target_removed'
  before_state JSONB,
  after_state  JSONB NOT NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX ff_key_idx         ON public.feature_flags (key) WHERE deleted_at IS NULL;
CREATE INDEX ff_enabled_idx     ON public.feature_flags (enabled) WHERE kill_switch = FALSE;
CREATE INDEX ff_expires_idx     ON public.feature_flags (expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX fft_flag_idx       ON public.feature_flag_targets (flag_id, target_type);
CREATE INDEX fft_user_idx       ON public.feature_flag_targets (target_type, target_value)
  WHERE target_type IN ('user', 'prepper');

CREATE INDEX ffa_flag_idx       ON public.feature_flag_audit (flag_id, created_at DESC);
CREATE INDEX ffa_admin_idx      ON public.feature_flag_audit (admin_id, created_at DESC);

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.feature_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_audit  ENABLE ROW LEVEL SECURITY;

-- Clients NEVER see flag configuration — only the evaluate_flag() result
CREATE POLICY admin_read_flags   ON public.feature_flags FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY admin_write_flags  ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_flags ON public.feature_flags TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_flag_targets ON public.feature_flag_targets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY service_role_fft   ON public.feature_flag_targets TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY admin_flag_audit   ON public.feature_flag_audit FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY service_role_ffa   ON public.feature_flag_audit TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Functions ─────────────────────────────────────────────────────────────────

-- Internal: write flag audit entry
CREATE OR REPLACE FUNCTION public._ff_audit(
  p_flag_id     UUID,
  p_action      TEXT,
  p_before      JSONB,
  p_after       JSONB,
  p_reason      TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.feature_flag_audit
    (flag_id, admin_id, action, before_state, after_state, reason)
  VALUES (p_flag_id, auth.uid(), p_action, p_before, p_after, p_reason);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._ff_audit(UUID, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;

-- Server-side flag evaluation — the ONLY function clients may call.
-- Returns FALSE for any error, expired, kill-switched, or unknown flag.
CREATE OR REPLACE FUNCTION public.evaluate_flag(
  p_key        TEXT,
  p_context    JSONB DEFAULT '{}'   -- {user_id, is_prepper, country, city, postcode, app_version}
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag       public.feature_flags%ROWTYPE;
  v_user_id    TEXT := p_context ->> 'user_id';
  v_is_prepper BOOLEAN := COALESCE((p_context ->> 'is_prepper')::BOOLEAN, FALSE);
  v_country    TEXT := p_context ->> 'country';
  v_city       TEXT := p_context ->> 'city';
  v_postcode   TEXT := p_context ->> 'postcode';
  v_version    TEXT := p_context ->> 'app_version';
  v_hash       INTEGER;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags
  WHERE key = p_key AND deleted_at IS NULL;

  -- Unknown flag → false (fail-closed)
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Kill switch overrides everything
  IF v_flag.kill_switch THEN RETURN FALSE; END IF;

  -- Globally disabled
  IF NOT v_flag.enabled THEN RETURN FALSE; END IF;

  -- Expired
  IF v_flag.expires_at IS NOT NULL AND NOW() > v_flag.expires_at THEN RETURN FALSE; END IF;

  -- Explicit user exclusion (target_type='user', enabled=FALSE) takes priority
  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id
      AND target_type = 'user'
      AND target_value = v_user_id
      AND enabled = FALSE
  ) THEN RETURN FALSE; END IF;

  -- Explicit user inclusion (target_type='user', enabled=TRUE)
  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id
      AND target_type = 'user'
      AND target_value = v_user_id
      AND enabled = TRUE
  ) THEN RETURN TRUE; END IF;

  -- Prepper cohort targeting
  IF v_is_prepper AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id AND target_type = 'prepper' AND enabled = TRUE
  ) THEN RETURN TRUE; END IF;

  -- Geographic targeting (country → city → postcode hierarchy)
  IF v_country IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feature_flag_targets
    WHERE flag_id = v_flag.id AND target_type = 'country'
      AND target_value = v_country AND enabled = TRUE
  ) THEN
    -- Check for city exclusion within included country
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

  -- Percentage rollout: deterministic hash of user_id + flag_key
  IF v_flag.global_rollout_pct > 0 AND v_user_id IS NOT NULL THEN
    v_hash := ABS(HASHTEXT(v_user_id || ':' || p_key)) % 100;
    IF v_hash < v_flag.global_rollout_pct THEN RETURN TRUE; END IF;
  END IF;

  -- Full global rollout (100%) without specific user context
  IF v_flag.global_rollout_pct = 100 THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.evaluate_flag(TEXT, JSONB) TO authenticated, anon;

-- Admin RPCs for managing flags

CREATE OR REPLACE FUNCTION public.admin_create_flag(
  p_key         TEXT,
  p_name        TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flag_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  INSERT INTO public.feature_flags (key, name, description, created_by, updated_by)
  VALUES (p_key, p_name, p_description, auth.uid(), auth.uid())
  RETURNING id INTO v_flag_id;

  PERFORM public._ff_audit(
    v_flag_id, 'created', NULL,
    jsonb_build_object('key', p_key, 'name', p_name, 'enabled', FALSE),
    'initial creation'
  );

  RETURN v_flag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_flag(
  p_key     TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag   public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;
  IF v_flag.kill_switch AND p_enabled THEN RAISE EXCEPTION 'flag_is_kill_switched'; END IF;

  UPDATE public.feature_flags SET enabled = p_enabled, updated_by = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'toggled',
    jsonb_build_object('enabled', v_flag.enabled),
    jsonb_build_object('enabled', p_enabled),
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_rollout(
  p_key     TEXT,
  p_pct     INTEGER,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_pct NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'pct_out_of_range'; END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;

  UPDATE public.feature_flags SET global_rollout_pct = p_pct, updated_by = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'rollout_changed',
    jsonb_build_object('global_rollout_pct', v_flag.global_rollout_pct),
    jsonb_build_object('global_rollout_pct', p_pct),
    p_reason
  );
END;
$$;

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
    kill_switch = TRUE,
    enabled     = FALSE,
    updated_by  = auth.uid()
  WHERE id = v_flag.id;

  PERFORM public._ff_audit(
    v_flag.id, 'killed',
    jsonb_build_object('kill_switch', FALSE, 'enabled', v_flag.enabled),
    jsonb_build_object('kill_switch', TRUE, 'enabled', FALSE),
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_flag_target(
  p_key          TEXT,
  p_target_type  TEXT,
  p_target_value TEXT,
  p_enabled      BOOLEAN DEFAULT TRUE,
  p_reason       TEXT DEFAULT 'targeting'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flag_id  UUID;
  v_target_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT id INTO v_flag_id FROM public.feature_flags WHERE key = p_key AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'flag_not_found'; END IF;

  INSERT INTO public.feature_flag_targets (flag_id, target_type, target_value, enabled, created_by)
  VALUES (v_flag_id, p_target_type, p_target_value, p_enabled, auth.uid())
  RETURNING id INTO v_target_id;

  PERFORM public._ff_audit(
    v_flag_id,
    CASE WHEN p_enabled THEN 'target_included' ELSE 'target_excluded' END,
    NULL,
    jsonb_build_object('target_type', p_target_type, 'target_value', p_target_value, 'enabled', p_enabled),
    p_reason
  );

  RETURN v_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_flag(TEXT, TEXT, TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_flag(TEXT, BOOLEAN, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rollout(TEXT, INTEGER, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kill_flag(TEXT, TEXT)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_flag_target(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
