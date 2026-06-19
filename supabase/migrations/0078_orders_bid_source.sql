-- 0078 — Orders: add source + bid_id so bid-originated orders are traceable.
-- The stripe-webhook bid_payment branch uses bid_id to locate the order and
-- record payment; source lets the prepper UI distinguish bid orders from cart.

alter table public.orders
  add column if not exists source text not null default 'direct'
    check (source in ('direct', 'bid', 'home_cook', 'experience')),
  add column if not exists bid_id uuid
    references public.meal_request_bids(id) on delete set null;

create index if not exists orders_bid_id_idx on public.orders(bid_id)
  where bid_id is not null;

-- Backfill existing bid-derived orders: not possible without a join table that
-- doesn't yet exist, so leave source = 'direct' for historical rows. New orders
-- via create_order_from_meal_bid will set source = 'bid' and bid_id going forward.

-- Update create_order_from_meal_bid to stamp source + bid_id on the new order.
create or replace function create_order_from_meal_bid(
  p_bid_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me       uuid := auth.uid();
  v_bid      record;
  v_req      record;
  v_order_id uuid;
  v_total    numeric;
begin
  if v_me is null then raise exception 'auth_required'; end if;

  -- Lock bid row first to prevent concurrent accepts
  select * into v_bid
  from public.meal_request_bids
  where id = p_bid_id
  for update;
  if not found               then raise exception 'bid_not_found'; end if;
  if v_bid.status != 'pending' then raise exception 'bid_already_processed'; end if;

  select * into v_req
  from public.meal_requests
  where id = v_bid.request_id
  for update;
  if not found               then raise exception 'request_not_found'; end if;
  if v_req.status != 'open'  then raise exception 'request_not_open'; end if;
  if v_req.customer_id != v_me then raise exception 'forbidden'; end if;

  v_total := v_bid.price_per_serving * v_req.servings;

  -- Create the order, stamping source and bid_id for webhook traceability
  insert into public.orders (
    customer_id, prepper_id, status,
    subtotal, tip, total, delivery_fee, fulfillment_type,
    source, bid_id
  ) values (
    v_me, v_bid.prepper_id, 'confirmed',
    v_total, 0, v_total, 0, 'pickup',
    'bid', p_bid_id
  ) returning id into v_order_id;

  -- Accept chosen bid; reject all others on this request
  update public.meal_request_bids
  set status = case when id = p_bid_id then 'accepted' else 'rejected' end
  where request_id = v_bid.request_id;

  -- Close the request
  update public.meal_requests set status = 'fulfilled' where id = v_bid.request_id;

  return v_order_id;
end $$;

grant execute on function create_order_from_meal_bid(uuid) to authenticated;
