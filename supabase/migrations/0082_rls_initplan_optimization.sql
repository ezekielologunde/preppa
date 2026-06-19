-- Migration 0082: RLS initplan optimization
-- Replace auth.uid() with (SELECT auth.uid()) in RLS policies to use
-- Postgres initplan caching, reducing per-row function calls.
-- Affects: addresses, cart_items, notifications, order_items, payments, prepper_profiles

-- addresses
DROP POLICY IF EXISTS p_addresses_all ON addresses;
CREATE POLICY p_addresses_all ON addresses
  FOR ALL
  USING ((user_id = (SELECT auth.uid() AS uid)) OR is_admin())
  WITH CHECK (user_id = (SELECT auth.uid() AS uid));

-- cart_items
DROP POLICY IF EXISTS p_cart_items ON cart_items;
CREATE POLICY p_cart_items ON cart_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM carts c
    WHERE c.id = cart_items.cart_id
      AND c.user_id = (SELECT auth.uid() AS uid)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM carts c
    WHERE c.id = cart_items.cart_id
      AND c.user_id = (SELECT auth.uid() AS uid)
  ));

-- notifications
DROP POLICY IF EXISTS p_notifications_read ON notifications;
CREATE POLICY p_notifications_read ON notifications
  FOR SELECT
  USING (user_id = (SELECT auth.uid() AS uid));

DROP POLICY IF EXISTS p_notifications_update ON notifications;
CREATE POLICY p_notifications_update ON notifications
  FOR UPDATE
  USING (user_id = (SELECT auth.uid() AS uid));

-- order_items
DROP POLICY IF EXISTS p_order_items_read ON order_items;
CREATE POLICY p_order_items_read ON order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (o.customer_id = (SELECT auth.uid() AS uid)
        OR o.prepper_id = my_prepper_id()
        OR is_admin())
  ));

-- payments
DROP POLICY IF EXISTS p_payments_read ON payments;
CREATE POLICY p_payments_read ON payments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = payments.order_id
      AND (o.customer_id = (SELECT auth.uid() AS uid)
        OR o.prepper_id = my_prepper_id()
        OR is_admin())
  ));

-- prepper_profiles
DROP POLICY IF EXISTS p_prepper_insert ON prepper_profiles;
CREATE POLICY p_prepper_insert ON prepper_profiles
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid() AS uid));

DROP POLICY IF EXISTS p_prepper_update ON prepper_profiles;
CREATE POLICY p_prepper_update ON prepper_profiles
  FOR UPDATE
  USING ((user_id = (SELECT auth.uid() AS uid)) OR is_admin());
