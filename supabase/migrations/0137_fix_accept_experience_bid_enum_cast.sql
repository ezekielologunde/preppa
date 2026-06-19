-- Fix accept_experience_bid: CASE expression returns text, which PostgreSQL
-- cannot implicitly cast to the bid_status enum in an assignment context.
-- Add explicit ::bid_status casts. Also make experience_status and order_status
-- assignments explicit for consistency.

create or replace function accept_experience_bid(
  p_bid uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me       uuid := auth.uid();
  v_bid      record;
  v_req      record;
  v_order_id uuid;
begin
  if v_me is null then raise exception 'auth_required'; end if;

  select * into v_bid from public.experience_bids where id = p_bid for update;
  if not found                          then raise exception 'bid_not_found'; end if;
  if v_bid.status != 'pending'::bid_status then raise exception 'bid_already_processed'; end if;

  select * into v_req from public.experience_requests where id = v_bid.request_id for update;
  if not found                           then raise exception 'request_not_found'; end if;
  if v_req.status != 'open'::experience_status then raise exception 'request_not_open'; end if;
  if v_req.customer_id != v_me          then raise exception 'forbidden'; end if;

  -- Create order (meetup fulfillment for experience/catering)
  insert into public.orders (
    customer_id, prepper_id, status,
    subtotal, tip, total, delivery_fee, fulfillment_type
  ) values (
    v_me, v_bid.prepper_id, 'confirmed'::order_status,
    v_bid.amount, 0, v_bid.amount, 0, 'meetup'
  ) returning id into v_order_id;

  -- Accept this bid, decline all others on this request
  -- Cast required: CASE returns text, PostgreSQL won't auto-cast to bid_status enum
  update public.experience_bids
  set status = case
    when id = p_bid then 'accepted'::bid_status
    else                 'declined'::bid_status
  end
  where request_id = v_bid.request_id;

  -- Close the request
  update public.experience_requests
  set status = 'booked'::experience_status
  where id = v_bid.request_id;

  return v_order_id;
end $$;
