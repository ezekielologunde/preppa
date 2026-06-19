-- ============================================================================
-- 0067 — remove unpublished meals from all user carts
--
-- Trigger: when a meal's status changes FROM 'published' to any other value
-- (archived, paused, draft), delete all cart_items rows referencing that meal.
-- Keeps carts consistent — customers cannot hold or checkout stale/unavailable
-- items that were in flight when a prepper unpublishes.
--
-- Columns verified against 0001_core_schema.sql:
--   cart_items : meal_id (uuid, fk → meals.id)
-- ============================================================================

create or replace function cleanup_cart_on_meal_status_change()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'published' and new.status <> 'published' then
    delete from cart_items where meal_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists t_meal_unpublish_cart_cleanup on meals;
create trigger t_meal_unpublish_cart_cleanup
  after update on meals
  for each row
  execute function cleanup_cart_on_meal_status_change();
