-- Add allergen and ingredient fields to meals.
-- Calories already live in nutrition_profiles; prep_time_min already exists.
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS allergens  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}';
