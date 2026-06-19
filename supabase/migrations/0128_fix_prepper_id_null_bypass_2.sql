-- ============================================================================
-- 0124 — SECURITY: Wrap my_prepper_id() comparisons in COALESCE (batch 2/2).
--
-- Continuation of 0123. Fixes remaining policies in:
--   meal_plans        (originally 0006)
--   order_items       (originally 0082)
--   payments          (originally 0082)
--   meal_videos       (originally 0102)
--   order_status_history (originally 0119)
--
-- See 0123 for full background.
-- ============================================================================

BEGIN;

-- ── meal_plans SELECT (from 0006) ─────────────────────────────────────────────
-- Published/active plans visible to all; prepper sees their own.
DROP POLICY IF EXISTS p_meal_plans_read ON meal_plans;
CREATE POLICY p_meal_plans_read ON meal_plans
  FOR SELECT
  USING (
    active
    OR COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
  );

-- ── meal_plans ALL (from 0006) ────────────────────────────────────────────────
DROP POLICY IF EXISTS p_meal_plans_write ON meal_plans;
CREATE POLICY p_meal_plans_write ON meal_plans
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (
    COALESCE(prepper_id = my_prepper_id(), false)
    AND EXISTS (
      SELECT 1 FROM prepper_profiles pp
      WHERE pp.id = prepper_id AND pp.status = 'approved'
    )
  );

-- ── order_items SELECT (from 0082) ────────────────────────────────────────────
-- Customers see their own order items; preppers see items on their orders.
DROP POLICY IF EXISTS p_order_items_read ON order_items;
CREATE POLICY p_order_items_read ON order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        o.customer_id = (SELECT auth.uid())
        OR COALESCE(o.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

-- ── payments SELECT (from 0082) ───────────────────────────────────────────────
DROP POLICY IF EXISTS p_payments_read ON payments;
CREATE POLICY p_payments_read ON payments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = payments.order_id
      AND (
        o.customer_id = (SELECT auth.uid())
        OR COALESCE(o.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

-- ── meal_videos policies (from 0102) ─────────────────────────────────────────
-- p_vid_read: published videos visible to all; preppers see their own drafts.
DROP POLICY IF EXISTS p_vid_read ON meal_videos;
CREATE POLICY p_vid_read ON meal_videos
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND (
        m.status = 'published'::meal_status
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

-- p_vid_insert: only the owning prepper can attach videos to their meals.
DROP POLICY IF EXISTS p_vid_insert ON meal_videos;
CREATE POLICY p_vid_insert ON meal_videos
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- p_vid_update: only the owning prepper can update their meal's videos.
DROP POLICY IF EXISTS p_vid_update ON meal_videos;
CREATE POLICY p_vid_update ON meal_videos
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- p_vid_delete: only the owning prepper can delete their meal's videos.
DROP POLICY IF EXISTS p_vid_delete ON meal_videos;
CREATE POLICY p_vid_delete ON meal_videos
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_videos.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── order_status_history SELECT / prepper branch (from 0119) ─────────────────
DROP POLICY IF EXISTS "Preppers can view their order status history" ON order_status_history;
CREATE POLICY "Preppers can view their order status history"
  ON order_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_status_history.order_id
      AND COALESCE(o.prepper_id = my_prepper_id(), false)
  ));

COMMIT;
