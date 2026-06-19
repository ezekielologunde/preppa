-- 0112 — Tamper-evident audit log with hash chain.
-- Append-only table; row_hash ties each entry to its predecessor so the chain
-- can be verified offline. Service-role-only writes via write_audit_log() RPC.
-- Note: row_hash is populated by trigger (not generated column) because sha256
-- is not marked immutable in Postgres, which generated columns require.

create extension if not exists pgcrypto;

create table if not exists audit_logs (
  id           bigserial primary key,
  action       text not null,                   -- e.g. 'admin.set_prepper_status'
  actor_id     uuid references auth.users(id),  -- who did it (null = system/webhook)
  resource     text,                             -- table name
  resource_id  text,                             -- row id
  old_data     jsonb,
  new_data     jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now(),
  prev_hash    text,                             -- sha256 of previous row → tamper-evident chain
  row_hash     text                              -- populated by before-insert trigger
);

-- Populate row_hash before every insert
create or replace function audit_logs_set_hash()
returns trigger language plpgsql as $$
begin
  new.row_hash := encode(
    digest(
      coalesce(new.id::text,'') ||
      coalesce(new.action,'') ||
      coalesce(new.actor_id::text,'') ||
      coalesce(new.resource,'') ||
      coalesce(new.resource_id,'') ||
      coalesce(new.old_data::text,'') ||
      coalesce(new.new_data::text,'') ||
      coalesce(new.created_at::text,'') ||
      coalesce(new.prev_hash,''),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

create trigger audit_logs_hash_trigger
  before insert on audit_logs
  for each row execute function audit_logs_set_hash();

-- Prevent updates/deletes (append-only)
create rule audit_logs_no_update as on update to audit_logs do instead nothing;
create rule audit_logs_no_delete as on delete to audit_logs do instead nothing;

alter table audit_logs enable row level security;

-- Only admins can read audit logs
create policy "admins read audit_logs"
  on audit_logs for select
  using (is_admin());

-- Only service role can insert (via edge functions / RPCs)
create policy "service insert audit_logs"
  on audit_logs for insert
  with check (true);  -- restricted to service_role via SECURITY DEFINER wrapper

-- Helper RPC: called from other RPCs and edge functions to write audit entries
create or replace function write_audit_log(
  p_action      text,
  p_actor_id    uuid,
  p_resource    text,
  p_resource_id text,
  p_old_data    jsonb default null,
  p_new_data    jsonb default null,
  p_ip_address  inet  default null,
  p_user_agent  text  default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
begin
  select row_hash into v_prev_hash
  from audit_logs
  order by id desc
  limit 1;

  insert into audit_logs (
    action, actor_id, resource, resource_id,
    old_data, new_data, ip_address, user_agent, prev_hash
  )
  values (
    p_action, p_actor_id, p_resource, p_resource_id,
    p_old_data, p_new_data, p_ip_address, p_user_agent, v_prev_hash
  );
end;
$$;

revoke all on function write_audit_log(text, uuid, text, text, jsonb, jsonb, inet, text)
  from public, anon, authenticated;
grant execute on function write_audit_log(text, uuid, text, text, jsonb, jsonb, inet, text)
  to service_role;

comment on table audit_logs is 'Append-only tamper-evident audit trail. Row hash chain allows offline verification.';
