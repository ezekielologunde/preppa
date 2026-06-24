-- ── 007 notification_abuse ────────────────────────────────────────────────────
-- Notifications, preferences, abuse signal detection, and risk scoring.

CREATE TYPE public.notification_type AS ENUM (
  'new_order','order_update','order_cancelled','chat','review',
  'new_follower','listing_update','capacity_warning','system'
);
CREATE TYPE public.abuse_signal_type AS ENUM (
  'self_order_attempt','rapid_review','refund_abuse','payment_fraud',
  'login_bruteforce','address_mismatch','promo_abuse','account_sharing'
);

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        public.notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  priority    TEXT NOT NULL DEFAULT 'normal',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notification_preferences (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL,
  notification_type  public.notification_type NOT NULL,
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel, notification_type)
);

CREATE TABLE public.abuse_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type public.abuse_signal_type NOT NULL,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 100),
  payload     JSONB NOT NULL DEFAULT '{}',
  emitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.risk_scores (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score             INTEGER NOT NULL DEFAULT 0,
  signals_count     INTEGER NOT NULL DEFAULT 0,
  review_required_at TIMESTAMPTZ,
  frozen_at         TIMESTAMPTZ,
  last_signal_at    TIMESTAMPTZ,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX notifications_user_idx       ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx     ON public.notifications (user_id, read)
  WHERE read = FALSE;

CREATE INDEX notif_prefs_user_idx         ON public.notification_preferences (user_id);

CREATE INDEX abuse_signals_user_idx       ON public.abuse_signals (user_id, emitted_at DESC);
CREATE INDEX abuse_signals_type_idx       ON public.abuse_signals (signal_type);

CREATE INDEX risk_scores_score_idx        ON public.risk_scores (score DESC);
CREATE INDEX risk_scores_frozen_idx       ON public.risk_scores (frozen_at)
  WHERE frozen_at IS NOT NULL;

-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = TRUE
  WHERE id = ANY(p_notification_ids)
    AND user_id = auth.uid()
    AND read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = TRUE
  WHERE user_id = auth.uid() AND read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_notification_preference(
  p_channel           TEXT,
  p_notification_type public.notification_type,
  p_enabled           BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_preferences
    (user_id, channel, notification_type, enabled, updated_at)
  VALUES (auth.uid(), p_channel, p_notification_type, p_enabled, NOW())
  ON CONFLICT (user_id, channel, notification_type) DO UPDATE SET
    enabled    = EXCLUDED.enabled,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_abuse_signal(
  p_user_id UUID,
  p_type    public.abuse_signal_type,
  p_score   INTEGER,
  p_payload JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.abuse_signals (user_id, signal_type, score, payload)
  VALUES (p_user_id, p_type, p_score, p_payload);

  INSERT INTO public.risk_scores
    (user_id, score, signals_count, last_signal_at, last_updated)
  VALUES (p_user_id, p_score, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    score          = risk_scores.score + p_score,
    signals_count  = risk_scores.signals_count + 1,
    last_signal_at = NOW(),
    last_updated   = NOW(),
    -- Freeze at 800+; flag for review at 500+
    frozen_at = CASE
      WHEN risk_scores.score + p_score >= 800 AND risk_scores.frozen_at IS NULL THEN NOW()
      ELSE risk_scores.frozen_at
    END,
    review_required_at = CASE
      WHEN risk_scores.score + p_score >= 500 AND risk_scores.review_required_at IS NULL THEN NOW()
      ELSE risk_scores.review_required_at
    END;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_signals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores               ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_notifications ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY service_role_notifications ON public.notifications TO service_role USING (true) WITH CHECK (true);

CREATE POLICY users_own_prefs ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY service_role_abuse_signals ON public.abuse_signals TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_risk_scores ON public.risk_scores TO service_role USING (true) WITH CHECK (true);
