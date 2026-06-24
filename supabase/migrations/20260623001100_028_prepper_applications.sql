-- ── 028 prepper_applications ───────────────────────────────────────────────────
-- Prepper onboarding funnel: application record, cert tracking, admin review RPCs.
--
-- Flow:
--   1. Prepper submits application (INSERT via RLS)
--   2. Admin reviews → admin_approve_application / admin_reject_application
--   3. On approval: kitchens row created if not yet existing
--   4. pg_cron sweeps daily for cert expiry; emits domain events for notification dispatch

CREATE TYPE public.application_status AS ENUM (
  'pending',    -- submitted, awaiting review
  'approved',   -- cert verified; kitchen may go live
  'rejected',   -- declined at review
  'suspended'   -- cert expired or admin-suspended post-approval
);

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.prepper_applications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status                 public.application_status NOT NULL DEFAULT 'pending',

  -- Identity & premises
  legal_name             TEXT NOT NULL,
  postcode               TEXT NOT NULL,
  kitchen_address        TEXT,

  -- Compliance documents (Supabase Storage paths — not raw URLs)
  kitchen_photos         TEXT[] NOT NULL DEFAULT '{}',   -- minimum 2 required before submit
  food_safety_cert_url   TEXT,

  -- Cert validity (nullable until cert is uploaded and reviewed)
  cert_expiration_date   TIMESTAMPTZ,   -- pg_cron checks this for suspension sweep
  cert_reminder_sent_at  TIMESTAMPTZ,   -- set when 30-day warning email dispatched

  -- Listing profile
  bio                    TEXT,
  experience_years       SMALLINT,
  specialties            TEXT[] NOT NULL DEFAULT '{}',

  -- Legal attestations (both required before INSERT policy allows submission)
  insurance_attested     BOOLEAN NOT NULL DEFAULT FALSE,
  insurance_attested_at  TIMESTAMPTZ,
  contractor_attested    BOOLEAN NOT NULL DEFAULT FALSE,
  contractor_attested_at TIMESTAMPTZ,

  -- Admin review
  submitted_at           TIMESTAMPTZ,                   -- set by applicant on final submit
  reviewed_at            TIMESTAMPTZ,
  reviewed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason       TEXT,
  internal_notes         TEXT,   -- admin-only; never exposed to applicant via RLS

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX prepper_applications_user_idx   ON public.prepper_applications (user_id);
CREATE INDEX prepper_applications_status_idx ON public.prepper_applications (status, submitted_at DESC);

-- pg_cron cert-expiry sweep: partial index on approved rows with a cert date
CREATE INDEX prepper_applications_cert_expiry_idx
  ON public.prepper_applications (cert_expiration_date ASC)
  WHERE cert_expiration_date IS NOT NULL AND status = 'approved';

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.prepper_applications ENABLE ROW LEVEL SECURITY;

-- Applicant reads only their own record
CREATE POLICY applications_select_own ON public.prepper_applications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Applicant may INSERT their own record.
-- UNIQUE (user_id) prevents duplicates at the DB level.
-- Both attestations are mandatory before RLS allows the row through.
CREATE POLICY applications_insert_own ON public.prepper_applications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND insurance_attested  = TRUE
    AND contractor_attested = TRUE
  );

-- Applicant can UPDATE only while status = 'pending' (not after review decision)
CREATE POLICY applications_update_draft ON public.prepper_applications FOR UPDATE TO authenticated
  USING  (auth.uid() IS NOT NULL AND user_id = auth.uid() AND status = 'pending')
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY applications_admin_rw ON public.prepper_applications FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY applications_service_role ON public.prepper_applications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Helper: ensure kitchens row exists for approved prepper ───────────────────

CREATE OR REPLACE FUNCTION public.ensure_kitchen_for_prepper(
  p_user_id    UUID,
  p_legal_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kitchen_id UUID;
BEGIN
  INSERT INTO public.kitchens (prepper_id, display_name)
  VALUES (p_user_id, p_legal_name)
  ON CONFLICT (prepper_id) DO NOTHING
  RETURNING id INTO v_kitchen_id;

  IF v_kitchen_id IS NULL THEN
    SELECT id INTO v_kitchen_id FROM public.kitchens WHERE prepper_id = p_user_id;
  END IF;

  RETURN v_kitchen_id;
END;
$$;

-- ── admin_approve_application ─────────────────────────────────────────────────
-- Tier 2 admin only (patched again in 029 once require_admin_tier is defined;
-- uses is_admin() here as a minimum gate until tier helpers are available).

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
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'requires_admin'; END IF;

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

REVOKE EXECUTE ON FUNCTION public.admin_approve_application(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_approve_application(UUID, TEXT) TO authenticated;

-- ── admin_reject_application ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_reject_application(
  p_application_id UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.prepper_applications%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'requires_admin'; END IF;
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
  VALUES (
    'prepper.rejected',
    jsonb_build_object('user_id', v_app.user_id, 'reason', p_reason)
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason)
  VALUES (auth.uid(), 'reject_application', 'prepper_application', p_application_id, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reject_application(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_reject_application(UUID, TEXT) TO authenticated;

-- ── admin_suspend_prepper ─────────────────────────────────────────────────────
-- Called by cert-expiry cron and by manual admin action.

CREATE OR REPLACE FUNCTION public.admin_suspend_prepper(
  p_user_id UUID,
  p_reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'requires_admin'; END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'suspension_reason_required';
  END IF;

  UPDATE public.prepper_applications SET
    status     = 'suspended',
    updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'approved'
  RETURNING id INTO v_app_id;

  IF v_app_id IS NULL THEN
    RAISE EXCEPTION 'no_approved_application_found';
  END IF;

  -- Pause the kitchen so no new orders can be placed
  UPDATE public.kitchens SET
    status_override = 'offline',
    updated_at      = NOW()
  WHERE prepper_id = p_user_id;

  -- Domain event triggers pro-rata subscription refunds (event-processor handles)
  INSERT INTO public.domain_events (event_type, payload)
  VALUES (
    'prepper.suspended',
    jsonb_build_object(
      'user_id', p_user_id,
      'reason',  p_reason
    )
  );

  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, reversible)
  VALUES (
    auth.uid(), 'suspend_prepper', 'user', p_user_id, p_reason, TRUE
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_prepper(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_suspend_prepper(UUID, TEXT) TO service_role, authenticated;

-- ── pg_cron: cert expiry sweeps ───────────────────────────────────────────────
-- Requires pg_cron extension enabled on the Supabase project.

-- 30-day warning: runs at 08:00 UTC daily
SELECT cron.schedule(
  'cert-expiry-reminder',
  '0 8 * * *',
  $cron$
    WITH candidates AS (
      UPDATE public.prepper_applications SET
        cert_reminder_sent_at = NOW(),
        updated_at            = NOW()
      WHERE status = 'approved'
        AND cert_expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        AND cert_reminder_sent_at IS NULL
      RETURNING user_id, cert_expiration_date
    )
    INSERT INTO public.domain_events (event_type, payload)
    SELECT
      'prepper.cert_expiry_warning',
      jsonb_build_object('user_id', user_id, 'expires_at', cert_expiration_date)
    FROM candidates;
  $cron$
);

-- Suspension on expiry: runs at 03:00 UTC daily
SELECT cron.schedule(
  'cert-expiry-suspend',
  '0 3 * * *',
  $cron$
    WITH expired AS (
      UPDATE public.prepper_applications SET
        status     = 'suspended',
        updated_at = NOW()
      WHERE status = 'approved'
        AND cert_expiration_date IS NOT NULL
        AND cert_expiration_date < NOW()
      RETURNING user_id
    ),
    kitchens_paused AS (
      UPDATE public.kitchens SET
        status_override = 'offline',
        updated_at      = NOW()
      WHERE prepper_id IN (SELECT user_id FROM expired)
    )
    INSERT INTO public.domain_events (event_type, payload)
    SELECT
      'prepper.cert_expired',
      jsonb_build_object('user_id', user_id)
    FROM expired;
  $cron$
);
