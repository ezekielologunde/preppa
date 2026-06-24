-- ── 029 admin_rbac_elevation ──────────────────────────────────────────────────
-- Tiered admin RBAC on top of the is_admin() foundation from migration 010.
--
-- Tiers:
--   Tier 1 — Support:       read orders, read chat logs, issue credits ≤ £10
--   Tier 2 — Trust & Safety: all Tier 1 actions + approve/reject preppers,
--                             override escrow, GDPR erasure, elevate/demote admins
--
-- Admin identity lives in auth.users.raw_app_meta_data:
--   { "role": "admin", "tier": 1 }   or   { "role": "admin", "tier": 2 }
-- is_admin() already checks role = 'admin' (migration 010).
-- admin_tier() reads the tier field; require_admin_tier(n) raises on shortfall.

-- ── Tier helpers ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_tier()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    THEN COALESCE(
           (auth.jwt() -> 'app_metadata' ->> 'tier')::INTEGER,
           1   -- missing tier field defaults to Tier 1 (Support)
         )
    ELSE NULL  -- caller is not an admin
  END
$$;

-- Guards a function body: raises immediately if caller's tier < min_tier.
CREATE OR REPLACE FUNCTION public.require_admin_tier(min_tier INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(public.admin_tier(), 0) < min_tier THEN
    RAISE EXCEPTION 'insufficient_admin_tier'
      USING DETAIL = format(
        'Action requires tier %s; caller has tier %s',
        min_tier,
        COALESCE(public.admin_tier()::TEXT, 'none')
      );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_tier()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_admin_tier(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_tier()              TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.require_admin_tier(INTEGER) TO authenticated, service_role;

-- ── admin_elevate_user ────────────────────────────────────────────────────────
-- Grants admin access (or changes tier) for a target user.
-- Writes directly to auth.users.raw_app_meta_data; the user's JWT reflects the
-- change on their next token refresh (Supabase token TTL default: 1 hour).
--
-- Security properties:
--   - Only Tier 2 admins can call this
--   - Self-elevation is blocked (privilege confusion risk)
--   - Target user must exist
--   - Tier is validated to 1 or 2 only
--   - Every call is recorded in admin_action_log (immutable)

CREATE OR REPLACE FUNCTION public.admin_elevate_user(
  p_target_user_id UUID,
  p_tier           INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_target_exists BOOLEAN;
BEGIN
  PERFORM public.require_admin_tier(2);

  IF p_tier NOT IN (1, 2) THEN
    RAISE EXCEPTION 'invalid_tier: must be 1 or 2';
  END IF;

  -- Blocks both self-elevation and the edge case where auth.uid() is NULL
  IF p_target_user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'self_elevation_not_allowed';
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id)
    INTO v_target_exists;
  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Merge role + tier into app_metadata; preserves any other existing keys
  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::JSONB)
        || jsonb_build_object('role', 'admin', 'tier', p_tier)
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, metadata, reversible)
  VALUES (
    auth.uid(),
    'admin_elevation',
    'user',
    p_target_user_id,
    format('granted admin tier %s', p_tier),
    jsonb_build_object('tier_granted', p_tier),
    TRUE   -- reversible via admin_demote_user
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_elevate_user(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_elevate_user(UUID, INTEGER) TO authenticated;

-- ── admin_demote_user ─────────────────────────────────────────────────────────
-- Strips admin role from a user. Tier 2 only. Reason is mandatory.

CREATE OR REPLACE FUNCTION public.admin_demote_user(
  p_target_user_id UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  PERFORM public.require_admin_tier(2);

  IF p_target_user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'self_demotion_not_allowed';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'demotion_reason_required';
  END IF;

  -- Remove role and tier keys; all other metadata keys are preserved
  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::JSONB) - 'role' - 'tier'
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, reversible)
  VALUES (
    auth.uid(), 'admin_demotion', 'user', p_target_user_id, p_reason, FALSE
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_demote_user(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_demote_user(UUID, TEXT) TO authenticated;

-- ── Patch migration 028 RPCs with tier gates ──────────────────────────────────
-- admin_approve_application and admin_reject_application were guarded by
-- is_admin() in migration 028. Now that require_admin_tier() exists, we add
-- the Tier 2 gate. The rest of the function body is unchanged.

CREATE OR REPLACE FUNCTION public.admin_approve_application(
  p_application_id UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app        public.prepper_applications%ROWTYPE;
  v_kitchen_id UUID;
BEGIN
  PERFORM public.require_admin_tier(2);

  SELECT * INTO v_app FROM public.prepper_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_app.status NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'invalid_transition: cannot approve from status %', v_app.status;
  END IF;

  UPDATE public.prepper_applications SET
    status         = 'approved',
    reviewed_at    = NOW(),
    reviewed_by    = auth.uid(),
    internal_notes = COALESCE(p_notes, internal_notes),
    updated_at     = NOW()
  WHERE id = p_application_id;

  v_kitchen_id := public.ensure_kitchen_for_prepper(v_app.user_id, v_app.legal_name);

  INSERT INTO public.domain_events (event_type, payload)
  VALUES (
    'prepper.approved',
    jsonb_build_object(
      'user_id',        v_app.user_id,
      'application_id', p_application_id,
      'kitchen_id',     v_kitchen_id
    )
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(), 'approve_application', 'prepper_application', p_application_id,
    COALESCE(p_notes, 'approved via admin console'),
    jsonb_build_object('user_id', v_app.user_id, 'kitchen_id', v_kitchen_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_application(
  p_application_id UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.prepper_applications%ROWTYPE;
BEGIN
  PERFORM public.require_admin_tier(2);
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  SELECT * INTO v_app FROM public.prepper_applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_transition: can only reject pending applications';
  END IF;

  UPDATE public.prepper_applications SET
    status           = 'rejected',
    reviewed_at      = NOW(),
    reviewed_by      = auth.uid(),
    rejection_reason = p_reason,
    updated_at       = NOW()
  WHERE id = p_application_id;

  INSERT INTO public.domain_events (event_type, payload)
  VALUES ('prepper.rejected', jsonb_build_object('user_id', v_app.user_id, 'reason', p_reason));

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (auth.uid(), 'reject_application', 'prepper_application', p_application_id, p_reason);
END;
$$;

-- ── Tier-gated Tier 1 read access ─────────────────────────────────────────────
-- Tier 1 Support can read chat/message logs for dispute triage.
-- Full message content is accessible only to admins (never exposed via RLS to customers).

CREATE OR REPLACE FUNCTION public.admin_read_order_summary(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.require_admin_tier(1);

  SELECT jsonb_build_object(
    'order',   row_to_json(o),
    'payment', row_to_json(p),
    'items',   (SELECT jsonb_agg(row_to_json(i)) FROM public.order_items i WHERE i.order_id = o.id)
  )
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.payments p ON p.order_id = o.id
  WHERE o.id = p_order_id;

  IF v_result IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_read_order_summary(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_read_order_summary(UUID) TO authenticated;
