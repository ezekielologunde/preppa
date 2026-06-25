-- ── 034 dispute_dual_approval ─────────────────────────────────────────────────
-- Sprint 30 red-team fix (CRITICAL): a single compromised Tier-2 admin could
-- resolve a dispute and trigger a payout with no second check.
--
-- Policy (product decision 2026-06-24): dispute resolutions on orders worth
-- more than £100 (10,000 pence) require a SECOND, DIFFERENT Tier-2 admin to
-- approve before any escrow transition or payout happens. At/under £100 the
-- single-admin path is retained for operational speed.
--
-- Mechanism:
--   admin_resolve_dispute()  — ≤£100: executes immediately (as before).
--                              >£100: records a pending proposal, NO escrow move.
--   admin_approve_dispute_resolution() — second admin executes the proposal.
--   admin_reject_dispute_resolution()  — second admin cancels the proposal.

-- ── Pending-approval ledger ───────────────────────────────────────────────────

CREATE TABLE public.pending_dispute_resolutions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  resolution   TEXT NOT NULL CHECK (resolution IN ('for_prepper','for_customer','split')),
  amount_pence INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  proposed_by  UUID NOT NULL REFERENCES auth.users(id),
  proposed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by   UUID REFERENCES auth.users(id),
  decided_at   TIMESTAMPTZ,
  decision_reason TEXT
);

-- Only one open proposal per order at a time (partial unique index — no
-- btree_gist dependency, unlike an EXCLUDE constraint).
CREATE UNIQUE INDEX one_open_proposal_per_order
  ON public.pending_dispute_resolutions (order_id)
  WHERE status = 'pending';

CREATE INDEX pending_dispute_pending_idx
  ON public.pending_dispute_resolutions (proposed_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.pending_dispute_resolutions ENABLE ROW LEVEL SECURITY;

-- Admins read via SECURITY DEFINER RPCs / service_role; no direct client writes.
CREATE POLICY pending_dispute_admin_read ON public.pending_dispute_resolutions
  FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY pending_dispute_no_client_write ON public.pending_dispute_resolutions
  FOR INSERT TO authenticated WITH CHECK (FALSE);
CREATE POLICY pending_dispute_service_role ON public.pending_dispute_resolutions
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Shared executor: perform the actual escrow transition + events ────────────
-- Extracted so the immediate path and the approval path stay identical.

CREATE OR REPLACE FUNCTION public._execute_dispute_resolution(
  p_order_id   UUID,
  p_resolution TEXT,
  p_actor_id   UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.escrow_status != 'disputed' THEN
    RAISE EXCEPTION 'order_not_disputed: current status is %', v_order.escrow_status;
  END IF;

  UPDATE public.orders SET
    escrow_status = CASE p_resolution
                      WHEN 'for_customer' THEN 'refunded'::public.escrow_status
                      ELSE 'releasing'::public.escrow_status
                    END,
    updated_at    = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.domain_events (event_type, payload)
  VALUES (
    'dispute.resolved',
    jsonb_build_object(
      'order_id',    p_order_id,
      'resolution',  p_resolution,
      'resolved_by', p_actor_id
    )
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (
    p_actor_id, 'resolve_dispute', 'order', p_order_id,
    format('dispute resolved: %s', p_resolution)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public._execute_dispute_resolution(UUID, TEXT, UUID) FROM PUBLIC;

-- ── admin_resolve_dispute (threshold-gated) ───────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_resolve_dispute(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_order_id   UUID,
  p_resolution TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      public.orders%ROWTYPE;
  v_pending_id UUID;
  v_threshold  CONSTANT INTEGER := 10000;  -- £100 in pence
BEGIN
  PERFORM public.require_admin_tier(2);
  IF p_resolution NOT IN ('for_prepper', 'for_customer', 'split') THEN
    RAISE EXCEPTION 'invalid_resolution: must be for_prepper, for_customer, or split';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF v_order.escrow_status != 'disputed' THEN
    RAISE EXCEPTION 'order_not_disputed: current status is %', v_order.escrow_status;
  END IF;

  -- Small disputes: single-admin, execute immediately.
  IF v_order.total_pence <= v_threshold THEN
    PERFORM public._execute_dispute_resolution(p_order_id, p_resolution, auth.uid());
    RETURN jsonb_build_object('status', 'resolved', 'requires_second_approval', false);
  END IF;

  -- Large disputes: record a proposal; a different Tier-2 admin must approve.
  INSERT INTO public.pending_dispute_resolutions
    (order_id, resolution, amount_pence, proposed_by)
  VALUES (p_order_id, p_resolution, v_order.total_pence, auth.uid())
  RETURNING id INTO v_pending_id;

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(), 'propose_dispute_resolution', 'order', p_order_id,
    format('proposed %s (£%s) — awaiting second approval', p_resolution, (v_order.total_pence / 100.0)),
    jsonb_build_object('pending_id', v_pending_id, 'amount_pence', v_order.total_pence)
  );

  RETURN jsonb_build_object(
    'status',                   'pending_second_approval',
    'requires_second_approval', true,
    'pending_id',               v_pending_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT) TO authenticated;

-- ── admin_approve_dispute_resolution ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_approve_dispute_resolution(p_pending_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pending public.pending_dispute_resolutions%ROWTYPE;
BEGIN
  PERFORM public.require_admin_tier(2);

  SELECT * INTO v_pending FROM public.pending_dispute_resolutions
  WHERE id = p_pending_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'proposal_already_%', v_pending.status;
  END IF;

  -- Four-eyes: the approver must NOT be the proposer.
  IF v_pending.proposed_by = auth.uid() THEN
    RAISE EXCEPTION 'self_approval_not_allowed'
      USING DETAIL = 'A different Tier-2 admin must approve this resolution.';
  END IF;

  PERFORM public._execute_dispute_resolution(v_pending.order_id, v_pending.resolution, auth.uid());

  UPDATE public.pending_dispute_resolutions SET
    status     = 'approved',
    decided_by = auth.uid(),
    decided_at = NOW()
  WHERE id = p_pending_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_dispute_resolution(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_approve_dispute_resolution(UUID) TO authenticated;

-- ── admin_reject_dispute_resolution ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_reject_dispute_resolution(
  p_pending_id UUID,
  p_reason     TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pending public.pending_dispute_resolutions%ROWTYPE;
BEGIN
  PERFORM public.require_admin_tier(2);
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  SELECT * INTO v_pending FROM public.pending_dispute_resolutions
  WHERE id = p_pending_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF v_pending.status != 'pending' THEN
    RAISE EXCEPTION 'proposal_already_%', v_pending.status;
  END IF;
  IF v_pending.proposed_by = auth.uid() THEN
    RAISE EXCEPTION 'self_rejection_not_allowed'
      USING DETAIL = 'A different Tier-2 admin must review this resolution.';
  END IF;

  UPDATE public.pending_dispute_resolutions SET
    status          = 'rejected',
    decided_by      = auth.uid(),
    decided_at      = NOW(),
    decision_reason = p_reason
  WHERE id = p_pending_id;

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (auth.uid(), 'reject_dispute_resolution', 'order', v_pending.order_id, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reject_dispute_resolution(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_reject_dispute_resolution(UUID, TEXT) TO authenticated;
