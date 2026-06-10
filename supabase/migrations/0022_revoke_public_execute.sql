-- ============================================================================
-- 0022 — Complete the RPC lockdown: Postgres grants EXECUTE to PUBLIC on
-- function creation, so 0021's anon-only revokes left every RPC callable by
-- anon through the PUBLIC grant (verified: anon got 200 from
-- admin_platform_stats, albeit with a null body). Revoke PUBLIC and grant
-- back exactly the roles each function serves. Verified after: anon → 401 on
-- action RPCs; anon reads (meals, flags, preppers, rating embeds) intact;
-- authenticated app paths intact.
-- ============================================================================

do $$
declare
  fn text;
  user_fns text[] := array[
    'accept_experience_bid(uuid)',
    'admin_grant_role(uuid, text)',
    'admin_platform_stats()',
    'admin_prepper_earnings()',
    'admin_revoke_role(uuid, text)',
    'admin_set_feature_flag(text, boolean)',
    'admin_set_prepper_status(uuid, prepper_status, text)',
    'admin_set_user_status(uuid, user_status)',
    'advance_order(uuid, order_status)',
    'cancel_order(uuid)',
    'create_order(fulfillment_type, uuid, text, numeric)',
    'mark_conversation_read(uuid)',
    'start_conversation(uuid)',
    'my_prepper_earnings()'
  ];
  internal_fns text[] := array[
    'guard_certification()',
    'guard_kitchen()',
    'guard_prepper_profile()',
    'handle_new_user()',
    'trg_review_rating()',
    'rls_auto_enable()',
    'set_updated_at()',
    'guard_review_update()',
    'recompute_prepper_rating(uuid)'
  ];
begin
  foreach fn in array user_fns loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
  foreach fn in array internal_fns loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end $$;
