-- Migration 0105: Add available_days to meals
-- Text array of days when this meal is offered.
-- Example: ARRAY['monday','wednesday','friday']

ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS available_days text[];
