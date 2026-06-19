-- 0114 — Bank account number encryption for payout_requests.
-- account_number stays for backwards-compat but is deprecated and comment-marked.
-- New columns: account_number_encrypted (pgcrypto) + account_number_masked (****1234).
-- Admins decrypt via admin_get_account_number() RPC only.
-- app.encryption_key must be set as a DB config var (Supabase Vault recommended).

create extension if not exists pgcrypto;

-- Add encrypted + masked columns
alter table payout_requests
  add column if not exists account_number_encrypted bytea,
  add column if not exists account_number_masked    text;

-- Encrypt existing rows if the key is available
do $$
declare
  v_key text;
  r     record;
begin
  v_key := current_setting('app.encryption_key', true);
  if v_key is null or v_key = '' then
    raise warning 'app.encryption_key not set — skipping historical account_number encryption. Set the key and re-run the backfill manually.';
    return;
  end if;
  for r in select id, account_number from payout_requests where account_number is not null loop
    update payout_requests
    set
      account_number_encrypted = pgp_sym_encrypt(r.account_number, v_key),
      account_number_masked    = '****' || right(r.account_number, 4)
    where id = r.id;
  end loop;
end;
$$;

-- Admin-only RPC to decrypt a single payout request's account number
create or replace function admin_get_account_number(p_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_encrypted bytea;
  v_key       text;
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;

  select account_number_encrypted into v_encrypted
  from payout_requests where id = p_request_id;

  if v_encrypted is null then
    -- Fallback: return plaintext for rows not yet migrated
    return (select account_number from payout_requests where id = p_request_id);
  end if;

  v_key := current_setting('app.encryption_key');
  return pgp_sym_decrypt(v_encrypted, v_key);
end;
$$;

revoke all on function admin_get_account_number(uuid) from public, anon, authenticated;
grant execute on function admin_get_account_number(uuid) to service_role;

-- Deprecate plaintext column — drop in a future migration after verifying full encryption
comment on column payout_requests.account_number is
  'DEPRECATED: use account_number_encrypted + account_number_masked. Will be dropped after full data migration.';
comment on column payout_requests.account_number_masked is
  'Safe-to-display mask (e.g. ****1234). Use for all UI display.';
comment on column payout_requests.account_number_encrypted is
  'pgcrypto-encrypted account number. Decrypt via admin_get_account_number() RPC only.';
