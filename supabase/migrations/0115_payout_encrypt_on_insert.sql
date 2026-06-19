-- 0115 — Auto-encrypt account_number on payout_requests insert.
-- Trigger fires on every insert: reads app.encryption_key, writes
-- account_number_encrypted and account_number_masked, then clears
-- the plaintext account_number so it is never persisted.

create or replace function payout_requests_encrypt_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_key text;
begin
  if new.account_number is null then
    return new;
  end if;

  -- Set masked value always (doesn't require the key)
  new.account_number_masked := '****' || right(new.account_number, 4);

  -- Encrypt if the key is configured
  v_key := current_setting('app.encryption_key', true);
  if v_key is not null and v_key <> '' then
    new.account_number_encrypted := pgp_sym_encrypt(new.account_number, v_key);
    -- Clear plaintext so it is not stored
    new.account_number := null;
  end if;

  return new;
end;
$$;

drop trigger if exists payout_requests_encrypt_trigger on payout_requests;
create trigger payout_requests_encrypt_trigger
  before insert on payout_requests
  for each row execute function payout_requests_encrypt_account();
