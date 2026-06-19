-- Migration 0092: Create reward_points table
-- Ledger of points earned per user per order.

CREATE TABLE IF NOT EXISTS reward_points (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id   uuid        REFERENCES orders(id) ON DELETE SET NULL,
  points     integer     NOT NULL,
  reason     text        NOT NULL DEFAULT 'order',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reward_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own points" ON reward_points;
CREATE POLICY "users see own points" ON reward_points
  FOR SELECT
  USING (user_id = auth.uid());
