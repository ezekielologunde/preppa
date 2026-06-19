-- ============================================================================
-- Preppa — Prepper profile editor fields (0081)
-- Adds tagline, cover_url, cuisine_type to prepper_profiles so preppers can
-- fully manage their kitchen identity after onboarding.
-- ============================================================================

alter table public.prepper_profiles
  add column if not exists tagline     text        default null,
  add column if not exists cover_url   text        default null,
  add column if not exists cuisine_type text       default null;

comment on column public.prepper_profiles.tagline      is 'Short one-liner shown in search results cards.';
comment on column public.prepper_profiles.cover_url    is 'Full-width kitchen cover photo (public URL).';
comment on column public.prepper_profiles.cuisine_type is 'Primary cuisine category (e.g. Nigerian, Caribbean).';
