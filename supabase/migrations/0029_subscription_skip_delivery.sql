-- ============================================================================
-- 0029 — Meal-plan skip-week. A customer can skip their next delivery, pushing
-- next_billing_at forward by one cycle (weekly/biweekly/monthly) with no charge
-- that period. Auth is fail-closed (coalesce — see the 0026/0027 NULL-logic
-- lesson). Verified: owner skips (+1 cycle), random user rejected.
-- ============================================================================
create or replace function skip_subscription_delivery(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_sub subscriptions; v_interval interval; v_next timestamptz;
begin
  select * into v_sub from subscriptions where id = p_id;
  if v_sub.id is null then return json_build_object('ok', false, 'reason', 'Plan not found'); end if;
  if not (coalesce(v_sub.customer_id = auth.uid(), false) or coalesce(is_admin(), false)) then
    return json_build_object('ok', false, 'reason', 'Not your plan');
  end if;
  if v_sub.status <> 'active' then return json_build_object('ok', false, 'reason', 'Plan is not active'); end if;
  v_interval := case v_sub.frequency
    when 'weekly'   then interval '7 days'
    when 'biweekly' then interval '14 days'
    when 'monthly'  then interval '1 month'
    else interval '7 days' end;
  update subscriptions set next_billing_at = coalesce(next_billing_at, now()) + v_interval
    where id = p_id returning next_billing_at into v_next;
  return json_build_object('ok', true, 'next', v_next);
end $$;
revoke execute on function skip_subscription_delivery(uuid) from public, anon;
grant execute on function skip_subscription_delivery(uuid) to authenticated, service_role;
