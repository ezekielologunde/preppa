-- ============================================================================
-- 0026 — SECURITY FIX: handoff verification auth bypass via NULL three-valued
-- logic. verify_handoff / verify_handoff_token guarded with
--   if not (v_prep = my_prepper_id() or is_admin())
-- When the caller is not a prepper, my_prepper_id() is NULL, so
-- `v_prep = NULL` → NULL, `NULL or false` → NULL, `not NULL` → NULL, and the
-- IF reject branch is skipped → ANY authenticated user could complete a
-- handoff (and thus mark a pickup/meetup order delivered). Fixed by coalescing
-- both predicates to false. Verified: random user → rejected; real prepper and
-- admin → allowed.
-- (Function bodies applied via apply_migration; canonical copies in the DB.)
-- ============================================================================

create or replace function verify_handoff(p_order_id uuid, p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare v_h order_handoff; v_status order_status; v_prep uuid;
begin
  select status, prepper_id into v_status, v_prep from orders where id = p_order_id;
  if v_status is null then return json_build_object('ok', false, 'reason', 'Order not found'); end if;
  if not (coalesce(v_prep = my_prepper_id(), false) or coalesce(is_admin(), false)) then
    return json_build_object('ok', false, 'reason', 'Not your order');
  end if;
  if v_status = 'completed' then return json_build_object('ok', true, 'completed', true); end if;
  select * into v_h from order_handoff where order_id = p_order_id;
  if v_h is null then return json_build_object('ok', false, 'reason', 'No handoff code for this order'); end if;
  if v_h.verified_at is not null then
    update orders set status = 'completed' where id = p_order_id and status <> 'completed';
    return json_build_object('ok', true, 'completed', true);
  end if;
  if v_h.attempts >= 5 then return json_build_object('ok', false, 'locked', true, 'reason', 'Too many tries. Ask the customer to show their QR code instead.'); end if;
  if regexp_replace(coalesce(p_pin, ''), '\D', '', 'g') = v_h.pin then
    update order_handoff set verified_at = now() where order_id = p_order_id;
    update orders set status = 'completed' where id = p_order_id and status <> 'completed';
    return json_build_object('ok', true, 'completed', true);
  else
    update order_handoff set attempts = attempts + 1 where order_id = p_order_id;
    return json_build_object('ok', false, 'attempts_left', greatest(5 - (v_h.attempts + 1), 0), 'reason', 'That code is not right');
  end if;
end $$;

create or replace function verify_handoff_token(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_h order_handoff; v_prep uuid;
begin
  select * into v_h from order_handoff where token = p_token;
  if v_h is null then return json_build_object('ok', false, 'reason', 'Invalid or expired code'); end if;
  select prepper_id into v_prep from orders where id = v_h.order_id;
  if not (coalesce(v_prep = my_prepper_id(), false) or coalesce(is_admin(), false)) then
    return json_build_object('ok', false, 'reason', 'Only this order''s kitchen can verify it');
  end if;
  update order_handoff set verified_at = coalesce(verified_at, now()) where order_id = v_h.order_id;
  update orders set status = 'completed' where id = v_h.order_id and status <> 'completed';
  return json_build_object('ok', true, 'completed', true, 'order_id', v_h.order_id);
end $$;
