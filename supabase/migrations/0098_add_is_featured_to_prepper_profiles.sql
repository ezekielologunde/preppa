-- Migration 0098: Add is_featured / featured_at to prepper_profiles
-- Admins can feature preppers on the discovery homepage.

ALTER TABLE prepper_profiles
  ADD COLUMN IF NOT EXISTS is_featured boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_at timestamptz;
