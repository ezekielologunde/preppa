-- Migration 0115: Materialized view for trending meals
-- Replaces the full-table-scan in useTrendingNowMeals with a pre-computed result.
--
-- Schema notes (verified against migrations 0001, 0077, 0096):
--   meals columns used: id, prepper_id, category_id, title, description,
--                       base_price, status (meal_status enum), dietary_tags
--   Cover images live in meal_images (separate table) — not on meals directly.
--   Ratings live in prepper_rating_summary (per-prepper, not per-meal).
--   order_items has no created_at; the 7-day window is applied via orders.created_at.
--
-- Refresh: add pg_cron job in Supabase Dashboard → Database → Extensions → pg_cron:
--   SELECT cron.schedule(
--     'refresh-trending-meals',
--     '*/15 * * * *',
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_meals'
--   );

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS trending_meals;

CREATE MATERIALIZED VIEW trending_meals AS
  SELECT
    oi.meal_id,
    COUNT(*)          AS order_count,
    m.title,
    m.description,
    m.base_price,
    m.prepper_id,
    m.category_id,
    m.dietary_tags,
    m.status
  FROM order_items oi
  JOIN orders      o  ON o.id  = oi.order_id
  JOIN meals       m  ON m.id  = oi.meal_id
  WHERE o.created_at > NOW() - INTERVAL '7 days'
    AND m.status = 'published'
  GROUP BY
    oi.meal_id,
    m.title,
    m.description,
    m.base_price,
    m.prepper_id,
    m.category_id,
    m.dietary_tags,
    m.status
  ORDER BY order_count DESC
  LIMIT 20;

-- Unique index is required for CONCURRENT refresh.
CREATE UNIQUE INDEX trending_meals_meal_id_idx ON trending_meals(meal_id);

COMMIT;
