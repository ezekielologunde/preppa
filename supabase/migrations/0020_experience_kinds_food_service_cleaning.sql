-- ============================================================================
-- 0020 — Experience marketplace covers more gig types: general food service
-- shifts and post-event cleaning, alongside catering/chef/classes/tastings.
-- ============================================================================

alter type experience_kind add value if not exists 'food_service';
alter type experience_kind add value if not exists 'cleaning';
