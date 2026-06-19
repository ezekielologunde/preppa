-- Migration 0133: DB-level CHECK constraints mirroring client-side text limits.
-- All constraints use NOT VALID so they apply only to new/updated rows and avoid
-- a full table scan (which could lock tables in production). Run VALIDATE CONSTRAINT
-- during a maintenance window if you need to enforce against historical data.

-- ─── prepper_profiles ────────────────────────────────────────────────────────
ALTER TABLE prepper_profiles
  ADD CONSTRAINT prepper_profiles_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) <= 60) NOT VALID,
  ADD CONSTRAINT prepper_profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 500) NOT VALID,
  ADD CONSTRAINT prepper_profiles_tagline_length
    CHECK (tagline IS NULL OR char_length(tagline) <= 100) NOT VALID,
  ADD CONSTRAINT prepper_profiles_city_length
    CHECK (city IS NULL OR char_length(city) <= 60) NOT VALID,
  ADD CONSTRAINT prepper_profiles_cuisine_type_length
    CHECK (cuisine_type IS NULL OR char_length(cuisine_type) <= 50) NOT VALID;

-- ─── meals ───────────────────────────────────────────────────────────────────
ALTER TABLE meals
  ADD CONSTRAINT meals_title_length
    CHECK (char_length(title) > 0 AND char_length(title) <= 100) NOT VALID,
  ADD CONSTRAINT meals_description_length
    CHECK (description IS NULL OR char_length(description) <= 2000) NOT VALID;

-- ─── meal_requests (bid requests + emergency requests share this table) ───────
ALTER TABLE meal_requests
  ADD CONSTRAINT meal_requests_title_length
    CHECK (char_length(title) > 0 AND char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT meal_requests_description_length
    CHECK (description IS NULL OR char_length(description) <= 1100) NOT VALID,
  ADD CONSTRAINT meal_requests_cuisine_length
    CHECK (cuisine IS NULL OR char_length(cuisine) <= 50) NOT VALID;

-- ─── meal_request_bids ───────────────────────────────────────────────────────
ALTER TABLE meal_request_bids
  ADD CONSTRAINT meal_request_bids_note_length
    CHECK (note IS NULL OR char_length(note) <= 500) NOT VALID;

-- ─── reviews ─────────────────────────────────────────────────────────────────
ALTER TABLE reviews
  ADD CONSTRAINT reviews_body_length
    CHECK (body IS NULL OR char_length(body) <= 2000) NOT VALID,
  ADD CONSTRAINT reviews_prepper_reply_length
    CHECK (prepper_reply IS NULL OR char_length(prepper_reply) <= 2000) NOT VALID;

-- ─── experience_requests ─────────────────────────────────────────────────────
ALTER TABLE experience_requests
  ADD CONSTRAINT experience_requests_title_length
    CHECK (char_length(title) > 0 AND char_length(title) <= 100) NOT VALID,
  ADD CONSTRAINT experience_requests_details_length
    CHECK (details IS NULL OR char_length(details) <= 500) NOT VALID,
  ADD CONSTRAINT experience_requests_location_length
    CHECK (location IS NULL OR char_length(location) <= 200) NOT VALID;

-- ─── addresses ───────────────────────────────────────────────────────────────
ALTER TABLE addresses
  ADD CONSTRAINT addresses_line1_length
    CHECK (char_length(line1) > 0 AND char_length(line1) <= 200) NOT VALID,
  ADD CONSTRAINT addresses_line2_length
    CHECK (line2 IS NULL OR char_length(line2) <= 200) NOT VALID,
  ADD CONSTRAINT addresses_city_length
    CHECK (city IS NULL OR char_length(city) <= 100) NOT VALID,
  ADD CONSTRAINT addresses_state_length
    CHECK (state IS NULL OR char_length(state) <= 50) NOT VALID,
  ADD CONSTRAINT addresses_postal_code_length
    CHECK (postal_code IS NULL OR char_length(postal_code) <= 20) NOT VALID,
  ADD CONSTRAINT addresses_country_length
    CHECK (country IS NULL OR char_length(country) <= 10) NOT VALID;

-- ─── home_cook_requests ──────────────────────────────────────────────────────
ALTER TABLE home_cook_requests
  ADD CONSTRAINT home_cook_requests_menu_ideas_length
    CHECK (menu_ideas IS NULL OR char_length(menu_ideas) <= 1000) NOT VALID,
  ADD CONSTRAINT home_cook_requests_cuisine_length
    CHECK (cuisine IS NULL OR char_length(cuisine) <= 50) NOT VALID;
