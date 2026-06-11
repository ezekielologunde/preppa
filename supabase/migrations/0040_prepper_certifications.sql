-- 0040 — Creator profile depth: certifications array on prepper_profiles.
-- Preppers can list credentials (ServSafe, Culinary Certificate, Nutrition Coach,
-- etc.) that display as trust badges on their public profile — differentiating
-- creator identity from dietary/cuisine specialties.
alter table public.prepper_profiles
  add column if not exists certifications text[] not null default '{}';
