-- ============================================================================
-- 0064 — notify followers when a prepper publishes a meal
--
-- Trigger: after a meal's status transitions TO 'published' from any other
-- value, insert a 'drop' notification for every follower of that prepper.
--
-- Columns verified against 0001_core_schema.sql:
--   notifications : user_id, type (notification_type enum), title, body,
--                   data (jsonb), created_at
--   follows       : follower_id, prepper_id
--   prepper_profiles : display_name
-- ============================================================================

create or replace function notify_followers_on_publish()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'published' and new.status = 'published' then
    insert into notifications (user_id, type, title, body, data, created_at)
    select
      f.follower_id,
      'drop'::notification_type,
      'New drop from ' || coalesce(pp.display_name, 'your kitchen'),
      new.title,
      jsonb_build_object('meal_id', new.id, 'prepper_id', new.prepper_id),
      now()
    from follows f
    join prepper_profiles pp on pp.id = new.prepper_id
    where f.prepper_id = new.prepper_id;
  end if;
  return new;
end $$;

drop trigger if exists t_meal_publish_notify on meals;
create trigger t_meal_publish_notify
  after update on meals
  for each row
  execute function notify_followers_on_publish();
