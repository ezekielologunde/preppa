-- ============================================================================
-- 0061 — limited_qty enforcement in create_order
--
-- 1. meal_remaining_qty(meals) — PostgREST computed column.
--    Returns null for unlimited meals, otherwise max(0, cap - fulfilled_count).
--    Exposed via SELECT as `remaining_qty:meal_remaining_qty`.
--
-- 2. create_order — adds two guards:
--    Pre-check:   rejects checkout if any cart meal is already sold out.
--    Post-insert: auto-pauses limited meals that just hit their cap so they
--                 disappear from discovery on the next query refresh.
--    Both run inside the same SECURITY DEFINER transaction — atomic.
-- ============================================================================

create or replace function public.meal_remaining_qty(meals)
  returns integer
  language sql stable security definer set search_path = public as $$
    select case
      when $1.limited_qty is null then null
      else greatest(0, $1.limited_qty - (
        select count(*)::integer
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.meal_id = $1.id
          and o.status <> 'cancelled'
      ))
    end
  $$;

grant execute on function public.meal_remaining_qty(meals) to anon, authenticated;

create or replace function create_order(
  p_fulfillment fulfillment_type default 'delivery',
  p_address_id  uuid default null,
  p_note        text default null,
  p_tip         numeric default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_cart     uuid;
  v_prepper  uuid;
  v_count    int;
  v_order    uuid := gen_random_uuid();
  v_subtotal numeric := 0;
  v_delivery numeric := 0;
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

  -- Pre-check: reject if any limited meal in the cart is already sold out.
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

  -- Exactly one prepper at this point.
  select m.prepper_id into v_prepper
    from cart_items ci join meals m on m.id = ci.meal_id
    where ci.cart_id = v_cart
    limit 1;

  if p_fulfillment = 'delivery' then v_delivery := 3.99; end if;

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
  -- Runs after order_items are committed so the new order is counted.
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
