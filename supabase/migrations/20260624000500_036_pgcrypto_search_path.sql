-- ── 036 pgcrypto_search_path ──────────────────────────────────────────────────
-- Sprint 30 P0 (discovered while integration-testing create_order): the entire
-- escrow PIN system was broken in production.
--
-- set_order_pin() and verify_order_pin() (migrations 030/033) call pgcrypto
-- functions gen_random_bytes / crypt / gen_salt, but were declared with
-- `SET search_path = public`. On Supabase, pgcrypto is installed in the
-- `extensions` schema, which `public`-only search_path cannot see — so every
-- PIN issue and verification threw `function gen_random_bytes(integer) does not
-- exist`. No order could ever be confirmed and no escrow could ever release.
--
-- Fix: add `extensions` to the search_path of both functions. ALTER FUNCTION ...
-- SET is sufficient — no body change needed — and keeps `public` first so all
-- existing unqualified app-table references continue to resolve correctly.

ALTER FUNCTION public.set_order_pin(UUID)          SET search_path = public, extensions;
ALTER FUNCTION public.verify_order_pin(UUID, TEXT) SET search_path = public, extensions;
