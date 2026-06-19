-- Migration 0097: Add lat/lng coordinates to prepper_profiles
-- Enables proximity-based prepper discovery.

ALTER TABLE prepper_profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
