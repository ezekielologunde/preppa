-- ── 027 rls_null_bypass_audit ──────────────────────────────────────────────────
-- CRITICAL SECURITY: Enable and harden RLS on the three highest-risk tables.
--
-- NULL-bypass pattern: a SECURITY DEFINER helper that returns NULL combined with
-- an equality check (kitchen_id = my_prepper_id()) matches ALL rows where
-- kitchen_id IS NULL — because NULL = NULL is NULL, not TRUE. The policy evaluates
-- to NULL which Postgres treats as FALSE for restrictive policies but can create
-- unexpected behaviour in permissive policy stacks.
-- Guard: always prefix nullable function results with IS NOT NULL.
--
-- This migration:
--   1. Creates a permanent diagnostic view to surface risky policies
--   2. Enables RLS and installs hardened policies on kitchens, listings, orders
--   3. Applies the same NULL-guard pattern to every equality check against auth.uid()

-- ── Diagnostic view (keep permanently for ongoing audits) ─────────────────────

CREATE OR REPLACE VIEW public.rls_policy_audit AS
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual        AS using_expr,
  p.with_check  AS with_check_expr,
  CASE
    WHEN p.qual       ILIKE '%my_prepper_id()%'
     AND p.qual NOT   ILIKE '%IS NOT NULL%'  THEN 'NULL_BYPASS_RISK: my_prepper_id() without IS NOT NULL guard'
    WHEN p.qual = 'true'                      THEN 'PERMISSIVE_ALL: no row-level filter'
    WHEN p.with_check ILIKE '%auth.uid()%'
     AND p.with_check NOT ILIKE '%auth.uid() IS NOT NULL%'
                                              THEN 'NULL_AUTH: INSERT check missing auth.uid() IS NOT NULL'
    ELSE 'OK'
  END AS risk_assessment
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.cmd;

-- ── kitchens ──────────────────────────────────────────────────────────────────

ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kitchens_select_public  ON public.kitchens;
DROP POLICY IF EXISTS kitchens_select_own     ON public.kitchens;
DROP POLICY IF EXISTS kitchens_insert_own     ON public.kitchens;
DROP POLICY IF EXISTS kitchens_update_own     ON public.kitchens;
DROP POLICY IF EXISTS kitchens_admin_rw       ON public.kitchens;
DROP POLICY IF EXISTS kitchens_service_role   ON public.kitchens;

-- All visitors can browse kitchens (marketplace requirement — must be explicit)
CREATE POLICY kitchens_select_public ON public.kitchens FOR SELECT
  USING (true);

-- A prepper can INSERT exactly one kitchen record (UNIQUE prepper_id enforces singleton)
CREATE POLICY kitchens_insert_own ON public.kitchens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

-- NULL guard on auth.uid() prevents anon bypass; equality to prepper_id prevents
-- lateral access between preppers even if both are authenticated
CREATE POLICY kitchens_update_own ON public.kitchens FOR UPDATE TO authenticated
  USING  (auth.uid() IS NOT NULL AND prepper_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

-- is_admin() returns false for non-admins; no NULL-bypass risk (COALESCE'd in definition)
CREATE POLICY kitchens_admin_rw ON public.kitchens FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY kitchens_service_role ON public.kitchens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── listings ──────────────────────────────────────────────────────────────────

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listings_select_published ON public.listings;
DROP POLICY IF EXISTS listings_select_own       ON public.listings;
DROP POLICY IF EXISTS listings_insert_own       ON public.listings;
DROP POLICY IF EXISTS listings_update_own       ON public.listings;
DROP POLICY IF EXISTS listings_delete_own       ON public.listings;
DROP POLICY IF EXISTS listings_admin_rw         ON public.listings;
DROP POLICY IF EXISTS listings_service_role     ON public.listings;

-- Published, non-disabled listings are publicly browsable (anon included)
CREATE POLICY listings_select_published ON public.listings FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
    AND admin_disabled_at IS NULL
  );

-- Preppers see all their own listings regardless of status (drafts, paused, etc.)
-- The two policies are additive (permissive); a prepper browsing sees their own drafts
-- plus published listings from others
CREATE POLICY listings_select_own ON public.listings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

CREATE POLICY listings_insert_own ON public.listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

-- NULL guard is load-bearing: if prepper_id were ever NULL (e.g. a seed row),
-- the old pattern `prepper_id = auth.uid()` would NOT match it (NULL = x = NULL/false).
-- The IS NOT NULL guard on auth.uid() is the primary defence against anon bypass.
CREATE POLICY listings_update_own ON public.listings FOR UPDATE TO authenticated
  USING  (auth.uid() IS NOT NULL AND prepper_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

-- Soft-delete only: preppers set deleted_at, never physically delete
CREATE POLICY listings_delete_own ON public.listings FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND prepper_id = auth.uid());

CREATE POLICY listings_admin_rw ON public.listings FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY listings_service_role ON public.listings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── orders ────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_customer  ON public.orders;
DROP POLICY IF EXISTS orders_select_kitchen   ON public.orders;
DROP POLICY IF EXISTS orders_insert_customer  ON public.orders;
DROP POLICY IF EXISTS orders_admin_rw         ON public.orders;
DROP POLICY IF EXISTS orders_service_role     ON public.orders;

-- Customers see only their own orders
CREATE POLICY orders_select_customer ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND customer_id = auth.uid());

-- Preppers see orders placed at their kitchen.
-- Subquery is NULL-safe: kitchens.prepper_id is NOT NULL (DB constraint).
CREATE POLICY orders_select_kitchen ON public.orders FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND kitchen_id IN (
      SELECT id FROM public.kitchens WHERE prepper_id = auth.uid()
    )
  );

-- Only authenticated customers can create orders (self-purchase blocked by trigger in 030)
CREATE POLICY orders_insert_customer ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND customer_id = auth.uid());

-- Status transitions happen only through SECURITY DEFINER RPCs (service_role path).
-- Direct UPDATE by authenticated users is disallowed to prevent status manipulation.
CREATE POLICY orders_admin_rw ON public.orders FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY orders_service_role ON public.orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── order_items ───────────────────────────────────────────────────────────────

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select_parties  ON public.order_items;
DROP POLICY IF EXISTS order_items_insert_system   ON public.order_items;
DROP POLICY IF EXISTS order_items_service_role    ON public.order_items;

-- Customer and prepper can both see items on their shared orders
CREATE POLICY order_items_select_parties ON public.order_items FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE customer_id = auth.uid()
         OR kitchen_id IN (
           SELECT id FROM public.kitchens WHERE prepper_id = auth.uid()
         )
    )
  );

-- Items are written only by service_role (inside create_order RPC transaction)
CREATE POLICY order_items_service_role ON public.order_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── payments ──────────────────────────────────────────────────────────────────

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_customer  ON public.payments;
DROP POLICY IF EXISTS payments_select_kitchen   ON public.payments;
DROP POLICY IF EXISTS payments_admin_rw         ON public.payments;
DROP POLICY IF EXISTS payments_service_role     ON public.payments;

CREATE POLICY payments_select_customer ON public.payments FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
  );

CREATE POLICY payments_select_kitchen ON public.payments FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.kitchens k ON k.id = o.kitchen_id
      WHERE k.prepper_id = auth.uid()
    )
  );

CREATE POLICY payments_admin_rw ON public.payments FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY payments_service_role ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);
