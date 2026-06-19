-- Migration 0088: Add granular notification preference columns
-- Extends notification_preferences with per-category toggles
-- and a master push_enabled switch.

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS order_updates  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_followers  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meal_drops     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS promotions     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bid_updates    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS prepper_news   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled   boolean NOT NULL DEFAULT true;
