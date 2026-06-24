-- ── 010 admin_foundation ──────────────────────────────────────────────────────
-- Admin identity, action log, account-status columns, and admin helper RPCs.
-- Every admin action: emits domain event + writes audit log + records action log.
-- Admin identity = JWT app_metadata.role = 'admin' (set via Supabase Auth dashboard
-- or service role: auth.admin.updateUserById with app_metadata: {role:'admin'}).

-- ── Admin identity ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    FALSE
  )
$$;

-- ── Admin action log ──────────────────────────────────────────────────────────
-- Immutable record of every action taken by an administrator.
-- Cannot be updated or deleted — only INSERT is allowed (enforced by RLS).

CREATE TABLE public.admin_action_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action_type     TEXT NOT NULL,          -- e.g. 'freeze_account', 'disable_listing'
  target_type     TEXT NOT NULL,          -- e.g. 'user', 'listing', 'payment', 'event'
  target_id       UUID,                   -- NULL for platform-wide actions
  reason          TEXT NOT NULL,          -- mandatory justification
  metadata        JSONB NOT NULL DEFAULT '{}',
  domain_event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL,
  reversible      BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_at     TIMESTAMPTZ,
  reversed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reversal_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_action_log_admin_idx  ON public.admin_action_log (admin_id, created_at DESC);
CREATE INDEX admin_action_log_target_idx ON public.admin_action_log (target_type, target_id);
CREATE INDEX admin_action_log_type_idx   ON public.admin_action_log (action_type, created_at DESC);
CREATE INDEX admin_action_log_created_idx ON public.admin_action_log (created_at DESC);

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
-- Admins can read; no one can update or delete
CREATE POLICY admin_read_log ON public.admin_action_log FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY admin_insert_log ON public.admin_action_log FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() AND public.is_admin());
CREATE POLICY service_role_log ON public.admin_action_log TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Extend existing tables for admin state ────────────────────────────────────

-- kitchens: verification status
ALTER TABLE public.kitchens
  ADD COLUMN IF NOT EXISTS verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- listings: admin disable (separate from prepper-controlled status)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS admin_disabled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_disabled_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_disabled_reason TEXT;

-- Update the published listings RLS policy to respect admin disable
-- (existing policy: status = 'published' AND deleted_at IS NULL)
-- New policy: also require admin_disabled_at IS NULL
DROP POLICY IF EXISTS public_read_published ON public.listings;
CREATE POLICY public_read_published ON public.listings FOR SELECT TO public
  USING (status = 'published' AND deleted_at IS NULL AND admin_disabled_at IS NULL);

-- ── Internal helper: write admin audit trail atomically ───────────────────────

CREATE OR REPLACE FUNCTION public._admin_record(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id   UUID,
  p_reason      TEXT,
  p_metadata    JSONB DEFAULT '{}',
  p_reversible  BOOLEAN DEFAULT FALSE,
  p_event_type  TEXT DEFAULT NULL
)
RETURNS UUID   -- returns admin_action_log.id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id  UUID;
  v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Emit domain event for the admin action
  IF p_event_type IS NOT NULL THEN
    INSERT INTO public.domain_events
      (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
    VALUES (
      p_event_type, p_target_type, COALESCE(p_target_id, gen_random_uuid()),
      auth.uid(),
      jsonb_build_object(
        'reason',      p_reason,
        'admin_id',    auth.uid(),
        'target_id',   p_target_id,
        'target_type', p_target_type
      ) || p_metadata,
      1
    )
    RETURNING id INTO v_event_id;
  END IF;

  -- Write to audit_logs
  INSERT INTO public.audit_logs
    (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(), p_action_type, p_target_type, p_target_id,
    p_metadata || jsonb_build_object('reason', p_reason, 'admin', TRUE)
  );

  -- Write admin action log
  INSERT INTO public.admin_action_log
    (admin_id, action_type, target_type, target_id, reason, metadata, domain_event_id, reversible)
  VALUES
    (auth.uid(), p_action_type, p_target_type, p_target_id, p_reason, p_metadata, v_event_id, p_reversible)
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- ── Admin account management RPCs ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_freeze_account(
  p_user_id UUID,
  p_reason  TEXT
)
RETURNS UUID  -- returns action log id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Set frozen_at on risk_scores (upsert: user may not have a row yet)
  INSERT INTO public.risk_scores (user_id, frozen_at, last_updated)
  VALUES (p_user_id, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    frozen_at    = COALESCE(risk_scores.frozen_at, NOW()),
    last_updated = NOW()
  WHERE risk_scores.frozen_at IS NULL; -- idempotent: don't overwrite existing freeze

  SELECT public._admin_record(
    'freeze_account', 'user', p_user_id, p_reason,
    jsonb_build_object('frozen_by', auth.uid()),
    TRUE, 'account.frozen'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unfreeze_account(
  p_user_id UUID,
  p_reason  TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.risk_scores
  SET frozen_at = NULL, last_updated = NOW()
  WHERE user_id = p_user_id;

  SELECT public._admin_record(
    'unfreeze_account', 'user', p_user_id, p_reason,
    jsonb_build_object('unfrozen_by', auth.uid()),
    FALSE, 'account.unfrozen'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_prepper(
  p_prepper_id UUID,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.kitchens SET
    verified_at = COALESCE(verified_at, NOW()),
    verified_by = COALESCE(verified_by, auth.uid())
  WHERE prepper_id = p_prepper_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'kitchen_not_found'; END IF;

  SELECT public._admin_record(
    'verify_prepper', 'kitchen', (SELECT id FROM public.kitchens WHERE prepper_id = p_prepper_id),
    p_reason, jsonb_build_object('prepper_id', p_prepper_id),
    FALSE, 'prepper.verified'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_disable_listing(
  p_listing_id UUID,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.listings SET
    admin_disabled_at     = NOW(),
    admin_disabled_by     = auth.uid(),
    admin_disabled_reason = p_reason
  WHERE id = p_listing_id AND admin_disabled_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found_or_already_disabled'; END IF;

  SELECT public._admin_record(
    'disable_listing', 'listing', p_listing_id, p_reason,
    '{}', TRUE, 'listing.admin_disabled'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_enable_listing(
  p_listing_id UUID,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.listings SET
    admin_disabled_at     = NULL,
    admin_disabled_by     = NULL,
    admin_disabled_reason = NULL
  WHERE id = p_listing_id;

  SELECT public._admin_record(
    'enable_listing', 'listing', p_listing_id, p_reason,
    '{}', FALSE, 'listing.admin_enabled'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_media(
  p_media_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_uploader  UUID;
  v_filesize  BIGINT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT uploader_id, filesize INTO v_uploader, v_filesize
  FROM public.media_objects WHERE id = p_media_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'media_not_found'; END IF;

  -- Quarantine rather than delete (preserves evidence)
  UPDATE public.media_objects SET
    pipeline_status  = 'quarantined',
    rejection_reason = 'admin_removed: ' || p_reason
  WHERE id = p_media_id;

  -- Refund quota if it was consuming space
  UPDATE public.user_storage_quotas SET
    used_bytes   = GREATEST(0, used_bytes - v_filesize),
    last_updated = NOW()
  WHERE user_id = v_uploader;

  SELECT public._admin_record(
    'remove_media', 'media_object', p_media_id, p_reason,
    jsonb_build_object('uploader_id', v_uploader),
    FALSE, 'media.admin_removed'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_abuse_review(
  p_user_id UUID,
  p_reason  TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  UPDATE public.risk_scores SET
    review_required_at = NULL,
    last_updated       = NOW()
  WHERE user_id = p_user_id;

  SELECT public._admin_record(
    'clear_abuse_review', 'user', p_user_id, p_reason,
    '{}', FALSE, 'account.abuse_review_cleared'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_retry_event(
  p_event_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- Reset to pending_retry so dispatch_retry_events picks it up immediately
  UPDATE public.event_processing_log SET
    status          = 'pending_retry',
    next_attempt_at = NOW(),
    error           = NULL,
    last_attempt_at = NOW()
  WHERE event_id = p_event_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'event_processing_log_not_found'; END IF;

  SELECT public._admin_record(
    'retry_event', 'domain_event', p_event_id, p_reason,
    '{}', FALSE, NULL  -- no domain event for meta-operations
  ) INTO v_action_id;

  -- Write audit log manually (no domain event emit)
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'retry_event', 'domain_event', p_event_id,
    jsonb_build_object('reason', p_reason, 'admin', TRUE));

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replay_dead_letter(
  p_dead_letter_id UUID,
  p_reason         TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_event_id  UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT event_id INTO v_event_id
  FROM public.event_dead_letters WHERE id = p_dead_letter_id AND resolved_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'dead_letter_not_found_or_already_resolved'; END IF;

  -- Reset the processing log so the retry engine picks it up
  INSERT INTO public.event_processing_log
    (event_id, event_type, status, next_attempt_at, attempt_count)
  SELECT id, event_type, 'pending_retry', NOW(), 0
  FROM public.domain_events WHERE id = v_event_id
  ON CONFLICT (event_id) DO UPDATE SET
    status          = 'pending_retry',
    next_attempt_at = NOW(),
    attempt_count   = 0,
    error           = NULL,
    failure_reason  = NULL;

  -- Mark dead letter as resolved by admin
  UPDATE public.event_dead_letters SET
    resolved_at      = NOW(),
    resolved_by      = auth.uid(),
    resolution_note  = 'admin_replay: ' || p_reason
  WHERE id = p_dead_letter_id;

  SELECT public._admin_record(
    'replay_dead_letter', 'event_dead_letter', p_dead_letter_id, p_reason,
    jsonb_build_object('event_id', v_event_id),
    FALSE, 'event.dead_letter_replayed'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resend_notification(
  p_user_id         UUID,
  p_type            public.notification_type,
  p_title           TEXT,
  p_body            TEXT,
  p_reason          TEXT,
  p_data            JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data, priority)
  VALUES (p_user_id, p_type, p_title, p_body, p_data, 'high');

  SELECT public._admin_record(
    'resend_notification', 'user', p_user_id, p_reason,
    jsonb_build_object('notification_type', p_type, 'title', p_title),
    FALSE, NULL
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- Payment admin actions require Stripe API calls and are handled by the
-- admin-actions edge function, which calls these DB functions after Stripe confirms.

CREATE OR REPLACE FUNCTION public.admin_refund_order(
  p_order_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_payment   public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.status NOT IN ('captured', 'in_escrow') THEN
    RAISE EXCEPTION 'payment_not_refundable: status=%', v_payment.status;
  END IF;

  -- Mark payment refunded (Stripe refund must be initiated before calling this)
  UPDATE public.payments SET
    status      = 'refunded',
    refunded_at = NOW(),
    updated_at  = NOW()
  WHERE id = v_payment.id;

  -- Update order status
  UPDATE public.orders SET status = 'refunded', updated_at = NOW()
  WHERE id = p_order_id;

  SELECT public._admin_record(
    'refund_order', 'order', p_order_id, p_reason,
    jsonb_build_object('payment_id', v_payment.id, 'amount_pence', v_payment.amount_pence),
    FALSE, 'payment.admin_refunded'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_release_escrow(
  p_order_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id UUID;
  v_payment   public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.status <> 'in_escrow' THEN
    RAISE EXCEPTION 'payment_not_in_escrow: status=%', v_payment.status;
  END IF;

  UPDATE public.payments SET
    status      = 'released',
    released_at = NOW(),
    updated_at  = NOW()
  WHERE id = v_payment.id;

  SELECT public._admin_record(
    'release_escrow', 'payment', v_payment.id, p_reason,
    jsonb_build_object('order_id', p_order_id, 'prepper_payout_pence', v_payment.prepper_payout_pence),
    FALSE, 'payment.escrow_released'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- ── Grant admin RPCs ──────────────────────────────────────────────────────────
-- All admin RPCs are SECURITY DEFINER and check is_admin() internally.
-- Grant EXECUTE to authenticated so the admin can call them via supabase-js.
-- The is_admin() guard prevents non-admins from doing anything.

GRANT EXECUTE ON FUNCTION public.is_admin()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_freeze_account(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_account(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_prepper(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_listing(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_enable_listing(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_media(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_abuse_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_event(UUID, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replay_dead_letter(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resend_notification(UUID, public.notification_type, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_order(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_escrow(UUID, TEXT)  TO authenticated;

-- _admin_record is internal only
REVOKE EXECUTE ON FUNCTION public._admin_record(TEXT, TEXT, UUID, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
