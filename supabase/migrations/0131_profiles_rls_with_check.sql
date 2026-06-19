-- Migration 0131: Harden profiles UPDATE policy with explicit WITH CHECK.
--
-- The original policy (0001) only has a USING clause:
--   create policy p_profiles_update on profiles for update using (id = auth.uid())
-- PostgreSQL applies USING as the post-update check when WITH CHECK is absent,
-- but explicit WITH CHECK documents intent and guards against id manipulation.
--
-- Status/role transitions are owned by SECURITY DEFINER admin RPCs (which bypass
-- RLS) — direct client UPDATE of status is blocked here.

BEGIN;

DROP POLICY IF EXISTS p_profiles_update ON profiles;

CREATE POLICY p_profiles_update ON profiles
  FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMIT;
