-- Migration 0096: Add dietary_tags array column to meals
-- Stores dietary labels (e.g. 'vegan', 'gluten-free') as a text array.

ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS dietary_tags text[];
