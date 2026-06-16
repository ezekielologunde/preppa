-- ============================================================================
-- 0063 — prepper city / state
--
-- Adds city + state to prepper_profiles so the discovery feed can filter to
-- local kitchens. Replaces update_delivery_settings with an extended version
-- that saves city + state alongside fulfillment settings.
-- ============================================================================

alter table prepper_profiles
  add column if not exists city  text,
  add column if not exists state text;

-- Drop old 8-param function before replacing with 10-param version so there is
-- no ambiguity when PostgREST resolves the function by name + named params.
drop function if exists update_delivery_settings(boolean, boolean, numeric, numeric, numeric, int[], time, time);

create or replace function update_delivery_settings(
  p_delivers              boolean,
  p_pickup                boolean,
  p_delivery_fee          numeric,
  p_delivery_min_order    numeric,
  p_delivery_radius_km    numeric,
  p_delivery_days         int[],
  p_delivery_window_start time,
  p_delivery_window_end   time,
  p_city                  text default null,
  p_state                 text default null
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
    delivery_window_end   = p_delivery_window_end,
    city                  = nullif(btrim(coalesce(p_city, '')), ''),
    state                 = nullif(btrim(coalesce(p_state, '')), '')
  where user_id = v_user;
  if not found then raise exception 'Prepper profile not found'; end if;
end $$;

grant execute on function update_delivery_settings(boolean, boolean, numeric, numeric, numeric, int[], time, time, text, text)
  to authenticated;
