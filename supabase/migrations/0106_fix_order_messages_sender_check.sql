-- Fix sender spoofing on order_messages.
-- The ALL policy had no WITH CHECK, so a party to the order could INSERT
-- a message with sender_id = anyone else's uuid.
-- Split into explicit SELECT + INSERT policies so WITH CHECK only applies to writes.

DROP POLICY IF EXISTS "order parties can read/write messages" ON order_messages;

CREATE POLICY order_messages_read ON order_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_messages.order_id
        AND (o.customer_id = auth.uid() OR COALESCE(o.prepper_id = my_prepper_id(), false))
    )
    OR COALESCE(is_admin(), false)
  );

CREATE POLICY order_messages_insert ON order_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_messages.order_id
        AND (o.customer_id = auth.uid() OR COALESCE(o.prepper_id = my_prepper_id(), false))
    )
  );
