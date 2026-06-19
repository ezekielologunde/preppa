-- Migration 0101: Create live_sessions table
-- Tracks prepper live-cooking sessions with viewer counts.

CREATE TABLE IF NOT EXISTS live_sessions (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prepper_id   uuid        NOT NULL REFERENCES prepper_profiles(id) ON DELETE CASCADE,
  title        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  viewer_count integer     NOT NULL DEFAULT 0,
  is_active    boolean
);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_sessions_public_read ON live_sessions;
CREATE POLICY live_sessions_public_read ON live_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS live_sessions_own_insert ON live_sessions;
CREATE POLICY live_sessions_own_insert ON live_sessions
  FOR INSERT
  WITH CHECK (prepper_id IN (
    SELECT id FROM prepper_profiles WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS live_sessions_own_update ON live_sessions;
CREATE POLICY live_sessions_own_update ON live_sessions
  FOR UPDATE
  USING (prepper_id IN (
    SELECT id FROM prepper_profiles WHERE user_id = auth.uid()
  ));
