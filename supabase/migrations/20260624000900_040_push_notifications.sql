-- ── 040 push_notifications ────────────────────────────────────────────────────
-- Completes the notifications framework: device tokens + push delivery.
--
-- The notify edge fn already sends Expo push but reads a push_tokens table that
-- was never created. The escrow/payout webhooks emit notification types that
-- aren't in the notification_type enum (would fail at runtime). This migration:
--   1. extends notification_type with payment/payout/account values
--   2. creates push_tokens (+ register/remove RPCs)
--   3. adds an AFTER INSERT trigger that dispatches Expo push via notify,
--      respecting the per-user 'push' channel preference (opt-out model)

-- ── 1. Extend notification_type ───────────────────────────────────────────────
-- ADD VALUE is transactional in PG12+; the new values aren't used in this file.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payout';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payout_failed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'account_status';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'application_status';

-- ── 2. push_tokens ────────────────────────────────────────────────────────────
-- One row per device token. A token is globally unique (a device belongs to one
-- account at a time); re-registering under a new user reassigns it.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    TEXT,                       -- 'ios' | 'android' | 'web'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users see/manage only their own tokens; notify uses service_role to read all.
CREATE POLICY push_tokens_own ON public.push_tokens FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY push_tokens_own_delete ON public.push_tokens FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY push_tokens_no_direct_write ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK (FALSE);  -- writes go through register_push_token RPC
CREATE POLICY push_tokens_service_role ON public.push_tokens
  TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── Register / remove a device token ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.register_push_token(p_token TEXT, p_platform TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN RAISE EXCEPTION 'invalid_token'; END IF;

  INSERT INTO public.push_tokens (token, user_id, platform)
  VALUES (p_token, auth.uid(), p_platform)
  ON CONFLICT (token) DO UPDATE SET
    user_id    = auth.uid(),   -- reassign the device to the current account
    platform   = COALESCE(EXCLUDED.platform, public.push_tokens.platform),
    updated_at = NOW();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.push_tokens WHERE token = p_token AND user_id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_push_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_push_token(TEXT) TO authenticated;

-- ── 3. Push dispatch trigger ──────────────────────────────────────────────────
-- Every notification row → an Expo push, unless the user disabled the 'push'
-- channel for that type. Reuses the notify edge fn (which reads push_tokens and
-- POSTs to Expo). Failure here never blocks the in-app notification insert.

CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE
  v_enabled BOOLEAN;
  v_key     TEXT;
BEGIN
  -- Opt-out: an explicit FALSE for the push channel suppresses delivery.
  SELECT enabled INTO v_enabled FROM public.notification_preferences
  WHERE user_id = NEW.user_id AND channel = 'push' AND notification_type = NEW.type;
  IF v_enabled IS NOT NULL AND v_enabled = FALSE THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_key := ''; END;

  PERFORM net.http_post(
    url     := 'https://nfwfnnfbikjxwflpmsnu.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_key, '')
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id, 'title', NEW.title, 'body', NEW.body, 'data', NEW.data
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- push is best-effort; never fail the notification insert
END;
$$;

CREATE TRIGGER notifications_push_dispatch
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_notification();
