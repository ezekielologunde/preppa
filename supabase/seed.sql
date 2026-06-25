-- ─────────────────────────────────────────────────────────────────────────────
-- Preppa — production-grade synthetic marketplace seed (schema 001–040)
-- Deterministic (md5-derived UUIDs) · idempotent (ON CONFLICT DO NOTHING)
-- Dev password for all seed users: Preppa2026!
--
-- Targets: 2 real admins + 1 system admin · 100 preppers · ~400 customers ·
--          ~1,500 listings · ~17,000 orders (all lifecycle + escrow states) ·
--          ~17,000 payments · Stripe Connect accounts in every state ·
--          ~150 payouts (incl. failed) · disputes · refunds · payment_operations
--
-- Edge cases exercised: expired certs · failed/restricted/disabled Stripe
-- onboarding · vacation-mode preppers · hero kitchens · zero-order new preppers ·
-- VIP & dormant customers · pickup/delivery/meetup · chargebacks (refunded).
--
-- NOT SEEDED (no table in the frozen schema — Sprint 29 feature work):
--   reviews · support tickets · coupons · subscriptions · referral chains ·
--   standalone fraud-investigation records.  Disputes are modelled via
--   orders.escrow_status='disputed' + pending_dispute_resolutions.
--
-- Triggers are disabled during load (session_replication_role=replica) so the
-- 17k order inserts do NOT fan out to pg_net (event-processor / push dispatch).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SET LOCAL session_replication_role = replica;  -- no triggers, no http fan-out

CREATE OR REPLACE FUNCTION _s(t TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT (
    substr(md5('preppa-v3-' || t),  1,  8) || '-' ||
    substr(md5('preppa-v3-' || t),  9,  4) || '-4' ||
    substr(md5('preppa-v3-' || t), 13,  3) || '-a' ||
    substr(md5('preppa-v3-' || t), 17,  3) || '-' ||
    substr(md5('preppa-v3-' || t), 20, 12)
  )::UUID
$$;

-- Shared bcrypt hash placeholder for all seed users (dev only).
-- ── Section 0: real admins (bootstrap if they have signed up) ─────────────────

DO $$
DECLARE v_a1 UUID; v_a2 UUID;
BEGIN
  SELECT id INTO v_a1 FROM auth.users WHERE email = 'ologundeomotola@gmail.com';
  SELECT id INTO v_a2 FROM auth.users WHERE email = 'preppa.live@gmail.com';
  IF v_a1 IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (v_a1,'admin',v_a1)
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}') || '{"role":"admin","tier":2}'::jsonb WHERE id = v_a1;
  END IF;
  IF v_a2 IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (v_a2,'admin',COALESCE(v_a1,v_a2))
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE auth.users SET raw_app_meta_data = COALESCE(raw_app_meta_data,'{}') || '{"role":"admin","tier":2}'::jsonb WHERE id = v_a2;
  END IF;
END $$;

-- ── Section 1: system seed admin (FK satisfier; dev only) ─────────────────────

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (_s('sys'), 'seed-admin@preppa.dev',
  crypt('Preppa2026!', gen_salt('bf', 6)), '2026-01-01', 'authenticated','authenticated',
  '{"full_name":"Seed Admin"}', '{"role":"admin","tier":1}', '2026-01-01','2026-01-01')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role, granted_by) VALUES (_s('sys'),'admin',_s('sys'))
  ON CONFLICT (user_id, role) DO NOTHING;

-- ── Section 2: 100 preppers (auth.users + applications + kitchens + Stripe) ───
-- Status mix by index n (1..100):
--   1..82  approved & selling      83..88 pending application
--   89..92 rejected                93..96 suspended
--   Cert expired: n in (10,20,30)  Vacation: n in (5,15,25)
--   Hero kitchens: n in 1..8 (high capacity)   New zero-order: n in 78..82
-- Stripe account state by n:
--   active(payouts) most · pending 70..77 · restricted 60..63 · disabled 59 ·
--   not_connected 78..82 (new)

DO $$
DECLARE
  n INT; v_uid UUID; v_kid UUID; v_status public.application_status;
  v_cert TIMESTAMPTZ; v_acct_status TEXT; v_payouts BOOL; v_charges BOOL;
  v_override public.kitchen_status; v_cap INT; v_ts TIMESTAMPTZ := '2026-01-10';
BEGIN
  FOR n IN 1..100 LOOP
    v_uid := _s('prepper-'||n);
    v_kid := _s('kitchen-'||n);

    v_status := CASE
      WHEN n BETWEEN 83 AND 88 THEN 'pending'
      WHEN n BETWEEN 89 AND 92 THEN 'rejected'
      WHEN n BETWEEN 93 AND 96 THEN 'suspended'
      ELSE 'approved' END::public.application_status;

    v_cert  := CASE WHEN n IN (10,20,30) THEN '2026-05-01'::timestamptz  -- expired
                    ELSE '2027-06-01'::timestamptz END;
    v_cap   := CASE WHEN n <= 8 THEN 60 WHEN n <= 40 THEN 30 ELSE 18 END;  -- hero kitchens
    v_override := CASE WHEN n IN (5,15,25) THEN 'vacation'::public.kitchen_status ELSE NULL END;

    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud,
      raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    VALUES (v_uid, 'prepper'||n||'@preppa.dev', crypt('Preppa2026!', gen_salt('bf',6)),
      v_ts, 'authenticated','authenticated',
      jsonb_build_object('full_name','Prepper '||n), '{}', v_ts, v_ts)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.prepper_applications (id, user_id, status, legal_name, postcode, bio,
      specialties, cert_expiration_date, insurance_attested, insurance_attested_at,
      contractor_attested, contractor_attested_at, submitted_at, reviewed_at, reviewed_by)
    VALUES (_s('app-'||n), v_uid, v_status, 'Prepper '||n, 'E1 '||(n%9)||'AA',
      'Home kitchen #'||n, ARRAY['Mixed'], v_cert, TRUE, v_ts, TRUE, v_ts, v_ts,
      CASE WHEN v_status='pending' THEN NULL ELSE v_ts END,
      CASE WHEN v_status='pending' THEN NULL ELSE _s('sys') END)
    ON CONFLICT (user_id) DO NOTHING;

    -- Kitchens for everyone except rejected/pending (they have no live kitchen)
    IF v_status IN ('approved','suspended') THEN
      INSERT INTO public.kitchens (id, prepper_id, display_name, bio, daily_capacity, status_override)
      VALUES (v_kid, v_uid, 'Kitchen '||n, 'Fresh home cooking #'||n, v_cap,
        CASE WHEN v_status='suspended' THEN 'offline'::public.kitchen_status ELSE v_override END)
      ON CONFLICT (prepper_id) DO NOTHING;
    END IF;

    -- Stripe Connect account state
    v_acct_status := CASE
      WHEN n = 59 THEN 'disabled'
      WHEN n BETWEEN 60 AND 63 THEN 'restricted'
      WHEN n BETWEEN 70 AND 77 THEN 'pending'
      WHEN n BETWEEN 78 AND 82 THEN 'not_connected'
      WHEN v_status = 'approved' THEN 'active'
      ELSE 'pending' END;
    v_payouts := (v_acct_status = 'active');
    v_charges := v_acct_status IN ('active','restricted');

    IF v_status <> 'rejected' AND v_acct_status <> 'not_connected' THEN
      PERFORM public.upsert_stripe_account(v_uid, jsonb_build_object(
        'stripe_account_id','acct_seed_'||n,
        'status', v_acct_status,
        'charges_enabled', v_charges,
        'payouts_enabled', v_payouts,
        'details_submitted', v_acct_status<>'pending',
        'disabled_reason', CASE WHEN v_acct_status IN ('restricted','disabled') THEN 'requirements.past_due' ELSE NULL END,
        'requirements_due', CASE WHEN v_acct_status IN ('restricted','pending')
                                 THEN '["individual.verification.document"]'::jsonb ELSE '[]'::jsonb END,
        'country','GB','business_type', CASE WHEN n%3=0 THEN 'company' ELSE 'individual' END,
        'available_pence', CASE WHEN v_payouts THEN (n*350)%9000 ELSE 0 END,
        'pending_pence', CASE WHEN v_payouts THEN (n*120)%3000 ELSE 0 END));
    END IF;
  END LOOP;
END $$;

-- ── Section 3: ~1,500 listings across active kitchens ─────────────────────────
-- ~16 per active kitchen. search_vector set inline (triggers are off).

INSERT INTO public.listings (id, prepper_id, kitchen_id, status, name, tagline, description,
  price_pence, servings, daily_portions, service_types, available_days, dietary_tags,
  use_cases, published_at, search_vector)
SELECT
  _s('listing-'||k.n||'-'||j),
  k.prepper_id, k.id, 'published',
  (ARRAY['Jollof Rice','Jerk Chicken','Pad Thai','Biryani','Kerala Fish Curry','Bibimbap',
         'Pho Bo','Lahmacun','Adobo','Injera & Tibs','Pierogi','Egusi Soup','Bunny Chow',
         'Ramen','Tagine','Sushi Bowl'])[j] || ' #'||k.n,
  'Fresh, homemade '||(ARRAY['comfort','healthy','spicy','hearty'])[1+(j%4)],
  'Made to order in kitchen '||k.n||'. Batch '||j||'.',
  800 + ((k.n*53 + j*97) % 1700),
  1 + (j % 3),
  8 + (j % 12),
  CASE WHEN j%4=0 THEN ARRAY['pickup'] ELSE ARRAY['pickup','delivery'] END,
  ARRAY[1,2,3,4,5,6],
  CASE WHEN j%5=0 THEN ARRAY['vegan'] WHEN j%5=1 THEN ARRAY['halal'] ELSE ARRAY['gluten-free'] END,
  (ARRAY[ARRAY['dinner'],ARRAY['lunch'],ARRAY['healthy'],ARRAY['sharing']])[1+(j%4)],
  '2026-02-01',
  to_tsvector('english',
    (ARRAY['Jollof Rice','Jerk Chicken','Pad Thai','Biryani','Kerala Fish Curry','Bibimbap',
           'Pho Bo','Lahmacun','Adobo','Injera & Tibs','Pierogi','Egusi Soup','Bunny Chow',
           'Ramen','Tagine','Sushi Bowl'])[j])
FROM (
  SELECT id, prepper_id, row_number() OVER (ORDER BY id) AS n
  FROM public.kitchens
  WHERE status_override IS DISTINCT FROM 'offline'
) k
CROSS JOIN generate_series(1,16) j
ON CONFLICT (id) DO NOTHING;

-- ── Section 4: ~400 customers (VIP / dormant / new via created_at + behaviour) ─

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
SELECT _s('customer-'||n), 'customer'||n||'@preppa.dev', crypt('Preppa2026!', gen_salt('bf',6)),
  '2026-01-05'::timestamptz,'authenticated','authenticated',
  jsonb_build_object('full_name',
    (ARRAY['Amara','Ben','Chiamaka','David','Ebele','Femi','Gifty','Henry','Ife','Jade',
           'Kemi','Liam','Maryam','Nathan','Ola','Precious','Queen','Rashid','Simi','Tobi'])[1+(n%20)]
    ||' '||
    (ARRAY['Okafor','Johnson','Patel','Williams','Ahmed','Chen','Thompson','Ibrahim','Nguyen','Clarke'])[1+(n%10)]),
  '{}',
  -- dormant cohort (1..40) joined long ago; everyone else recently
  CASE WHEN n <= 40 THEN '2025-08-01'::timestamptz ELSE '2026-02-01'::timestamptz + ((n%60)||' hours')::interval END,
  '2026-02-01'
FROM generate_series(1,400) n
ON CONFLICT (id) DO NOTHING;

-- ── Section 5: ~17,000 orders across all lifecycle + escrow states ────────────
-- VIP customers (id 380..400) get disproportionately more orders via weighting.
-- Status/escrow/payment derived from n so the mix is realistic & deterministic.

WITH ks AS (
  SELECT array_agg(id ORDER BY id) AS kid, array_agg(prepper_id ORDER BY id) AS pid, count(*)::int AS c
  FROM public.kitchens WHERE status_override IS DISTINCT FROM 'offline'
)
INSERT INTO public.orders (id, customer_id, kitchen_id, status, total_pence, platform_fee_pence,
  fulfillment_method, is_verified, verified_at, escrow_status, escrow_released_at, created_at, updated_at)
SELECT
  _s('order-'||n),
  -- VIPs (every ~7th order belongs to the VIP cohort 380..400)
  CASE WHEN n%7=0 THEN _s('customer-'||(380+(n%21))) ELSE _s('customer-'||(1+(n%400))) END,
  ks.kid[1+(n%ks.c)],
  st.status,
  st.total,
  (st.total*10/100),
  (ARRAY['pickup','delivery','meetup']::public.fulfillment_method[])[1+(n%3)],
  st.verified, CASE WHEN st.verified THEN '2026-03-01'::timestamptz + ((n%120)||' hours')::interval END,
  st.escrow,
  CASE WHEN st.escrow='released' THEN '2026-03-02'::timestamptz + ((n%120)||' hours')::interval END,
  '2026-02-10'::timestamptz + ((n%150)||' days')::interval,
  '2026-02-10'::timestamptz + ((n%150)||' days')::interval
FROM generate_series(1,17000) n
CROSS JOIN ks
CROSS JOIN LATERAL (
  SELECT
    (900 + (n*137 % 4200))                                   AS total,
    (CASE WHEN n%25=0 THEN 'cancelled' WHEN n%25=1 THEN 'refunded'
          WHEN n%12=7 THEN 'preparing' WHEN n%12=8 THEN 'confirmed' WHEN n%12=9 THEN 'ready'
          ELSE 'delivered' END)::public.order_status                                    AS status,
    (CASE WHEN n%25 IN (0,1) THEN FALSE WHEN n%12 IN (7,8,9) THEN FALSE ELSE TRUE END)  AS verified,
    (CASE WHEN n%25=1 THEN 'refunded' WHEN n%25=0 THEN 'held'
          WHEN n%40=3 THEN 'disputed' WHEN n%12 IN (7,8,9) THEN 'held'
          ELSE 'released' END)::public.escrow_status                                    AS escrow
) st
WHERE ks.c > 0
ON CONFLICT (id) DO NOTHING;

-- ── Section 6: order_items (1 per order) ──────────────────────────────────────

INSERT INTO public.order_items (id, order_id, listing_id, listing_name, quantity, unit_pence)
SELECT _s('item-'||n), _s('order-'||n),
  -- map to any published listing deterministically
  l.lid[1+(n%l.c)], 'Seeded meal', 1 + (n%3), (700 + (n*53%1800))
FROM generate_series(1,17000) n
CROSS JOIN (SELECT array_agg(id ORDER BY id) AS lid, count(*)::int AS c FROM public.listings) l
WHERE l.c > 0 AND EXISTS (SELECT 1 FROM public.orders WHERE id = _s('order-'||n))
ON CONFLICT (id) DO NOTHING;

-- ── Section 7: payments (status aligned to order escrow) ──────────────────────

INSERT INTO public.payments (id, order_id, stripe_payment_intent_id, status, amount_pence,
  platform_fee_pence, prepper_payout_pence, currency, captured_at, released_at, refunded_at, created_at, updated_at)
SELECT _s('pay-'||n), o.id, 'pi_seed_'||n,
  (CASE o.escrow_status
     WHEN 'released' THEN 'released' WHEN 'refunded' THEN 'refunded'
     WHEN 'disputed' THEN 'in_escrow' WHEN 'held' THEN
       CASE WHEN o.status IN ('cancelled') THEN 'failed' ELSE 'in_escrow' END
     ELSE 'in_escrow' END)::public.payment_status,
  o.total_pence, o.platform_fee_pence, (o.total_pence - o.platform_fee_pence), 'gbp',
  CASE WHEN o.escrow_status <> 'refunded' AND o.status <> 'cancelled' THEN o.created_at END,
  o.escrow_released_at,
  CASE WHEN o.escrow_status='refunded' THEN o.updated_at END,
  o.created_at, o.updated_at
FROM public.orders o
ON CONFLICT (order_id) DO NOTHING;

-- ── Section 8: payouts (~160, incl. failed) for active sellers ────────────────

INSERT INTO public.payouts (id, prepper_id, stripe_payout_id, amount_pence, currency, status,
  failure_code, failure_message, arrival_date, created_at, updated_at)
SELECT _s('payout-'||p||'-'||b),
  _s('prepper-'||p), 'po_seed_'||p||'_'||b,
  2000 + ((p*b*131)%6000), 'gbp',
  (CASE WHEN (p+b)%9=0 THEN 'failed' WHEN b=1 THEN 'paid' ELSE 'paid' END),
  CASE WHEN (p+b)%9=0 THEN 'account_closed' END,
  CASE WHEN (p+b)%9=0 THEN 'The bank account has been closed' END,
  '2026-03-05'::timestamptz + ((p%20)||' days')::interval,
  '2026-03-04'::timestamptz + ((p%20)||' days')::interval,
  '2026-03-05'::timestamptz + ((p%20)||' days')::interval
FROM generate_series(1,58) p          -- active sellers 1..58
CROSS JOIN generate_series(1,3) b     -- ~3 payouts each ≈ 174 rows
WHERE EXISTS (SELECT 1 FROM public.stripe_accounts sa WHERE sa.prepper_id = _s('prepper-'||p) AND sa.payouts_enabled)
ON CONFLICT (stripe_payout_id) DO NOTHING;

-- ── Section 9: payment_operations (release + refund ledger entries) ───────────

INSERT INTO public.payment_operations (id, payment_id, operation_type, status,
  stripe_idempotency_key, stripe_transfer_id, stripe_refund_id, amount_pence, currency, reason, completed_at)
SELECT _s('op-'||p.id), p.id,
  CASE WHEN p.status='refunded' THEN 'refund' ELSE 'release' END,
  'completed',
  (CASE WHEN p.status='refunded' THEN 'refund_' ELSE 'release_' END)||p.order_id::text,
  CASE WHEN p.status='released' THEN 'tr_seed_'||substr(p.id::text,1,8) END,
  CASE WHEN p.status='refunded' THEN 're_seed_'||substr(p.id::text,1,8) END,
  p.prepper_payout_pence, 'gbp',
  CASE WHEN p.status='refunded' THEN 'seed refund' ELSE 'seed escrow release' END,
  p.updated_at
FROM public.payments p
WHERE p.status IN ('released','refunded')
ON CONFLICT (id) DO NOTHING;

-- ── Section 10: pending dispute resolutions (>£100 disputed, awaiting 2nd admin)

INSERT INTO public.pending_dispute_resolutions (id, order_id, resolution, amount_pence, status, proposed_by, proposed_at)
SELECT _s('pdr-'||o.id), o.id,
  (ARRAY['for_prepper','for_customer','split'])[1+(abs(hashtext(o.id::text))%3)],
  o.total_pence, 'pending', _s('sys'), o.updated_at
FROM public.orders o
WHERE o.escrow_status='disputed' AND o.total_pence > 10000
ON CONFLICT DO NOTHING;

-- ── Restore triggers + repopulate anything triggers would have done ───────────
SET LOCAL session_replication_role = origin;

DROP FUNCTION IF EXISTS _s(TEXT);
COMMIT;
