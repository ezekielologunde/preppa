-- ── 018 media_admin_hardening ─────────────────────────────────────────────────
-- S-9: Media Administration Hardening.
-- Closes: path traversal, orphan media after quarantine, double-quarantine,
--         bucket enumeration via error messages, mass admin deletion.

-- ── Schema extensions ─────────────────────────────────────────────────────────

-- Track listing photos that lost their backing media (orphaned by quarantine)
ALTER TABLE public.listing_photos
  ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMPTZ;

-- Add media removal quota column to existing admin_action_quota table (from 016)
ALTER TABLE public.admin_action_quota
  ADD COLUMN IF NOT EXISTS media_removals_this_hour INTEGER NOT NULL DEFAULT 0;

-- ── Storage path validation trigger ──────────────────────────────────────────

-- Validates that storage_path cannot escape the bucket or contain traversal sequences.
-- Applied BEFORE INSERT OR UPDATE so invalid paths never reach storage.
CREATE OR REPLACE FUNCTION public.validate_storage_path()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only validate when storage_path is actually being set
  IF NEW.storage_path IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block path traversal and absolute paths
  IF NEW.storage_path LIKE '%..%' OR NEW.storage_path LIKE '/%' THEN
    RAISE EXCEPTION 'invalid_storage_path: traversal sequences or absolute paths are not allowed';
  END IF;

  -- Allowlist: only safe characters (alphanumeric, slash, dot, underscore, hyphen)
  IF NEW.storage_path !~ '^[a-zA-Z0-9/._-]+$' THEN
    RAISE EXCEPTION 'invalid_storage_path: path contains disallowed characters';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop any pre-existing version of this trigger before recreating
DROP TRIGGER IF EXISTS media_objects_validate_path ON public.media_objects;

CREATE TRIGGER media_objects_validate_path
  BEFORE INSERT OR UPDATE ON public.media_objects
  FOR EACH ROW EXECUTE FUNCTION public.validate_storage_path();

-- ── Per-hour admin media removal quota ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public._consume_admin_media_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('hour', NOW());
  v_rows   INTEGER;
  MEDIA_REMOVAL_CAP CONSTANT INTEGER := 100;
BEGIN
  -- Ensure window row exists
  INSERT INTO public.admin_action_quota (admin_id, window_start)
  VALUES (auth.uid(), v_window)
  ON CONFLICT DO NOTHING;

  -- Atomic increment only when under cap
  UPDATE public.admin_action_quota SET
    media_removals_this_hour = media_removals_this_hour + 1
  WHERE admin_id = auth.uid()
    AND window_start = v_window
    AND media_removals_this_hour < MEDIA_REMOVAL_CAP;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    PERFORM public.emit_security_event(
      'admin_media_removal_quota_exceeded', auth.uid(), NULL, 'critical',
      jsonb_build_object('cap', MEDIA_REMOVAL_CAP, 'window', v_window)
    );
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._consume_admin_media_quota() FROM PUBLIC;

-- ── admin_remove_media (hardened rewrite) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_remove_media(
  p_media_id UUID,
  p_reason   TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_id      UUID;
  v_media          public.media_objects%ROWTYPE;
  v_existing_log   UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required'; END IF;

  -- ── Per-hour quota check (fail fast before any DB read) ───────────────────
  IF NOT public._consume_admin_media_quota() THEN
    RAISE EXCEPTION 'media_removal_quota_exceeded: max 100 removals per hour';
  END IF;

  -- ── Lock the row to prevent concurrent double-quarantine ──────────────────
  SELECT * INTO v_media
  FROM public.media_objects
  WHERE id = p_media_id
  FOR UPDATE;

  -- Use a generic error message to avoid leaking bucket structure
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media_not_found';
  END IF;

  -- ── Idempotent: if already quarantined return the existing audit log id ────
  IF v_media.pipeline_status = 'quarantined' THEN
    SELECT id INTO v_existing_log
    FROM public.admin_action_log
    WHERE action_type = 'remove_media'
      AND target_type = 'media_object'
      AND target_id   = p_media_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Return existing log id so caller knows it was already done
    RETURN v_existing_log;
  END IF;

  -- ── Quarantine ────────────────────────────────────────────────────────────
  UPDATE public.media_objects SET
    pipeline_status  = 'quarantined',
    rejection_reason = 'admin_removed: ' || p_reason
  WHERE id = p_media_id;

  -- Refund uploader's storage quota
  UPDATE public.user_storage_quotas SET
    used_bytes   = GREATEST(0, used_bytes - v_media.filesize),
    last_updated = NOW()
  WHERE user_id = v_media.uploader_id;

  -- ── Orphan any listing_photos that still reference this storage_path ───────
  -- Listing photos reference storage_path directly (not media_object FK),
  -- so we match by path to find what this media object was backing.
  UPDATE public.listing_photos SET
    orphaned_at = NOW()
  WHERE storage_path = v_media.storage_path
    AND orphaned_at IS NULL;

  -- ── Domain event + audit trail ────────────────────────────────────────────
  SELECT public._admin_record(
    'remove_media',
    'media_object',
    p_media_id,
    p_reason,
    jsonb_build_object(
      'storage_bucket', v_media.storage_bucket,
      'storage_path',   v_media.storage_path,
      'uploader_id',    v_media.uploader_id,
      'filesize',       v_media.filesize
    ),
    FALSE,
    'media.admin_removed'
  ) INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- admin_remove_media is already granted to authenticated in migration 010.
-- Rewriting the function body keeps the existing grant; no need to re-grant.

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX listing_photos_orphaned_idx ON public.listing_photos (orphaned_at)
  WHERE orphaned_at IS NOT NULL;

CREATE INDEX media_objects_path_idx ON public.media_objects (storage_path)
  WHERE storage_path IS NOT NULL;
