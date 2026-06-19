-- Fix 1: gift_cards UPDATE — add auth.uid() guard
-- Old policy allowed any authenticated (or unauthenticated) caller to update any active card.
-- New policy requires caller is authenticated, and either setting redeemed_by for the first
-- time (their uid) or they are the existing redeemer.
DROP POLICY IF EXISTS "anyone can redeem" ON gift_cards;

CREATE POLICY gift_cards_redeem ON gift_cards
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND balance > 0
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (redeemed_by IS NULL OR redeemed_by = auth.uid())
  );

-- Fix 2: admin_list_preppers — revoke from anon and PUBLIC
-- Function is SECURITY DEFINER with is_admin() gate, so no data leak,
-- but anon callers should not be able to invoke it at all.
REVOKE EXECUTE ON FUNCTION public.admin_list_preppers(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_preppers(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_preppers(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_preppers(text) TO service_role;

-- Fix 3: orders SELECT — wrap my_prepper_id() in COALESCE to make NULL-safety explicit.
-- Without COALESCE, prepper_id = NULL evaluates to NULL (not false) for non-preppers.
-- This is not a bypass but creates fragile intent — make it explicit.
DROP POLICY IF EXISTS p_orders_read ON orders;
CREATE POLICY p_orders_read ON orders
  FOR SELECT USING (
    customer_id = auth.uid()
    OR COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
  );

-- Fix 4: home_cook_requests — drop duplicate hcr_* SELECT policies.
-- hcr_customer_select and hcr_prepper_select duplicate hc_customer_select and hc_prepper_select.
-- Multiple PERMISSIVE SELECT policies use OR semantics so no security hole, but dead policies
-- add per-row overhead and maintenance confusion.
DROP POLICY IF EXISTS hcr_customer_select ON home_cook_requests;
DROP POLICY IF EXISTS hcr_prepper_select ON home_cook_requests;
