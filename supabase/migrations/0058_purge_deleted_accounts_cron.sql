-- ============================================================================
-- Preppa — Automated purge of soft-deleted accounts (completes 0057).
--
-- A daily pg_cron job finalizes deletion 30 days after the request. The schema
-- DELIBERATELY forbids hard-deleting a customer with orders (orders.customer_id
-- -> profiles is NO ACTION, profiles.id -> auth.users is CASCADE), to preserve
-- tax/accounting records. So this is an ANONYMIZATION purge, not a row delete:
--   • delete genuinely-personal data (addresses, carts, messages, notifications…)
--   • cancel any active subscriptions (stop future billing)
--   • retain orders / refunds / disputes / reviews, now pointing at a scrubbed profile
--   • neutralize the auth identity (tombstone email, wipe PII, permanent ban)
--
-- Grace period: an admin who restores the account (status -> active) before day 30
-- causes the request to be marked 'cancelled' instead of purged.
--
-- NOTE: prepper *business* records (prepper_profiles display name, meals) are not
-- anonymized here — prepper-account deletion needs its own handling. Additive.
-- ============================================================================

set check_function_bodies = off;

create or replace function purge_deleted_accounts()
  returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select adr.id as req_id, adr.user_id
    from account_deletion_requests adr
    where adr.status = 'pending'
      and adr.requested_at < now() - interval '30 days'
  loop
    -- Account restored during the grace window? Cancel the request, skip the purge.
    if (select status from profiles where id = r.user_id) is distinct from 'deleted' then
      update account_deletion_requests set status = 'cancelled', processed_at = now() where id = r.req_id;
      continue;
    end if;

    -- 1. Delete genuinely-personal data (not financial, not public marketplace content).
    delete from addresses                 where user_id     = r.user_id;
    delete from carts                     where user_id     = r.user_id;
    delete from notification_preferences  where user_id     = r.user_id;
    delete from notifications             where user_id     = r.user_id;
    delete from follows                   where follower_id = r.user_id;
    delete from conversation_participants where user_id     = r.user_id;
    delete from messages                  where sender_id   = r.user_id;
    delete from request_fraud_signals     where user_id     = r.user_id;
    delete from customer_meal_plans       where customer_id = r.user_id;
    delete from customer_memberships      where customer_id = r.user_id;
    delete from home_cook_requests        where customer_id = r.user_id;
    delete from experience_requests       where customer_id = r.user_id;
    delete from meal_requests             where customer_id = r.user_id;

    -- 2. Stop any future billing.
    update subscriptions set status = 'cancelled'
      where customer_id = r.user_id and status <> 'cancelled';

    -- 3. Anonymize the retained identity (orders/refunds/reviews inherit the scrub).
    update profiles set full_name = 'Deleted user', avatar_url = null, phone = null, email = null
      where id = r.user_id;

    -- 4. Neutralize the auth identity: strip PII + permanent ban (login impossible).
    update auth.users set
      email              = 'deleted+' || r.user_id::text || '@deleted.preppa.invalid',
      phone              = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until       = now() + interval '100 years'
      where id = r.user_id;

    -- 5. Close out the request.
    update account_deletion_requests set status = 'purged', processed_at = now() where id = r.req_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Cron-only: no client role should ever execute the purge.
revoke all on function purge_deleted_accounts() from public;

-- Daily at 04:17 UTC. cron.schedule upserts by jobname, so re-running is safe.
select cron.schedule('purge-deleted-accounts', '17 4 * * *', $cron$ select purge_deleted_accounts(); $cron$);
