-- ── 008 storage_hardening ─────────────────────────────────────────────────────
-- Media object pipeline: upload intake, virus scanning, quota, and lifecycle.

CREATE TYPE public.upload_pipeline_status AS ENUM (
  'pending','validating','processing','ready','rejected','quarantined'
);
CREATE TYPE public.virus_scan_status AS ENUM (
  'pending','clean','infected','scan_failed'
);

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.media_objects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_bucket    TEXT NOT NULL,
  storage_path      TEXT,
  detected_mime     TEXT,
  sha256            TEXT,
  filesize          BIGINT NOT NULL,
  width             INTEGER,
  height            INTEGER,
  duration_ms       INTEGER,          -- video/audio duration; DB column is ms
  pipeline_status   public.upload_pipeline_status NOT NULL DEFAULT 'pending',
  virus_status      public.virus_scan_status NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT,
  processing_error  TEXT,
  exif_stripped     BOOLEAN NOT NULL DEFAULT FALSE,
  reencoded         BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at      TIMESTAMPTZ,
  ready_at          TIMESTAMPTZ
);

CREATE TABLE public.user_storage_quotas (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_bytes    BIGINT NOT NULL DEFAULT 0,
  quota_bytes   BIGINT NOT NULL DEFAULT 524288000, -- 500 MiB default
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX media_objects_uploader_idx   ON public.media_objects (uploader_id);
CREATE INDEX media_objects_status_idx     ON public.media_objects (pipeline_status);
CREATE INDEX media_objects_pending_idx    ON public.media_objects (uploaded_at)
  WHERE pipeline_status IN ('pending','validating','processing');
-- Partial unique: no duplicate SHA for same uploader once ready
CREATE UNIQUE INDEX media_objects_sha256_idx
  ON public.media_objects (uploader_id, sha256)
  WHERE ready_at IS NOT NULL AND sha256 IS NOT NULL;

-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.begin_upload(
  p_filename    TEXT,
  p_filesize    BIGINT,
  p_bucket      TEXT DEFAULT 'media'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quota_ok  BOOLEAN;
  v_media_id  UUID;
BEGIN
  -- Quota check + atomic increment: single UPDATE to avoid TOCTOU
  UPDATE public.user_storage_quotas SET
    used_bytes   = used_bytes + p_filesize,
    last_updated = NOW()
  WHERE user_id = auth.uid()
    AND used_bytes + p_filesize <= quota_bytes;

  GET DIAGNOSTICS v_quota_ok = ROW_COUNT;

  -- If no row existed yet, seed it with default quota then retry
  IF NOT v_quota_ok THEN
    INSERT INTO public.user_storage_quotas (user_id)
    VALUES (auth.uid())
    ON CONFLICT DO NOTHING;

    UPDATE public.user_storage_quotas SET
      used_bytes   = used_bytes + p_filesize,
      last_updated = NOW()
    WHERE user_id = auth.uid()
      AND used_bytes + p_filesize <= quota_bytes;

    GET DIAGNOSTICS v_quota_ok = ROW_COUNT;
    IF NOT v_quota_ok THEN
      RAISE EXCEPTION 'quota_exceeded';
    END IF;
  END IF;

  INSERT INTO public.media_objects
    (uploader_id, original_filename, storage_bucket, filesize)
  VALUES (auth.uid(), p_filename, p_bucket, p_filesize)
  RETURNING id INTO v_media_id;

  RETURN v_media_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_media_ready(
  p_media_id     UUID,
  p_storage_path TEXT,
  p_sha256       TEXT,
  p_mime         TEXT,
  p_width        INTEGER DEFAULT NULL,
  p_height       INTEGER DEFAULT NULL,
  p_duration_ms  INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.media_objects SET
    storage_path    = p_storage_path,
    sha256          = p_sha256,
    detected_mime   = p_mime,
    width           = p_width,
    height          = p_height,
    duration_ms     = p_duration_ms,
    pipeline_status = 'ready',
    virus_status    = 'clean',
    exif_stripped   = TRUE,
    reencoded       = TRUE,
    ready_at        = NOW(),
    validated_at    = NOW()
  WHERE id = p_media_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_media(
  p_media_id UUID,
  p_reason   TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.media_objects SET
    pipeline_status  = 'rejected',
    rejection_reason = p_reason
  WHERE id = p_media_id;

  -- Refund quota
  UPDATE public.user_storage_quotas SET
    used_bytes   = GREATEST(0, used_bytes - (
      SELECT filesize FROM public.media_objects WHERE id = p_media_id
    )),
    last_updated = NOW()
  WHERE user_id = (
    SELECT uploader_id FROM public.media_objects WHERE id = p_media_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_uploads(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec   RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, uploader_id, filesize
    FROM public.media_objects
    WHERE pipeline_status IN ('pending','validating','processing')
      AND uploaded_at < NOW() - (p_older_than_hours || ' hours')::INTERVAL
  LOOP
    UPDATE public.user_storage_quotas SET
      used_bytes   = GREATEST(0, used_bytes - v_rec.filesize),
      last_updated = NOW()
    WHERE user_id = v_rec.uploader_id;

    UPDATE public.media_objects SET
      pipeline_status = 'rejected',
      rejection_reason = 'upload_timeout'
    WHERE id = v_rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.media_objects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_storage_quotas ENABLE ROW LEVEL SECURITY;

-- Uploaders see their own objects; service role sees all
CREATE POLICY users_own_media ON public.media_objects FOR SELECT TO authenticated
  USING (uploader_id = auth.uid());
CREATE POLICY users_insert_media ON public.media_objects FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid());
CREATE POLICY service_role_media ON public.media_objects TO service_role USING (true) WITH CHECK (true);

CREATE POLICY users_own_quota ON public.user_storage_quotas FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY service_role_quota ON public.user_storage_quotas TO service_role USING (true) WITH CHECK (true);
