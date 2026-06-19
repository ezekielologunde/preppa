-- Rate-limit events table used by edge functions to enforce per-user request caps.
-- Events older than 10 minutes are irrelevant and should be pruned by the cleanup helper.

create table if not exists rate_limit_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on rate_limit_events(user_id, action, created_at desc);

-- Cleanup function — prunes events older than 10 minutes.
-- Called opportunistically from edge functions via cleanupRateLimits().
create or replace function cleanup_old_rate_limit_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limit_events where created_at < now() - interval '10 minutes';
$$;

-- Only service_role (used by edge functions) may read/write this table.
alter table rate_limit_events enable row level security;

-- No user-facing RLS policies — edge functions run as service_role and bypass RLS.
-- Explicit denial for anon/authenticated so the table is never accidentally exposed.
create policy "deny all non-service access"
  on rate_limit_events
  for all
  using (false);
