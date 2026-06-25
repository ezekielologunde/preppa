-- ── 032 admin_tier_db_authoritative ───────────────────────────────────────────
-- Sprint 30 red-team fix (HIGH): admin_tier() read only the JWT tier claim.
-- A demoted admin kept a valid tier-2 JWT for up to the token TTL (~60 min),
-- so require_admin_tier(n) gates could still pass after demotion.
--
-- This mirrors the is_admin() redesign from migration 022: the JWT becomes
-- advisory; the user_roles table is authoritative. A revoked/expired admin
-- loses tier on the very next RPC call, closing the revocation window.
--
-- Tier source of truth:
--   1. Must have an active 'admin' grant in user_roles (not revoked, not expired)
--   2. Tier value still comes from the JWT app_metadata.tier claim (set by
--      admin_elevate_user). If the grant is active but the JWT lacks a tier,
--      default to Tier 1 (Support) — least privilege.
--   3. No active grant → NULL (not an admin), regardless of JWT contents.

CREATE OR REPLACE FUNCTION public.admin_tier()
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_has_grant BOOLEAN;
  v_jwt_tier  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- DB is authoritative: an active, unrevoked, unexpired admin grant must exist.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role = 'admin'
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_has_grant;

  IF NOT v_has_grant THEN
    -- If the JWT still asserts admin but the DB disagrees, log the mismatch.
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
      BEGIN
        PERFORM public.emit_security_event(
          'admin_tier_denied_by_db', v_uid, NULL, 'critical',
          jsonb_build_object('jwt_role', 'admin', 'db_grant', false)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- never let telemetry failure change the auth decision
      END;
    END IF;
    RETURN NULL;
  END IF;

  -- Grant is valid. Tier value comes from the signed JWT claim; default Tier 1.
  v_jwt_tier := NULLIF(auth.jwt() -> 'app_metadata' ->> 'tier', '')::INTEGER;
  RETURN COALESCE(v_jwt_tier, 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_tier() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_tier() TO authenticated, service_role;
