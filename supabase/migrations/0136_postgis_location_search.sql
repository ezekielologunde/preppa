-- 0136_postgis_location_search.sql
--
-- Enable PostGIS and add a geography column to prepper_profiles.
-- prepper_profiles already has lat/lng columns (0097); this adds a proper
-- geography column + GIST index for efficient radius queries, auto-populated
-- from existing lat/lng values and kept in sync via a trigger.

CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Add computed geography column (synced from lat/lng)
ALTER TABLE prepper_profiles
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Back-fill from existing lat/lng data
UPDATE prepper_profiles
SET location = extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- GIST index for fast radius queries
CREATE INDEX IF NOT EXISTS idx_prepper_profiles_location
  ON prepper_profiles USING GIST (location);

-- Trigger: keep location in sync when lat/lng is updated
CREATE OR REPLACE FUNCTION public.sync_prepper_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_prepper_location ON prepper_profiles;
CREATE TRIGGER trg_sync_prepper_location
  BEFORE INSERT OR UPDATE OF lat, lng ON prepper_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_prepper_location();

-- RPC: find approved preppers within radius_km of a coordinate.
CREATE OR REPLACE FUNCTION public.preppers_near(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8 DEFAULT 20
) RETURNS TABLE (
  id           uuid,
  display_name text,
  city         text,
  avatar_url   text,
  tagline      text,
  distance_km  float8
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    pp.id,
    pp.display_name,
    pp.city,
    pp.avatar_url,
    pp.tagline,
    ROUND(
      (ST_Distance(
        pp.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000.0)::numeric, 2
    )::float8 AS distance_km
  FROM prepper_profiles pp
  WHERE pp.location IS NOT NULL
    AND pp.status = 'approved'
    AND pp.accepting_orders = true
    AND ST_DWithin(
      pp.location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000.0
    )
  ORDER BY pp.location <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.preppers_near(float8, float8, float8) TO authenticated, anon;

-- RPC: update the calling prepper's lat/lng (triggers location sync automatically)
CREATE OR REPLACE FUNCTION public.set_prepper_location(
  p_lat float8,
  p_lng float8
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE prepper_profiles
  SET lat = p_lat, lng = p_lng
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.set_prepper_location(float8, float8) TO authenticated;
