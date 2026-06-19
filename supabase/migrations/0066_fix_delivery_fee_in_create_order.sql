-- ============================================================================
-- 0066 — fix delivery fee in create_order (dynamic lookup from prepper_profiles)
--
-- Context: 0061 hardcoded v_delivery := 3.99. 0062 fixed this by reading
-- delivery_fee from prepper_profiles and added delivery_min_order enforcement.
-- This migration re-declares the authoritative create_order function so the fix
-- is explicit and independently auditable in the migration history.
--
-- The single targeted change vs. 0061:
--   BEFORE:  if p_fulfillment = 'delivery' then v_delivery := 3.99; end if;
--   AFTER:   reads coalesce(pp.delivery_fee, 3.99) from prepper_profiles,
--            enforces delivery_min_order, and validates address ownership.
--
-- Full function body carried forward from 0062 (includes all 0061 logic:
-- limited_qty pre-check and auto-pause). This is a safe idempotent re-declare.
-- ============================================================================

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

  -- Delivery: validate address ownership, then read prepper's fee + enforce min order.
  -- KEY FIX: delivery_fee is read from prepper_profiles, not hardcoded.
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
