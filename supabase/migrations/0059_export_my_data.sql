-- ============================================================================
-- Preppa — Self-service data export (GDPR Art. 20 / CCPA right-to-access).
--
-- export_my_data() returns the signed-in user's full personal dataset as JSON.
-- READ-ONLY. SECURITY DEFINER so the export is complete regardless of per-table
-- RLS, but EVERY subquery is filtered by auth.uid() — a caller only ever gets
-- their own rows. Raw `payments` (Stripe internals) are excluded; order rows
-- already carry the user-facing totals. Additive + re-runnable.
-- ============================================================================

create or replace function export_my_data()
  returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return jsonb_build_object(
    'export_format', 'preppa.account.v1',
    'exported_at',   now(),
    'account',       (select to_jsonb(p) from profiles p where p.id = v_uid),
    'addresses',     coalesce((select jsonb_agg(to_jsonb(a))  from addresses a              where a.user_id     = v_uid), '[]'::jsonb),
    'orders',        coalesce((select jsonb_agg(to_jsonb(o))  from orders o                 where o.customer_id = v_uid), '[]'::jsonb),
    'order_items',   coalesce((select jsonb_agg(to_jsonb(oi)) from order_items oi join orders o on o.id = oi.order_id where o.customer_id = v_uid), '[]'::jsonb),
    'reviews',       coalesce((select jsonb_agg(to_jsonb(r))  from reviews r                where r.author_id   = v_uid), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s))  from subscriptions s          where s.customer_id = v_uid), '[]'::jsonb),
    'follows',       coalesce((select jsonb_agg(to_jsonb(f))  from follows f                where f.follower_id = v_uid), '[]'::jsonb),
    'notification_preferences', (select to_jsonb(np) from notification_preferences np where np.user_id = v_uid),
    'sent_messages', coalesce((select jsonb_agg(to_jsonb(m))  from messages m               where m.sender_id   = v_uid), '[]'::jsonb),
    'experience_requests', coalesce((select jsonb_agg(to_jsonb(e))  from experience_requests e  where e.customer_id  = v_uid), '[]'::jsonb),
    'meal_requests',       coalesce((select jsonb_agg(to_jsonb(mr)) from meal_requests mr       where mr.customer_id = v_uid), '[]'::jsonb),
    'home_cook_requests',  coalesce((select jsonb_agg(to_jsonb(h))  from home_cook_requests h   where h.customer_id  = v_uid), '[]'::jsonb),
    'custom_meal_plans',   coalesce((select jsonb_agg(to_jsonb(c))  from customer_meal_plans c  where c.customer_id  = v_uid), '[]'::jsonb),
    'memberships',         coalesce((select jsonb_agg(to_jsonb(cm)) from customer_memberships cm where cm.customer_id = v_uid), '[]'::jsonb)
  );
end $$;

revoke all on function export_my_data() from public;
revoke all on function export_my_data() from anon;
grant execute on function export_my_data() to authenticated;
