-- ── 001 listing_core ─────────────────────────────────────────────────────────
-- Enums, core listing/kitchen tables, search-vector trigger, kitchen status RPC.

-- Enums
CREATE TYPE public.listing_status AS ENUM (
  'draft','reviewing','published','paused','out_of_stock','archived','deleted'
);
CREATE TYPE public.kitchen_status AS ENUM (
  'accepting_orders','busy','limited','booked','vacation','offline','emergency_pause'
);

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.kitchens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepper_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT,
  bio              TEXT,
  status_override  public.kitchen_status,
  vacation_until   TIMESTAMPTZ,
  daily_capacity   INTEGER NOT NULL DEFAULT 20,
  business_hours   JSONB NOT NULL DEFAULT '[]',
  health_score     NUMERIC(4,1) NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prepper_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kitchen_id      UUID REFERENCES public.kitchens(id),
  status          public.listing_status NOT NULL DEFAULT 'draft',
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  price_pence     INTEGER NOT NULL,
  servings        INTEGER NOT NULL,
  daily_portions  INTEGER,
  service_types   TEXT[] NOT NULL DEFAULT ARRAY['pickup'],
  available_days  INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  use_cases       TEXT[] NOT NULL DEFAULT '{}',
  dietary_tags    TEXT[] NOT NULL DEFAULT '{}',
  allergens       TEXT[] NOT NULL DEFAULT '{}',
  search_vector   TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE public.listing_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.kitchen_capacity (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id       UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  daily_limit      INTEGER NOT NULL,
  orders_accepted  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kitchen_id, date)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX kitchens_prepper_idx            ON public.kitchens (prepper_id);
CREATE INDEX listings_prepper_id_idx         ON public.listings (prepper_id);
CREATE INDEX listings_kitchen_idx            ON public.listings (kitchen_id);
CREATE INDEX listings_status_idx             ON public.listings (status);
CREATE INDEX listings_published_at_idx       ON public.listings (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX listings_fts_idx                ON public.listings USING GIN (search_vector);
CREATE INDEX listing_photos_listing_idx      ON public.listing_photos (listing_id, display_order);
CREATE INDEX kitchen_capacity_kitchen_date_idx ON public.kitchen_capacity (kitchen_id, date);

-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_listing_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')),        'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.tagline, '')),     'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple',  array_to_string(NEW.dietary_tags, ' ')), 'B') ||
    setweight(to_tsvector('simple',  array_to_string(NEW.use_cases,   ' ')), 'C');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_kitchen_status(p_kitchen_id UUID)
RETURNS public.kitchen_status
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kitchen      public.kitchens%ROWTYPE;
  v_orders_today INTEGER := 0;
BEGIN
  SELECT * INTO v_kitchen FROM public.kitchens WHERE id = p_kitchen_id;
  IF NOT FOUND THEN RETURN 'offline'; END IF;

  IF v_kitchen.status_override IS NOT NULL THEN RETURN v_kitchen.status_override; END IF;

  IF v_kitchen.vacation_until IS NOT NULL AND NOW() < v_kitchen.vacation_until THEN
    RETURN 'vacation';
  END IF;

  SELECT COALESCE(orders_accepted, 0) INTO v_orders_today
  FROM public.kitchen_capacity
  WHERE kitchen_id = p_kitchen_id AND date = CURRENT_DATE;

  IF v_kitchen.daily_capacity > 0 THEN
    IF v_orders_today >= v_kitchen.daily_capacity THEN RETURN 'booked'; END IF;
    IF v_orders_today >= FLOOR(v_kitchen.daily_capacity * 0.85) THEN RETURN 'limited'; END IF;
  END IF;

  RETURN 'accepting_orders';
END;
$$;

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER kitchens_updated_at
  BEFORE UPDATE ON public.kitchens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER listings_search_vector_sync
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_listing_search_vector();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.kitchens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_kitchens   ON public.kitchens FOR SELECT TO public USING (true);
CREATE POLICY preppers_own_kitchen   ON public.kitchens FOR ALL TO authenticated
  USING (prepper_id = auth.uid()) WITH CHECK (prepper_id = auth.uid());

CREATE POLICY public_read_published  ON public.listings FOR SELECT TO public
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY preppers_own_listings  ON public.listings FOR ALL TO authenticated
  USING (prepper_id = auth.uid()) WITH CHECK (prepper_id = auth.uid());

CREATE POLICY public_read_published_photos ON public.listing_photos FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.listings l
    WHERE l.id = listing_photos.listing_id
      AND l.status = 'published' AND l.deleted_at IS NULL));
CREATE POLICY preppers_own_photos    ON public.listing_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l
    WHERE l.id = listing_photos.listing_id AND l.prepper_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l
    WHERE l.id = listing_photos.listing_id AND l.prepper_id = auth.uid()));

CREATE POLICY preppers_own_capacity  ON public.kitchen_capacity FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kitchens k
    WHERE k.id = kitchen_capacity.kitchen_id AND k.prepper_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kitchens k
    WHERE k.id = kitchen_capacity.kitchen_id AND k.prepper_id = auth.uid()));
