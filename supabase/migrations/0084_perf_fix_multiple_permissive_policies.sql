-- Migration 0084: Consolidate duplicate PERMISSIVE policies (first pass)
-- Multiple PERMISSIVE policies on the same table/command are OR-ed together
-- by Postgres, causing redundant evaluations. This migration consolidates
-- the first set of affected tables by dropping overlapping policies and
-- replacing with single canonical policies per command.
--
-- NOTE: This migration was applied directly to the live DB on 2026-06-18.
-- The exact set of policies consolidated is captured in pg_policies as of
-- that date. The live DB state (post-migration) is authoritative; this file
-- is the replay/documentation artifact.
--
-- Affected tables (first pass): meal_videos had duplicate read/write policies
-- (meal_videos_owner_* duplicated by p_vid_* policies — old set dropped).

DROP POLICY IF EXISTS meal_videos_owner_delete ON meal_videos;
DROP POLICY IF EXISTS meal_videos_owner_insert ON meal_videos;
DROP POLICY IF EXISTS meal_videos_public_read  ON meal_videos;
