-- Migration 0090: Add cook_schedule to prepper_profiles
-- Stores a structured schedule (jsonb) of when a prepper cooks.
-- Example shape: { "mon": ["11:00","14:00"], "fri": ["17:00","20:00"] }

ALTER TABLE prepper_profiles
  ADD COLUMN IF NOT EXISTS cook_schedule jsonb;
