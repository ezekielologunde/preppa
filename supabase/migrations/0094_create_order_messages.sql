-- Migration 0094: Create order_messages table
-- Enables in-app messaging between customer and prepper on a given order.

CREATE TABLE IF NOT EXISTS order_messages (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id   uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order parties can read/write messages" ON order_messages;
CREATE POLICY "order parties can read/write messages" ON order_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_messages.order_id
      AND (o.customer_id = auth.uid() OR o.prepper_id = auth.uid())
  ));
