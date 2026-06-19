-- Migration 0112: Idempotency table for Stripe webhook event processing
-- Prevents double-processing on Stripe retry (edge function checks this before handling).

BEGIN;

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id     text        PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — only writable by service role (edge function via service key).
-- Anon/authenticated roles have no access by design.

COMMIT;
