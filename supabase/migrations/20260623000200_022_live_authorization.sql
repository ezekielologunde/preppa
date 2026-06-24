-- ── 022 live_authorization ────────────────────────────────────────────────────
-- Replaces JWT-only is_admin() with a dual-check: JWT is advisory, DB is
-- authoritative. A revoked admin is denied on the very next RPC call.
--
-- Fixes: F-01 (60-minute revocation window) + F-05 (missing user_roles table
-- referenced by stripe-refund edge function).

-- ── STEP 1: Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin','support','moderator','finance','operations','security')),
  granted_by  UUID NOT NULL REFERENCES auth.users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  revoked_by  UUID REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ,
  -- one active grant record per user+role; revocation sets revoked_at rather than deleting
  UNIQUE (user_id, role)
);

CREATE INDEX user_roles_user_idx   ON public.user_roles (user_id) WHERE revoked_at IS NULL;
CREATE INDEX user_roles_active_idx ON public.user_roles (role, user_id) WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

CREATE TABLE public.role_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  role         TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('granted','revoked','expired','suspended')),
  performed_by UUID,
  reason       TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX role_audit_user_idx    ON public.role_audit (user_id, created_at DESC);
CREATE INDEX role_audit_action_idx  ON public.role_audit (action, created_at DESC);

-- ── RLS: user_roles ───────────────────────────────────────────────────────────

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see their own active roles (e.g. for client-side UI decisions)
CREATE POLICY user_roles_own_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all roles. We must call the DB-check variant here to avoid
-- a bootstrap chicken-and-egg: use a direct subquery rather than is_admin()
-- so the policy doesn't recurse infinitely.
CREATE POLICY user_roles_admin_read ON public.user_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.revoked_at IS NULL
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  );

-- No direct client INSERT/UPDATE/DELETE — all mutations go through RPCs
CREATE POLICY user_roles_no_direct_write ON public.user_roles FOR INSERT TO authenticated WITH CHECK (FALSE);

-- service_role bypass for migrations and bootstrap
CREATE POLICY user_roles_service_role ON public.user_roles TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── RLS: role_audit ───────────────────────────────────────────────────────────

ALTER TABLE public.role_audit ENABLE ROW LEVEL SECURITY;

-- Append-only: no UPDATE or DELETE (enforced by trigger below)
-- Admins can read; no direct client writes
CREATE POLICY role_audit_admin_read ON public.role_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.revoked_at IS NULL
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  );

CREATE POLICY role_audit_no_client_write ON public.role_audit FOR INSERT TO authenticated WITH CHECK (FALSE);
CREATE POLICY role_audit_service_role ON public.role_audit TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Reuse block_audit_mutation from migration 016 — append-only enforcement
CREATE TRIGGER role_audit_no_mutation
  BEFORE UPDATE OR DELETE ON public.role_audit
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- ── STEP 2: is_admin() redesign ───────────────────────────────────────────────

-- Drop the JWT-only version from migration 010
DROP FUNCTION IF EXISTS public.is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_jwt_claim TEXT;
  v_db_role   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  -- JWT claim is advisory: read first for the security-event comparison below
  v_jwt_claim := auth.jwt() -> 'app_metadata' ->> 'role';

  -- DB is always authoritative
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id  = v_uid
      AND role     = 'admin'
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_db_role;

  IF NOT v_db_role THEN
    -- JWT said admin but DB denied: this is the revocation-enforcement signal
    IF v_jwt_claim = 'admin' THEN
      PERFORM public.emit_security_event(
        'admin_jwt_claim_denied_by_db', v_uid, NULL, 'critical',
        jsonb_build_object('jwt_claim', v_jwt_claim, 'db_authorized', false)
      );
    END IF;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── is_role(): generic role check for support/finance/moderator etc. ──────────

CREATE OR REPLACE FUNCTION public.is_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_jwt_claim TEXT;
  v_db_role   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  v_jwt_claim := auth.jwt() -> 'app_metadata' ->> 'role';

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id  = v_uid
      AND role     = p_role
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_db_role;

  IF NOT v_db_role THEN
    -- Any role claim in the JWT that the DB denies is worth logging
    IF v_jwt_claim = p_role THEN
      PERFORM public.emit_security_event(
        'role_jwt_claim_denied_by_db', v_uid, NULL, 'warn',
        jsonb_build_object('jwt_claim', v_jwt_claim, 'requested_role', p_role, 'db_authorized', false)
      );
    END IF;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_role(TEXT) TO authenticated;

-- ── STEP 3: Role management RPCs ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_grant_role(
  p_user_id   UUID,
  p_role      TEXT,
  p_reason    TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID   -- returns role_audit.id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  VALID_ROLES CONSTANT TEXT[] := ARRAY['admin','support','moderator','finance','operations','security'];
  v_audit_id  UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  IF p_role <> ALL(VALID_ROLES) THEN
    RAISE EXCEPTION 'invalid_role: % — must be one of %', p_role, array_to_string(VALID_ROLES, ', ');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  -- Upsert: if a revoked row exists for this user+role, reactivate it
  INSERT INTO public.user_roles (user_id, role, granted_by, granted_at, revoked_at, revoked_by, expires_at)
  VALUES (p_user_id, p_role, auth.uid(), NOW(), NULL, NULL, p_expires_at)
  ON CONFLICT (user_id, role) DO UPDATE SET
    granted_by  = auth.uid(),
    granted_at  = NOW(),
    revoked_at  = NULL,
    revoked_by  = NULL,
    expires_at  = p_expires_at;

  INSERT INTO public.role_audit (user_id, role, action, performed_by, reason, metadata)
  VALUES (p_user_id, p_role, 'granted', auth.uid(), p_reason,
          jsonb_build_object('expires_at', p_expires_at, 'granted_by', auth.uid()))
  RETURNING id INTO v_audit_id;

  -- Domain event for downstream projectors (e.g. admin dashboard)
  INSERT INTO public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
  VALUES ('role.granted', 'user', p_user_id, auth.uid(),
          jsonb_build_object('role', p_role, 'reason', p_reason, 'expires_at', p_expires_at, 'audit_id', v_audit_id),
          1);

  PERFORM public.emit_security_event(
    'role_granted', auth.uid(), p_user_id, 'warn',
    jsonb_build_object('role', p_role, 'reason', p_reason, 'target_user', p_user_id)
  );

  PERFORM public._admin_record(
    'grant_role', 'user', p_user_id, p_reason,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at),
    TRUE, NULL  -- reversible: yes; no separate domain event (emitted above)
  );

  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_role(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_grant_role(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ── admin_revoke_role ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  p_user_id UUID,
  p_role    TEXT,
  p_reason  TEXT
)
RETURNS UUID   -- returns role_audit.id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_audit_id UUID;
  v_rows     INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  UPDATE public.user_roles SET
    revoked_at = NOW(),
    revoked_by = auth.uid()
  WHERE user_id   = p_user_id
    AND role      = p_role
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'role_not_active: user % does not hold active role %', p_user_id, p_role;
  END IF;

  INSERT INTO public.role_audit (user_id, role, action, performed_by, reason, metadata)
  VALUES (p_user_id, p_role, 'revoked', auth.uid(), p_reason,
          jsonb_build_object('revoked_by', auth.uid()))
  RETURNING id INTO v_audit_id;

  INSERT INTO public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
  VALUES ('role.revoked', 'user', p_user_id, auth.uid(),
          jsonb_build_object('role', p_role, 'reason', p_reason, 'audit_id', v_audit_id),
          1);

  -- Revocation is a high-signal event — log as critical
  PERFORM public.emit_security_event(
    'role_revoked', auth.uid(), p_user_id, 'critical',
    jsonb_build_object('role', p_role, 'reason', p_reason, 'target_user', p_user_id)
  );

  PERFORM public._admin_record(
    'revoke_role', 'user', p_user_id, p_reason,
    jsonb_build_object('role', p_role, 'revoked_by', auth.uid()),
    FALSE, NULL
  );

  RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_role(UUID, TEXT, TEXT) TO authenticated;

-- ── STEP 4: Bootstrap notice ───────────────────────────────────────────────────
-- JWT-only is_admin() is now replaced. Existing admins have no user_roles row
-- yet and will be denied until seeded. Operators must run:
--
--   SELECT admin_grant_role('<uuid>', 'admin', 'bootstrap');
--
-- for each existing admin user before deploying. The caller of that RPC must
-- themselves have a user_roles admin row, so the very first seed must be done
-- via service_role (Supabase dashboard SQL editor or admin API) by directly
-- INSERTing into user_roles:
--
--   INSERT INTO public.user_roles (user_id, role, granted_by)
--   VALUES ('<first-admin-uuid>', 'admin', '<first-admin-uuid>');
--
-- Subsequent admins can then be granted via admin_grant_role().

DO $$
BEGIN
  RAISE LOG 'sprint22_authz_bootstrap: is_admin() is now DB-authoritative. '
    'Seed admin rows in user_roles before this migration goes live. '
    'See docs/sprint22/01-authz-root-cause.md for the bootstrap procedure.';
END $$;
