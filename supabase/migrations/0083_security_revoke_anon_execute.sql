-- Migration 0083: Revoke anon/PUBLIC EXECUTE from non-identity-helper RPCs
-- Identity helpers (auth.uid wrappers) intentionally stay public.
-- Business-logic RPCs should only be callable by authenticated users.

-- Revoke from anon and PUBLIC; re-grant to authenticated where needed.
REVOKE EXECUTE ON FUNCTION award_order_points FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_archived_meal_from_plans FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_cart_on_meal_status_change FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_gift_card_code FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION get_or_create_referral_code FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION meal_remaining_qty FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_followers_on_publish FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION top_preppers_ranked FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION update_customer_plan_timestamp FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION _hc_set_updated_at FROM anon, PUBLIC;

-- Keep identity helpers accessible (needed by RLS policies evaluated for anon):
-- has_role, is_admin, my_prepper_id, prepper_public_stats remain granted.

-- Re-grant business RPCs to authenticated role only:
GRANT EXECUTE ON FUNCTION award_order_points TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_archived_meal_from_plans TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_cart_on_meal_status_change TO authenticated;
GRANT EXECUTE ON FUNCTION generate_gift_card_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION meal_remaining_qty TO authenticated;
GRANT EXECUTE ON FUNCTION notify_followers_on_publish TO authenticated;
GRANT EXECUTE ON FUNCTION top_preppers_ranked TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_plan_timestamp TO authenticated;
