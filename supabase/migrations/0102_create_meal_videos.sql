-- Migration 0102: Create meal_videos table
-- Stores short video clips attached to meals for the TikTok-style feed.

CREATE TABLE IF NOT EXISTS meal_videos (
  id            uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id       uuid    NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  video_url     text    NOT NULL,
  thumbnail_url text,
  duration_sec  integer
);

ALTER TABLE meal_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_vid_read ON meal_videos;
CREATE POLICY p_vid_read ON meal_videos
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND (m.status = 'published'::meal_status
        OR m.prepper_id = my_prepper_id()
        OR is_admin())
  ));

DROP POLICY IF EXISTS p_vid_insert ON meal_videos;
CREATE POLICY p_vid_insert ON meal_videos
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND m.prepper_id = my_prepper_id()
  ));

DROP POLICY IF EXISTS p_vid_update ON meal_videos;
CREATE POLICY p_vid_update ON meal_videos
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id AND m.prepper_id = my_prepper_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id AND m.prepper_id = my_prepper_id()
  ));

DROP POLICY IF EXISTS p_vid_delete ON meal_videos;
CREATE POLICY p_vid_delete ON meal_videos
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id AND m.prepper_id = my_prepper_id()
  ));
