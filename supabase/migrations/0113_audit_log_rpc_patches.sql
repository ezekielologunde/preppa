-- 0113 — Patch sensitive RPCs to emit audit log entries.
-- Recreates three functions from earlier migrations, adding a
-- write_audit_log() call at the end of each sensitive operation.
-- Original behaviour is unchanged; only the audit tail is added.

-- --------------------------------------------------------------------------
-- 1. admin_set_prepper_status  (originally 0004)
-- --------------------------------------------------------------------------
create or replace function admin_set_prepper_status(
  p_prepper uuid,
  p_status  prepper_status,
  p_note    text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_status prepper_status;
begin
  if not is_admin() then raise exception 'Admin only'; end if;

  select status into v_old_status from prepper_profiles where id = p_prepper;

  update prepper_profiles set
    status         = p_status,
    verified       = (p_status = 'approved'),
    reviewed_by    = auth.uid(),
    reviewed_at    = now(),
    rejection_note = case when p_status = 'rejected' then p_note else null end
  where id = p_prepper;

  if not found then raise exception 'Prepper not found'; end if;

  perform write_audit_log(
    'admin.set_prepper_status',
    auth.uid(),
    'prepper_profiles',
    p_prepper::text,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status, 'note', p_note)
  );
end $$;

grant execute on function admin_set_prepper_status(uuid, prepper_status, text) to authenticated;

-- --------------------------------------------------------------------------
-- 2. admin_resolve_dispute  (originally 0043)
-- --------------------------------------------------------------------------
create or replace function admin_resolve_dispute(
  p_dispute    uuid,
  p_resolution text,
  p_note       text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old_status text;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  if p_resolution not in ('resolved', 'dismissed') then
    raise exception 'Resolution must be resolved or dismissed';
  end if;

  select status into v_old_status from order_disputes where id = p_dispute;

  update order_disputes
    set status      = p_resolution,
        admin_note  = p_note,
        resolved_at = now()
    where id = p_dispute;

  if not found then raise exception 'Dispute not found'; end if;

  perform write_audit_log(
    'admin.resolve_dispute',
    auth.uid(),
    'order_disputes',
    p_dispute::text,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_resolution, 'note', p_note)
  );
end $$;

revoke all on function admin_resolve_dispute(uuid, text, text) from public, anon;
grant execute on function admin_resolve_dispute(uuid, text, text) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 3. request_account_deletion  (originally 0057)
-- --------------------------------------------------------------------------
create or replace function request_account_deletion(
  p_reason text default null,
  p_note   text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update profiles set status = 'deleted' where id = v_uid;

  update subscriptions
    set status = 'cancelled'
    where customer_id = v_uid and status <> 'cancelled';

  insert into account_deletion_requests (user_id, reason, note)
  values (v_uid, nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''));

  -- Best-effort analytics breadcrumb
  begin
    perform record_event('account_deletion_requested',
      json_build_object('reason', p_reason, 'note', p_note)::jsonb);
  exception when others then null;
  end;

  -- Best-effort audit log (never block deletion on it)
  begin
    perform write_audit_log(
      'account.deletion_requested',
      v_uid,
      'profiles',
      v_uid::text,
      null,
      jsonb_build_object('reason', p_reason)
    );
  exception when others then null;
  end;
end $$;

revoke all on function request_account_deletion(text, text) from public;
grant execute on function request_account_deletion(text, text) to authenticated;
revoke execute on function request_account_deletion(text, text) from anon;
