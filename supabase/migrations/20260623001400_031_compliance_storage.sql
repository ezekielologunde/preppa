-- ── 031 compliance_storage ────────────────────────────────────────────────────
-- Creates a PRIVATE bucket for prepper application documents:
--   kitchen photos, food safety certificates, and future compliance attachments.
--
-- Security model:
--   - Bucket is NOT public — no CDN URL can expose documents without a signed URL
--   - File path must start with auth.uid() — enforced at RLS, not just convention
--   - Tier 1+ admins can read all documents for application review
--   - service_role bypasses all policies (edge functions, pg_cron, admin console)
--
-- Path structure:
--   {user_id}/kitchen-{uuid}.jpg    — kitchen application photos
--   {user_id}/food-safety-cert.pdf  — food hygiene certificate

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-docs',
  'compliance-docs',
  false,          -- private: no anonymous CDN access
  5242880,        -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── Applicant: upload own documents ───────────────────────────────────────────
-- Requires the first path segment to equal the caller's user ID.
-- Prevents any user from uploading into another user's path.

CREATE POLICY "compliance_docs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::TEXT = (storage.foldername(name))[1]
);

-- ── Applicant: read own documents (needed for Review step preview) ─────────────

CREATE POLICY "compliance_docs_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::TEXT = (storage.foldername(name))[1]
);

-- ── Applicant: replace own document (cert re-upload, photo swap) ───────────────

CREATE POLICY "compliance_docs_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::TEXT = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND auth.uid() IS NOT NULL
  AND auth.uid()::TEXT = (storage.foldername(name))[1]
);

-- ── Admin Tier 1+: read all documents for application review ───────────────────
-- Uses the same JWT metadata pattern as admin_tier() from migration 029.

CREATE POLICY "compliance_docs_select_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  AND (auth.jwt() -> 'app_metadata' ->> 'tier')::INTEGER >= 1
);

-- ── service_role: full bypass for edge functions and pg_cron ──────────────────

CREATE POLICY "compliance_docs_service_role"
ON storage.objects FOR ALL TO service_role
USING  (bucket_id = 'compliance-docs')
WITH CHECK (bucket_id = 'compliance-docs');
