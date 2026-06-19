-- ============================================================================
-- 0123 — SECURITY: Wrap my_prepper_id() comparisons in COALESCE (batch 1/2).
--
-- Background:
--   my_prepper_id() returns NULL when the caller has no prepper profile.
--   In plpgsql IF statements, `col = NULL` → NULL → falsy, which caused real
--   privilege-escalation bugs fixed in 0026 (verify_handoff) and 0027
--   (advance_order). In RLS expressions, NULL → fail-closed (not a bypass),
--   but it creates ambiguous intent and risks future refactor bugs.
--   Migration 0086 established the COALESCE convention for orders SELECT.
--   This migration extends that convention to all remaining policies.
--
-- Already fixed (skipped here):
--   0026 — verify_handoff, verify_handoff_token
--   0027 — advance_order
--   0086 — p_orders_read
--   0106 — order_messages policies
--
-- Batch 1 covers: core schema tables from 0001 + experiences from 0005.
-- Batch 2 (0124) covers: meal_plans (0006), order_items/payments (0082),
--                         meal_videos (0102), order_status_history (0119).
-- ============================================================================

BEGIN;

-- ── kitchens (from 0001) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS p_kitchens_owner ON kitchens;
CREATE POLICY p_kitchens_owner ON kitchens
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── certifications (from 0001) ───────────────────────────────────────────────
DROP POLICY IF EXISTS p_certs_owner ON certifications;
CREATE POLICY p_certs_owner ON certifications
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── availability_schedules (from 0001) ───────────────────────────────────────
DROP POLICY IF EXISTS p_avail_write ON availability_schedules;
CREATE POLICY p_avail_write ON availability_schedules
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── delivery_zones (from 0001) ────────────────────────────────────────────────
DROP POLICY IF EXISTS p_zones_write ON delivery_zones;
CREATE POLICY p_zones_write ON delivery_zones
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── pickup_locations (from 0001) ──────────────────────────────────────────────
DROP POLICY IF EXISTS p_pickup_write ON pickup_locations;
CREATE POLICY p_pickup_write ON pickup_locations
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── follows SELECT (from 0001) ────────────────────────────────────────────────
-- Read-only so NULL is fail-closed (non-preppers don't see via prepper branch).
-- Wrap for explicit intent.
DROP POLICY IF EXISTS p_follows_read ON follows;
CREATE POLICY p_follows_read ON follows
  FOR SELECT
  USING (
    follower_id = auth.uid()
    OR COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
  );

-- ── meals SELECT (from 0001) ──────────────────────────────────────────────────
-- Published meals are visible to all; prepper sees their own (incl. draft).
DROP POLICY IF EXISTS p_meals_read ON meals;
CREATE POLICY p_meals_read ON meals
  FOR SELECT
  USING (
    status = 'published'
    OR COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
  );

-- ── meals ALL (from 0001) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS p_meals_write ON meals;
CREATE POLICY p_meals_write ON meals
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false) OR COALESCE(is_admin(), false))
  WITH CHECK (COALESCE(prepper_id = my_prepper_id(), false));

-- ── experience_bids SELECT (from 0005) ───────────────────────────────────────
DROP POLICY IF EXISTS p_exp_bid_read ON experience_bids;
CREATE POLICY p_exp_bid_read ON experience_bids
  FOR SELECT
  USING (
    COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
    OR EXISTS (
      SELECT 1 FROM experience_requests r
      WHERE r.id = request_id AND r.customer_id = auth.uid()
    )
  );

-- ── experience_bids ALL (from 0005) ──────────────────────────────────────────
DROP POLICY IF EXISTS p_exp_bid_write ON experience_bids;
CREATE POLICY p_exp_bid_write ON experience_bids
  FOR ALL
  USING (COALESCE(prepper_id = my_prepper_id(), false))
  WITH CHECK (
    COALESCE(prepper_id = my_prepper_id(), false)
    AND EXISTS (
      SELECT 1 FROM prepper_profiles pp
      WHERE pp.id = prepper_id AND pp.status = 'approved'
    )
  );

COMMIT;
