-- ============================================================================
-- 0023 — Frictionless payouts: Preppa pays the cook. Cooks never set up
-- Stripe. The card-processing fee (exact, from Stripe's balance transaction)
-- and the platform fee (rate from fee_config) are calculated automatically per
-- payment and deducted from the cook's earnings.
--
-- • fee_config: single admin-tunable row (platform_pct 15%, stripe 2.9%+$0.30
--   defaults). Authenticated read (preppers can see the rates); admin update.
-- • payments: + stripe_fee, platform_fee, net_amount snapshot columns.
-- • apply_payment_fees(order, stripe_fee): service-role-only; exact fee from
--   the webhook, estimated from fee_config when null.
-- • my_prepper_earnings(): now reports gross, stripe_fees, platform_fees and
--   true net-after-fees (refunded payments contribute 0).
-- ============================================================================

create table if not exists fee_config (
  id smallint primary key default 1 check (id = 1),
  platform_pct numeric not null default 0.15 check (platform_pct >= 0 and platform_pct < 1),
  stripe_pct numeric not null default 0.029 check (stripe_pct >= 0 and stripe_pct < 1),
  stripe_fixed numeric not null default 0.30 check (stripe_fixed >= 0),
  updated_at timestamptz not null default now()
);
insert into fee_config (id) values (1) on conflict (id) do nothing;

alter table fee_config enable row level security;
drop policy if exists p_fee_config_read on fee_config;
create policy p_fee_config_read on fee_config for select to authenticated using (true);
drop policy if exists p_fee_config_admin on fee_config;
create policy p_fee_config_admin on fee_config for update to authenticated
  using (is_admin()) with check (is_admin());

alter table payments add column if not exists stripe_fee numeric not null default 0;
alter table payments add column if not exists platform_fee numeric not null default 0;
alter table payments add column if not exists net_amount numeric not null default 0;

create or replace function apply_payment_fees(p_order_id uuid, p_stripe_fee numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric;
  v_cfg fee_config;
  v_stripe numeric;
  v_platform numeric;
begin
  select amount into v_amount from payments where order_id = p_order_id;
  if v_amount is null then return; end if;
  select * into v_cfg from fee_config where id = 1;
  v_stripe := coalesce(p_stripe_fee, round(v_amount * v_cfg.stripe_pct + v_cfg.stripe_fixed, 2));
  v_platform := round(v_amount * v_cfg.platform_pct, 2);
  update payments
     set stripe_fee = v_stripe,
         platform_fee = v_platform,
         net_amount = greatest(v_amount - v_stripe - v_platform, 0)
   where order_id = p_order_id;
end $$;
revoke execute on function apply_payment_fees(uuid, numeric) from public, anon, authenticated;
grant execute on function apply_payment_fees(uuid, numeric) to service_role;

create or replace function my_prepper_earnings()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_prepper uuid;
  v_stats   json;
  v_recent  json;
begin
  select id into v_prepper from prepper_profiles where user_id = auth.uid();
  if v_prepper is null then
    return json_build_object('is_prepper', false);
  end if;

  with pay as (
    select p.amount,
           p.stripe_fee,
           p.platform_fee,
           p.created_at,
           coalesce((select sum(r.amount) from refunds r where r.payment_id = p.id), 0) as refunded,
           greatest(p.net_amount - coalesce((select sum(r.amount) from refunds r where r.payment_id = p.id), 0), 0) as net
    from payments p
    join orders o on o.id = p.order_id
    where o.prepper_id = v_prepper
      and p.status in ('succeeded', 'partially_refunded', 'refunded')
  )
  select json_build_object(
    'gross_total',    coalesce(sum(amount), 0),
    'stripe_fees',    coalesce(sum(stripe_fee), 0),
    'platform_fees',  coalesce(sum(platform_fee), 0),
    'refunded_total', coalesce(sum(refunded), 0),
    'net_total',      coalesce(sum(net), 0),
    'net_week',       coalesce(sum(case when created_at >= now() - interval '7 days'  then net else 0 end), 0),
    'net_month',      coalesce(sum(case when created_at >= now() - interval '30 days' then net else 0 end), 0),
    'orders_paid',    count(*)
  ) into v_stats from pay;

  select coalesce(json_agg(row_to_json(x)), '[]'::json) into v_recent from (
    select o.id as order_id,
           p.created_at,
           o.status,
           p.amount,
           p.stripe_fee + p.platform_fee as fees,
           greatest(p.net_amount - coalesce((select sum(r.amount) from refunds r where r.payment_id = p.id), 0), 0) as net,
           coalesce((select sum(r.amount) from refunds r where r.payment_id = p.id), 0) as refunded,
           split_part(coalesce(cust.full_name, ''), ' ', 1) as customer_first,
           (select m.title from order_items oi join meals m on m.id = oi.meal_id
              where oi.order_id = o.id order by m.title limit 1) as first_item,
           (select count(*) from order_items oi where oi.order_id = o.id) as item_count
    from payments p
    join orders o on o.id = p.order_id
    join profiles cust on cust.id = o.customer_id
    where o.prepper_id = v_prepper
      and p.status in ('succeeded', 'partially_refunded', 'refunded')
    order by p.created_at desc
    limit 12
  ) x;

  return (select (v_stats::jsonb || jsonb_build_object('is_prepper', true, 'recent', v_recent))::json);
end $$;
revoke execute on function my_prepper_earnings() from public, anon;
grant execute on function my_prepper_earnings() to authenticated, service_role;
