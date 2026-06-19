-- Migration 0104: Add editor fields to prepper_profiles (2026-06-18 version)
-- Adds tagline, cover_url, and cuisine_type for the prepper profile editor UI.
-- (Earlier partial version may exist in 0081; this is the confirmed live state.)

ALTER TABLE prepper_profiles
  ADD COLUMN IF NOT EXISTS tagline      text,
  ADD COLUMN IF NOT EXISTS cover_url    text,
  ADD COLUMN IF NOT EXISTS cuisine_type text;
