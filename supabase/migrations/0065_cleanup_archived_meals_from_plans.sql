-- ============================================================================
-- 0065 — remove archived meals from customer plans and notify customers
--
-- Trigger: after a meal's status transitions TO 'archived' from any other
-- value:
--   1. Insert a 'promotion' notification for each affected customer.
--      (Note: notification_type enum has no 'info' value; 'promotion' is the
--       closest available catch-all for informational alerts. Use 'order' if
--       you prefer a stricter semantic tie to commerce.)
--   2. Delete all customer_meal_plan_items rows referencing that meal.
--
-- Depends on: customer_meal_plans, customer_meal_plan_items tables.
-- Columns verified against 0001_core_schema.sql:
--   notifications : user_id, type (notification_type enum), title, body,
--                   data (jsonb), created_at
-- ============================================================================

create or replace function cleanup_archived_meal_from_plans()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'archived' and new.status = 'archived' then
    -- Notify customers who had this meal in their plan.
    insert into notifications (user_id, type, title, body, data, created_at)
    select distinct
      cmp.customer_id,
      'promotion'::notification_type,
      'Meal removed from your plan',
      new.title || ' is no longer available and was removed from your meal plan.',
      jsonb_build_object('meal_id', new.id),
      now()
    from customer_meal_plan_items cmpi
    join customer_meal_plans cmp on cmp.id = cmpi.plan_id
    where cmpi.meal_id = new.id;

    -- Delete the plan items.
    delete from customer_meal_plan_items where meal_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists t_meal_archive_cleanup on meals;
create trigger t_meal_archive_cleanup
  after update on meals
  for each row
  execute function cleanup_archived_meal_from_plans();
