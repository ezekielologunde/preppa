-- Migration 0087: Add prepper reply fields to reviews
-- Allows preppers to respond to customer reviews.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS prepper_reply text,
  ADD COLUMN IF NOT EXISTS replied_at    timestamptz;
