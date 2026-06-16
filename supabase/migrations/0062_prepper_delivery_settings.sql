-- ============================================================================
-- 0062 — prepper delivery settings
--
-- 1. delivery_fee, delivery_min_order, delivery_days, delivery_window_start/end
--    added to prepper_profiles.
--
-- 2. update_delivery_settings() — lets approved preppers save their fulfillment
--    preferences. Enforces $2.99 fee floor. Always full-replace (no partial).
--
-- 3. create_order — now reads delivery_fee from prepper_profiles instead of the
--    hardcoded $3.99, and enforces delivery_min_order before inserting.
--    Carries forward all 0061 logic (limited_qty pre-check + auto-pause).
-- ============================================================================

alter table prepper_profiles
  add column if not exists delivery_fee          numeric not null default 3.99
    check (delivery_fee >= 2.99),
  add column if not exists delivery_min_order    numeric not null default 0
    check (delivery_min_order >= 0),
  add column if not exists delivery_days         int[],       -- null = all days; {0..6} = Sun..Sat
  add column if not exists delivery_window_start time,        -- null = no restriction
  add column if not exists delivery_window_end   time;        -- null = no restriction

-- Preppers configure their own fulfillment options.
-- Always a full replace — pass current values for unchanged fields.
create or replace function update_delivery_settings(
  p_delivers              boolean,
  p_pickup                boolean,
  p_delivery_fee          numeric,
  p_delivery_min_order    numeric,
  p_delivery_radius_km    numeric,
  p_delivery_days         int[],
  p_delivery_window_start time,
  p_delivery_window_end   time
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_delivery_fee < 2.99 then
    raise exception 'Delivery fee must be at least $2.99';
  end if;
  update prepper_profiles set
    delivers              = p_delivers,
    pickup                = p_pickup,
    delivery_fee          = p_delivery_fee,
    delivery_min_order    = p_delivery_min_order,
    delivery_radius_km    = p_delivery_radius_km,
    delivery_days         = p_delivery_days,
    delivery_window_start = p_delivery_window_start,
    delivery_window_end   = p_delivery_window_end
  where user_id = v_user;
  if not found then raise exception 'Prepper profile not found'; end if;
end $$;

grant execute on function update_delivery_settings(boolean, boolean, numeric, numeric, numeric, int[], time, time)
  to authenticated;

-- create_order: reads prepper's delivery_fee; enforces delivery_min_order.
-- Carries forward all 0061 logic (limited_qty pre-check + auto-pause).
create or replace function create_order(
  p_fulfillment fulfillment_type default 'delivery',
  p_address_id  uuid             default null,
  p_note        text             default null,
  p_tip         numeric          default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user      uuid    := auth.uid();
  v_cart      uuid;
  v_prepper   uuid;
  v_count     int;
  v_order     uuid    := gen_random_uuid();
  v_subtotal  numeric := 0;
  v_delivery  numeric := 0;
  v_min_order numeric := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select id into v_cart from carts where user_id = v_user;
  if v_cart is null then raise exception 'No cart for user'; end if;

  select count(distinct m.prepper_id)
    into v_count
    from cart_items ci join meals m on m.id = ci.meal_id
    where ci.cart_id = v_cart;

  if coalesce(v_count, 0) = 0 then raise exception 'Cart is empty'; end if;
  if v_count > 1 then raise exception 'Cart has items from multiple preppers'; end if;
  if exists (select 1 from cart_items ci join meals m on m.id = ci.meal_id
             where ci.cart_id = v_cart and m.status <> 'published') then
    raise exception 'Cart contains an unavailable meal';
  end if;

  -- Limited-qty pre-check.
  if exists (
    select 1
    from cart_items ci
    join meals m on m.id = ci.meal_id
    where ci.cart_id = v_cart
      and m.is_limited = true
      and m.limited_qty is not null
      and (
        select count(*)
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.meal_id = m.id
          and o.status <> 'cancelled'
      ) >= m.limited_qty
  ) then
    raise exception 'One or more limited items in your cart are sold out';
  end if;

  select m.prepper_id into v_prepper
    from cart_items ci join meals m on m.id = ci.meal_id
    where ci.cart_id = v_cart
    limit 1;

  -- Delivery: validate caller owns the address, then read prepper's fee + enforce min order.
  if p_fulfillment = 'delivery' then
    if p_address_id is null then
      raise exception 'Delivery address required';
    end if;
    if not exists (select 1 from addresses where id = p_address_id and user_id = v_user) then
      raise exception 'Invalid delivery address';
    end if;
    select coalesce(delivery_fee, 3.99), coalesce(delivery_min_order, 0)
      into v_delivery, v_min_order
      from prepper_profiles
      where id = v_prepper;
    v_delivery := coalesce(v_delivery, 3.99);
    if v_min_order > 0 then
      select coalesce(sum((m.base_price + coalesce(v.price_delta, 0)) * ci.quantity), 0)
        into v_subtotal
        from cart_items ci
        join meals m on m.id = ci.meal_id
        left join meal_variants v on v.id = ci.variant_id
        where ci.cart_id = v_cart;
      if v_subtotal < v_min_order then
        raise exception 'Minimum order for delivery is $%.', v_min_order;
      end if;
      v_subtotal := 0;
    end if;
  end if;

  insert into orders (id, customer_id, prepper_id, status, fulfillment_type,
                      address_id, fulfillment_note, delivery_fee, tip)
    values (v_order, v_user, v_prepper, 'pending', p_fulfillment,
            p_address_id, nullif(btrim(p_note), ''), v_delivery,
            greatest(coalesce(p_tip, 0), 0));

  insert into order_items (order_id, meal_id, variant_id, quantity, unit_price, total)
    select v_order, ci.meal_id, ci.variant_id, ci.quantity,
           (m.base_price + coalesce(v.price_delta, 0)),
           (m.base_price + coalesce(v.price_delta, 0)) * ci.quantity
    from cart_items ci
    join meals m on m.id = ci.meal_id
    left join meal_variants v on v.id = ci.variant_id
    where ci.cart_id = v_cart;

  select coalesce(sum(total), 0) into v_subtotal from order_items where order_id = v_order;
  update orders set subtotal = v_subtotal, total = v_subtotal + v_delivery + tip
    where id = v_order;

  -- Auto-pause limited meals that just hit their cap.
  update meals m
  set status = 'paused'
  where m.id in (
    select distinct oi.meal_id from order_items oi where oi.order_id = v_order
  )
    and m.is_limited = true
    and m.limited_qty is not null
    and m.status = 'published'
    and (
      select count(*)
      from order_items oi2
      join orders o on o.id = oi2.order_id
      where oi2.meal_id = m.id
        and o.status <> 'cancelled'
    ) >= m.limited_qty;

  delete from cart_items where cart_id = v_cart;
  return v_order;
end $$;

grant execute on function create_order(fulfillment_type, uuid, text, numeric) to authenticated;
