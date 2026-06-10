-- ============================================================================
-- 0021 — Security hardening from the Supabase advisor sweep (WARN-level,
-- defense in depth): revoke anon EXECUTE on user/admin action RPCs (each
-- re-checks auth internally), make trigger functions non-RPC-callable, and
-- pin search_path on our flagged functions. RLS policy helpers (is_admin,
-- has_role, my_prepper_id, is_conversation_member) keep EXECUTE because
-- policies evaluate them for anon reads.
-- NOTE: superseded in part by 0022 — Postgres grants EXECUTE to PUBLIC on
-- creation, so revoking only `anon` was not sufficient.
-- ============================================================================

revoke execute on function accept_experience_bid(uuid) from anon;
revoke execute on function admin_grant_role(uuid, text) from anon;
revoke execute on function admin_platform_stats() from anon;
revoke execute on function admin_prepper_earnings() from anon;
revoke execute on function admin_revoke_role(uuid, text) from anon;
revoke execute on function admin_set_feature_flag(text, boolean) from anon;
revoke execute on function admin_set_prepper_status(uuid, prepper_status, text) from anon;
revoke execute on function admin_set_user_status(uuid, user_status) from anon;
revoke execute on function advance_order(uuid, order_status) from anon;
revoke execute on function cancel_order(uuid) from anon;
revoke execute on function create_order(fulfillment_type, uuid, text, numeric) from anon;
revoke execute on function mark_conversation_read(uuid) from anon;
revoke execute on function start_conversation(uuid) from anon;
revoke execute on function recompute_prepper_rating(uuid) from anon;
revoke execute on function recompute_prepper_rating(uuid) from authenticated;

revoke execute on function guard_certification() from anon, authenticated;
revoke execute on function guard_kitchen() from anon, authenticated;
revoke execute on function guard_prepper_profile() from anon, authenticated;
revoke execute on function handle_new_user() from anon, authenticated;
revoke execute on function trg_review_rating() from anon, authenticated;
revoke execute on function rls_auto_enable() from anon, authenticated;
revoke execute on function set_updated_at() from anon, authenticated;
revoke execute on function guard_review_update() from anon, authenticated;

alter function set_updated_at() set search_path = public;
alter function guard_review_update() set search_path = public;
