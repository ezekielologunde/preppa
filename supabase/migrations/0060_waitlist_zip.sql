-- ============================================================================
-- Preppa — Capture ZIP on the landing waitlist (demand-geography signal).
-- Additive + nullable so existing email-only signups keep working. The anon
-- table-level INSERT grant already covers the new column.
-- ============================================================================

alter table waitlist add column if not exists zip text;
