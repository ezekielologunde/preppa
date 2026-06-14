-- ============================================================================
-- Preppa — Self-service account deletion (App Store 5.1.1(v) / Play Store req.)
--
-- SOFT-DELETE model (additive, re-runnable):
--   request_account_deletion() flips the caller's profiles.status -> 'deleted'
--   immediately (the account can no longer be used — enforced by the client auth
--   gate) and records a durable audit row with the exit-survey reason.
--
-- The hard PII purge + auth.users removal is intentionally a SEPARATE, policy-
-- governed downstream step (kept out of this RPC) so order/payment financial
-- records are retained through the legal/accounting window. Apple/Google accept
-- "deletion initiated immediately, fully processed within 30 days".
-- ============================================================================

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Audit trail — one row per deletion request (admin-reviewable, user-visible).
-- ----------------------------------------------------------------------------
create table if not exists account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text,
  note         text,
  status       text not null default 'pending',  -- pending -> purged | cancelled
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_deletion_requests_user   on account_deletion_requests(user_id);
create index if not exists idx_deletion_requests_status on account_deletion_requests(status);

alter table account_deletion_requests enable row level security;
drop policy if exists p_deletion_read on account_deletion_requests;
-- A user can read their own request; admins read all. There is NO client INSERT
-- path — rows are created only through the SECURITY DEFINER RPC below.
create policy p_deletion_read on account_deletion_requests
  for select using (user_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- Self-service deletion RPC — deactivate own account + log the request.
-- ----------------------------------------------------------------------------
create or replace function request_account_deletion(p_reason text default null, p_note text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- Deactivate immediately. Reversible by an admin within the retention window
  -- (admin_set_user_status -> 'active'); the client auth gate blocks use meanwhile.
  update profiles set status = 'deleted' where id = v_uid;

  -- Stop billing now — don't charge a deleting customer through the grace window.
  update subscriptions set status = 'cancelled' where customer_id = v_uid and status <> 'cancelled';

  insert into account_deletion_requests (user_id, reason, note)
  values (v_uid, nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''));

  -- Best-effort analytics breadcrumb (never block deletion on it).
  begin
    perform record_event('account_deletion_requested',
      json_build_object('reason', p_reason, 'note', p_note)::jsonb);
  exception when others then null;
  end;
end $$;

revoke all on function request_account_deletion(text, text) from public;
grant execute on function request_account_deletion(text, text) to authenticated;
-- Supabase default-grants new functions to anon too; deletion is for signed-in
-- users only, so strip anon (the body self-guards on auth.uid() anyway).
revoke execute on function request_account_deletion(text, text) from anon;

-- All writes go through the SECURITY DEFINER RPC above (runs as owner), so no
-- client role needs table DML. Keep only authenticated SELECT for the read policy.
revoke all    on table account_deletion_requests from anon;
revoke insert, update, delete on table account_deletion_requests from authenticated;
