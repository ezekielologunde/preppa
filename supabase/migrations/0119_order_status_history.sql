-- Migration 0114: Order status transition history
-- Records every status change on an order for dispute resolution and chargebacks.
-- Populated exclusively by SECURITY DEFINER RPCs (advance_order, cancel_order) —
-- no direct INSERT policy so callers cannot fabricate history.

BEGIN;

CREATE TABLE IF NOT EXISTS order_status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status   text        NOT NULL,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history(order_id, created_at DESC);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Customers can view status history for their own orders.
DROP POLICY IF EXISTS "Customers can view own order status history" ON order_status_history;
CREATE POLICY "Customers can view own order status history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history.order_id
        AND o.customer_id = auth.uid()
    )
  );

-- Preppers can view status history for orders assigned to them.
DROP POLICY IF EXISTS "Preppers can view their order status history" ON order_status_history;
CREATE POLICY "Preppers can view their order status history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history.order_id
        AND o.prepper_id = my_prepper_id()
    )
  );

-- Admins can view all history.
DROP POLICY IF EXISTS "Admins can view all order status history" ON order_status_history;
CREATE POLICY "Admins can view all order status history"
  ON order_status_history FOR SELECT
  USING (is_admin());

COMMIT;
