-- ── 002 marketplace_core ─────────────────────────────────────────────────────
-- Enums, audit_log, order/payment tables, guard trigger, publish_listing RPC.

-- Enums
CREATE TYPE public.order_status AS ENUM (
  'pending','confirmed','preparing','ready',
  'in_transit','delivered','cancelled','refunded'
);
CREATE TYPE public.payment_status AS ENUM (
  'pending','authorized','captured','in_escrow','released','refunded','failed'
);

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    UUID,
  before_state   JSONB,
  after_state    JSONB,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kitchen_id          UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE RESTRICT,
  status              public.order_status NOT NULL DEFAULT 'pending',
  total_pence         INTEGER NOT NULL,
  platform_fee_pence  INTEGER NOT NULL DEFAULT 0,
  delivery_address    JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  listing_name  TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_pence    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id  TEXT UNIQUE,
  status                    public.payment_status NOT NULL DEFAULT 'pending',
  amount_pence              INTEGER NOT NULL,
  platform_fee_pence        INTEGER NOT NULL DEFAULT 0,
  prepper_payout_pence      INTEGER NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'gbp',
  captured_at               TIMESTAMPTZ,
  released_at               TIMESTAMPTZ,
  refunded_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX audit_logs_actor_idx     ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_resource_idx  ON public.audit_logs (resource_type, resource_id);
CREATE INDEX audit_logs_created_idx   ON public.audit_logs (created_at DESC);

CREATE INDEX orders_customer_idx      ON public.orders (customer_id, created_at DESC);
CREATE INDEX orders_kitchen_idx       ON public.orders (kitchen_id, status);
CREATE INDEX orders_status_idx        ON public.orders (status);
CREATE INDEX orders_created_idx       ON public.orders (created_at DESC);

CREATE INDEX order_items_order_idx    ON public.order_items (order_id);
CREATE INDEX order_items_listing_idx  ON public.order_items (listing_id);

CREATE INDEX payments_order_idx       ON public.payments (order_id);
CREATE INDEX payments_stripe_idx      ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX payments_status_idx      ON public.payments (status);

-- ── Functions ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_customer_not_prepper()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prepper_id UUID;
BEGIN
  SELECT prepper_id INTO v_prepper_id
  FROM public.kitchens WHERE id = NEW.kitchen_id;

  IF v_prepper_id = NEW.customer_id THEN
    BEGIN
      PERFORM public.emit_abuse_signal(
        NEW.customer_id, 'self_order_attempt', 50,
        jsonb_build_object('kitchen_id', NEW.kitchen_id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never block the order rejection on a missing function
    END;
    RAISE EXCEPTION 'self_order_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_listing(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found'; END IF;
  IF v_listing.prepper_id <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;

  UPDATE public.listings
  SET status = 'published', published_at = NOW()
  WHERE id = p_listing_id;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, after_state)
  VALUES (auth.uid(), 'publish', 'listing', p_listing_id,
    jsonb_build_object('status', 'published', 'published_at', NOW()));
END;
$$;

-- emit_order_event is referenced by the trigger below; body is inline here.
-- It fires into domain_events which is created in migration 003, so the
-- function body uses a forward reference that resolves at trigger-fire time.
CREATE OR REPLACE FUNCTION public.emit_order_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_id, payload, version)
  VALUES (
    CASE TG_OP
      WHEN 'INSERT' THEN 'order.created'
      WHEN 'UPDATE' THEN
        CASE
          WHEN NEW.status <> OLD.status THEN 'order.status_changed'
          ELSE 'order.updated'
        END
    END,
    'order', NEW.id, NEW.customer_id,
    jsonb_build_object(
      'status', NEW.status,
      'kitchen_id', NEW.kitchen_id,
      'total_pence', NEW.total_pence
    ),
    1
  );
  RETURN NEW;
END;
$$;

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER orders_guard_self_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_not_prepper();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- order_domain_events trigger created in 004 after domain_events table exists.

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments    ENABLE ROW LEVEL SECURITY;

-- audit_logs: admin-only reads (admin check is per-policy via metadata or service role)
CREATE POLICY service_role_audit ON public.audit_logs TO service_role USING (true);

CREATE POLICY customers_own_orders ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY preppers_see_kitchen_orders ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kitchens k
    WHERE k.id = orders.kitchen_id AND k.prepper_id = auth.uid()));
CREATE POLICY customers_create_orders ON public.orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY preppers_update_order_status ON public.orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kitchens k
    WHERE k.id = orders.kitchen_id AND k.prepper_id = auth.uid()));

CREATE POLICY order_items_via_order ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.kitchens k
          WHERE k.id = o.kitchen_id AND k.prepper_id = auth.uid()))));
CREATE POLICY customers_insert_order_items ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));

CREATE POLICY payments_customer_read ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id AND o.customer_id = auth.uid()));
CREATE POLICY payments_prepper_read ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
    JOIN public.kitchens k ON k.id = o.kitchen_id
    WHERE o.id = payments.order_id AND k.prepper_id = auth.uid()));
