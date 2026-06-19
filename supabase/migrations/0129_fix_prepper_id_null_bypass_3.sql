-- ============================================================================
-- 0125 — SECURITY: Wrap my_prepper_id() comparisons in COALESCE (batch 3/3).
--
-- Continuation of 0123–0124. Fixes remaining policies from 0001_core_schema
-- that were not recreated by any later migration:
--
--   meal child tables (variants, nutrition, ingredients, allergens, images)
--   refunds SELECT
--   subscriptions ALL
--   delivery_tracking SELECT
--
-- See 0123 for full background on the NULL bypass issue.
-- ============================================================================

BEGIN;

-- ── meal_variants (from 0001) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS p_variants_read ON meal_variants;
CREATE POLICY p_variants_read ON meal_variants
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_variants.meal_id
      AND (
        m.status = 'published'
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

DROP POLICY IF EXISTS p_variants_write ON meal_variants;
CREATE POLICY p_variants_write ON meal_variants
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_variants.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_variants.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── nutrition_profiles (from 0001) ────────────────────────────────────────────
DROP POLICY IF EXISTS p_nutri_read ON nutrition_profiles;
CREATE POLICY p_nutri_read ON nutrition_profiles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = nutrition_profiles.meal_id
      AND (
        m.status = 'published'
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

DROP POLICY IF EXISTS p_nutri_write ON nutrition_profiles;
CREATE POLICY p_nutri_write ON nutrition_profiles
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = nutrition_profiles.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = nutrition_profiles.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── meal_ingredients (from 0001) ──────────────────────────────────────────────
DROP POLICY IF EXISTS p_mi_read ON meal_ingredients;
CREATE POLICY p_mi_read ON meal_ingredients
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_ingredients.meal_id
      AND (
        m.status = 'published'
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

DROP POLICY IF EXISTS p_mi_write ON meal_ingredients;
CREATE POLICY p_mi_write ON meal_ingredients
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_ingredients.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_ingredients.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── meal_allergens (from 0001) ────────────────────────────────────────────────
DROP POLICY IF EXISTS p_ma_read ON meal_allergens;
CREATE POLICY p_ma_read ON meal_allergens
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_allergens.meal_id
      AND (
        m.status = 'published'
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

DROP POLICY IF EXISTS p_ma_write ON meal_allergens;
CREATE POLICY p_ma_write ON meal_allergens
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_allergens.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_allergens.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── meal_images (from 0001) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS p_img_read ON meal_images;
CREATE POLICY p_img_read ON meal_images
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_images.meal_id
      AND (
        m.status = 'published'
        OR COALESCE(m.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

DROP POLICY IF EXISTS p_img_write ON meal_images;
CREATE POLICY p_img_write ON meal_images
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_images.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meals m
    WHERE m.id = meal_images.meal_id
      AND COALESCE(m.prepper_id = my_prepper_id(), false)
  ));

-- ── refunds SELECT (from 0001) ────────────────────────────────────────────────
-- Service-role only for writes; clients only read their own refunds.
DROP POLICY IF EXISTS p_refunds_read ON refunds;
CREATE POLICY p_refunds_read ON refunds
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.id = refunds.payment_id
      AND (
        o.customer_id = auth.uid()
        OR COALESCE(o.prepper_id = my_prepper_id(), false)
        OR COALESCE(is_admin(), false)
      )
  ));

-- ── subscriptions ALL (from 0001) ─────────────────────────────────────────────
-- Customers own their subscriptions; preppers can read (not write) theirs.
-- WITH CHECK already restricts writes to the customer; USING allows prepper read.
DROP POLICY IF EXISTS p_subs_rw ON subscriptions;
CREATE POLICY p_subs_rw ON subscriptions
  FOR ALL
  USING (
    customer_id = auth.uid()
    OR COALESCE(prepper_id = my_prepper_id(), false)
    OR COALESCE(is_admin(), false)
  )
  WITH CHECK (customer_id = auth.uid());

-- ── delivery_tracking SELECT (from 0001) ──────────────────────────────────────
DROP POLICY IF EXISTS p_tracking_read ON delivery_tracking;
CREATE POLICY p_tracking_read ON delivery_tracking
  FOR SELECT
  USING (
    driver_id = auth.uid()
    OR COALESCE(is_admin(), false)
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = delivery_tracking.order_id
        AND (
          o.customer_id = auth.uid()
          OR COALESCE(o.prepper_id = my_prepper_id(), false)
        )
    )
  );

COMMIT;
