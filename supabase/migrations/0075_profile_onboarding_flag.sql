-- ============================================================================
-- 0075: Add onboarding_completed_at to profiles
-- Allows the server to remember that a user has completed FTUE so reinstalling
-- the app (which wipes AsyncStorage) does not send returning users back through
-- onboarding.
-- ============================================================================

alter table profiles
  add column if not exists onboarding_completed_at timestamptz default null;

-- RLS: the owning user may read and set their own flag.
-- (profiles already has "users can update their own row" policies from 0001/0057;
--  this column inherits those policies automatically.)
comment on column profiles.onboarding_completed_at is
  'Timestamp when the user completed first-time onboarding. NULL means not yet completed.';
