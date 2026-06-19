-- Migration 0113: Admin audit log
-- Records every admin action with before/after state — required for SOC 2 and
-- dispute resolution. INSERT is exclusively via SECURITY DEFINER functions so
-- the log cannot be tampered with by callers.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       text        NOT NULL,
  target_type  text        NOT NULL,
  target_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON admin_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON admin_audit_log(target_type, target_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log; no direct INSERT/UPDATE/DELETE policy —
-- all writes must go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Admins can view audit log" ON admin_audit_log;
CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (is_admin());

COMMIT;
