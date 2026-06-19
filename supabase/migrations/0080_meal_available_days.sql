ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS available_days text[] DEFAULT NULL;
