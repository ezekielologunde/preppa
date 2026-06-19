-- Migration 0130: Critical performance indexes for 3M-user scale
--
-- These indexes cover the most frequent query patterns in the app:
-- order lists, feed rendering, search, and payment lookups.
-- All use CONCURRENTLY so they can be applied to a live database.
-- Run with: supabase db push  (or apply via Supabase dashboard)

-- ── orders ───────────────────────────────────────────────────────────────────
-- Customer order history (most common query: "my orders")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_created
  ON orders (customer_id, created_at DESC);

-- Prepper order dashboard ("my incoming orders")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_prepper_status
  ON orders (prepper_id, status, created_at DESC);

-- Payment lookup by order (webhook + checkout idempotency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id
  ON payments (order_id);

-- ── meals / feed ──────────────────────────────────────────────────────────────
-- Public feed: published meals sorted by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meals_prepper_status_created
  ON meals (prepper_id, status, created_at DESC);

-- ── reviews ───────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_meal_id
  ON reviews (meal_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_prepper_id
  ON reviews (prepper_id, created_at DESC);

-- ── gift cards ────────────────────────────────────────────────────────────────
-- Code lookup at validation/redemption (hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gift_cards_code
  ON gift_cards (code);

-- Recipient lookup for inbox / pending cards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gift_cards_recipient
  ON gift_cards (recipient_email) WHERE is_active = true;

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_customer_status
  ON subscriptions (customer_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_prepper_status
  ON subscriptions (prepper_id, status);

-- ── push tokens ───────────────────────────────────────────────────────────────
-- Notification delivery (hot path for every push send)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_tokens_user_id
  ON push_tokens (user_id);

-- ── social / follows ──────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id
  ON follows (follower_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_prepper_id
  ON follows (prepper_id);

-- ── rate limit events ────────────────────────────────────────────────────────
-- Covers the sliding-window query in checkRateLimit()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limit_events_lookup
  ON rate_limit_events (user_id, action, created_at DESC);

-- ── order items ───────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);
