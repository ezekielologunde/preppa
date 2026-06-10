-- ============================================================================
-- 0024 — Pickup/Meet-up handoff verification (anti-fraud). Each pickup/meetup
-- order gets a 4-digit PIN + a single-use QR token. The cook can only mark the
-- order complete by (a) entering the customer's PIN, or (b) scanning the
-- customer's QR — both prove the right person is collecting. PIN entry is
-- attempt-capped (5) to stop brute force; QR is the secure fallback.
--   • order_handoff: pin + token + attempts + verified_at. Customer-read RLS
--     only (cooks never see the PIN — they get it from the customer or scan).
--   • create_order: mints a handoff for pickup/meetup orders.
--   • guard_handoff_completion: BEFORE UPDATE trigger blocks *->completed for
--     pickup/meetup unless verified (works regardless of path).
--   • verify_handoff(order, pin): cook enters digits, attempt-capped, completes.
--   • verify_handoff_token(token): cook scans QR (/verify?t=) → completes.
-- See the deployed function bodies for the full logic.
-- ============================================================================

create table if not exists order_handoff (
  order_id    uuid primary key references orders(id) on delete cascade,
  pin         text not null,
  token       uuid not null default gen_random_uuid(),
  attempts    int  not null default 0,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists order_handoff_token_idx on order_handoff(token);

alter table order_handoff enable row level security;
drop policy if exists p_handoff_customer_read on order_handoff;
create policy p_handoff_customer_read on order_handoff for select to authenticated
  using (exists (select 1 from orders o where o.id = order_handoff.order_id and o.customer_id = auth.uid()));

-- create_order, guard_handoff_completion, verify_handoff, verify_handoff_token:
-- applied verbatim via the migration runner / Supabase apply_migration. The
-- canonical bodies live in the database; this file documents the schema + RLS.
-- (Full bodies omitted here for brevity — see migration history in Supabase.)
