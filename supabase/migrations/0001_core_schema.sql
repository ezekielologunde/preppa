-- ============================================================================
-- Preppa — Core Schema (Identity · Prepper · Food · Commerce · Delivery · Social)
-- Run in Supabase → SQL Editor (or `supabase db push`).
--
-- Security model: Postgres Row Level Security (RLS) enforces tenant isolation —
-- customers see only their data, preppers only their business data, admins all.
-- This is the DB-layer implementation of validateOwnership/validateOrderOwnership.
-- Content (feed/live) + Analytics domains land in a later migration.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_status        as enum ('active','suspended','deleted');
  create type meal_status        as enum ('draft','published','paused','archived');
  create type order_status        as enum ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled');
  create type fulfillment_type    as enum ('delivery','pickup');
  create type payment_status      as enum ('pending','processing','succeeded','failed','refunded','partially_refunded');
  create type subscription_status as enum ('active','paused','cancelled');
  create type cert_status         as enum ('pending','verified','rejected');
  create type notification_type   as enum ('order','payment','chat','follow','review','promotion','drop','live');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- updated_at helper
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================================
-- IDENTITY DOMAIN
-- ============================================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  phone       text,
  full_name   text,
  avatar_url  text,
  status      user_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table roles (
  id   smallserial primary key,
  key  text unique not null            -- customer | prepper | admin | moderator | support | delivery_partner
);
insert into roles (key) values
  ('customer'),('prepper'),('admin'),('moderator'),('support'),('delivery_partner')
on conflict do nothing;

create table user_roles (
  user_id    uuid not null references profiles(id) on delete cascade,
  role_id    smallint not null references roles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  label       text,
  line1       text not null,
  line2       text,
  city        text,
  state       text,
  postal_code text,
  country     text default 'US',
  lat         double precision,
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email   boolean not null default true,
  sms     boolean not null default false,
  push    boolean not null default true
);

-- ----------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER so policies can read role/prepper tables)
-- ----------------------------------------------------------------------------
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key in ('admin')
  );
$$;

create or replace function has_role(p_key text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key = p_key
  );
$$;

create or replace function my_prepper_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from prepper_profiles where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- New-user bootstrap: profile + customer role + cart + notif prefs
-- ----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  insert into user_roles (user_id, role_id) select new.id, id from roles where key = 'customer'
    on conflict do nothing;
  insert into notification_preferences (user_id) values (new.id) on conflict do nothing;
  insert into carts (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- ============================================================================
-- PREPPER DOMAIN
-- ============================================================================
create table prepper_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique not null references profiles(id) on delete cascade,
  display_name      text not null,
  bio               text,
  verified          boolean not null default false,
  delivery_radius_km numeric default 10,
  specialties       text[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table kitchens (
  id           uuid primary key default gen_random_uuid(),
  prepper_id   uuid not null references prepper_profiles(id) on delete cascade,
  name         text not null,
  address      text,
  kitchen_type text,                   -- home | food_truck | commercial
  health_score int,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table certifications (
  id           uuid primary key default gen_random_uuid(),
  prepper_id   uuid not null references prepper_profiles(id) on delete cascade,
  type         text not null,          -- servsafe | food_handler | state_license
  document_url text,
  status       cert_status not null default 'pending',
  expires_at   timestamptz,
  verified_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table availability_schedules (
  id          uuid primary key default gen_random_uuid(),
  prepper_id  uuid not null references prepper_profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  capacity    int not null default 0
);

create table delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  prepper_id   uuid not null references prepper_profiles(id) on delete cascade,
  postal_codes text[],
  radius_km    numeric,
  fee          numeric not null default 0
);

create table pickup_locations (
  id         uuid primary key default gen_random_uuid(),
  prepper_id uuid not null references prepper_profiles(id) on delete cascade,
  name       text not null,
  address    text,
  lat        double precision,
  lng        double precision
);

create table follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  prepper_id  uuid not null references prepper_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (follower_id, prepper_id)
);

-- ============================================================================
-- FOOD DOMAIN
-- ============================================================================
create table meal_categories (id smallserial primary key, key text unique not null, name text not null);
insert into meal_categories (key, name) values
  ('breakfast','Breakfast'),('lunch','Lunch'),('dinner','Dinner'),('snacks','Snacks'),
  ('desserts','Desserts'),('vegan','Vegan'),('healthy','Healthy') on conflict do nothing;

create table allergens (id smallserial primary key, key text unique not null, name text not null);
insert into allergens (key, name) values
  ('dairy','Dairy'),('eggs','Eggs'),('peanuts','Peanuts'),('tree_nuts','Tree Nuts'),
  ('soy','Soy'),('gluten','Gluten'),('shellfish','Shellfish'),('fish','Fish') on conflict do nothing;

create table ingredients (id serial primary key, name text unique not null);

create table meals (
  id           uuid primary key default gen_random_uuid(),
  prepper_id   uuid not null references prepper_profiles(id) on delete cascade,
  category_id  smallint references meal_categories(id),
  title        text not null,
  description  text,
  base_price   numeric not null check (base_price >= 0),
  prep_time_min int,
  status       meal_status not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table meal_variants (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references meals(id) on delete cascade,
  name        text not null,          -- Small | Medium | Large | Family Pack
  price_delta numeric not null default 0,
  is_default  boolean not null default false
);

create table nutrition_profiles (
  meal_id  uuid primary key references meals(id) on delete cascade,
  calories int, protein int, carbs int, fat int, sodium int, fiber int
);

create table meal_ingredients (
  meal_id       uuid references meals(id) on delete cascade,
  ingredient_id int references ingredients(id) on delete cascade,
  primary key (meal_id, ingredient_id)
);

create table meal_allergens (
  meal_id     uuid references meals(id) on delete cascade,
  allergen_id smallint references allergens(id) on delete cascade,
  primary key (meal_id, allergen_id)
);

create table meal_images (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references meals(id) on delete cascade,
  url         text not null,
  order_index int not null default 0,
  alt_text    text
);

create table meal_videos (
  id            uuid primary key default gen_random_uuid(),
  meal_id       uuid not null references meals(id) on delete cascade,
  video_url     text not null,
  thumbnail_url text,
  duration_sec  int
);

-- ============================================================================
-- COMMERCE DOMAIN
-- ============================================================================
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id             uuid primary key default gen_random_uuid(),
  cart_id        uuid not null references carts(id) on delete cascade,
  meal_id        uuid not null references meals(id) on delete cascade,
  variant_id     uuid references meal_variants(id),
  quantity       int not null check (quantity > 0),
  price_snapshot numeric not null,
  created_at     timestamptz not null default now()
);

create table coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  discount_type text not null,         -- percent | fixed
  discount_value numeric not null,
  active        boolean not null default true,
  expires_at    timestamptz
);

create table orders (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references profiles(id),
  prepper_id       uuid not null references prepper_profiles(id),
  status           order_status not null default 'pending',
  fulfillment_type fulfillment_type not null default 'delivery',
  address_id       uuid references addresses(id),
  subtotal         numeric not null default 0,
  tax              numeric not null default 0,
  delivery_fee     numeric not null default 0,
  service_fee      numeric not null default 0,
  tip              numeric not null default 0,
  total            numeric not null default 0,
  coupon_id        uuid references coupons(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  meal_id    uuid not null references meals(id),
  variant_id uuid references meal_variants(id),
  quantity   int not null check (quantity > 0),
  unit_price numeric not null,
  total      numeric not null
);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  provider       text not null default 'stripe',
  transaction_id text,
  status         payment_status not null default 'pending',
  amount         numeric not null,
  created_at     timestamptz not null default now()
);

create table refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references payments(id) on delete cascade,
  amount       numeric not null,
  reason       text,
  processed_by uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table subscriptions (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references profiles(id) on delete cascade,
  prepper_id     uuid not null references prepper_profiles(id) on delete cascade,
  plan_name      text not null,
  frequency      text not null,        -- weekly | biweekly | monthly
  next_billing_at timestamptz,
  status         subscription_status not null default 'active',
  created_at     timestamptz not null default now()
);

-- ============================================================================
-- DELIVERY DOMAIN
-- ============================================================================
create table delivery_tracking (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid unique not null references orders(id) on delete cascade,
  driver_id    uuid references profiles(id),
  status       text not null default 'pending',  -- pending | dispatched | en_route | delivered
  dispatched_at timestamptz,
  eta          timestamptz,
  delivered_at timestamptz
);

-- ============================================================================
-- SOCIAL DOMAIN
-- ============================================================================
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid unique not null references orders(id) on delete cascade,  -- one review per order
  author_id  uuid not null references profiles(id) on delete cascade,
  prepper_id uuid not null references prepper_profiles(id) on delete cascade,
  meal_id    uuid references meals(id),
  rating     int not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now()
);

-- Async read-model: never compute rating live on every query.
create table prepper_rating_summary (
  prepper_id     uuid primary key references prepper_profiles(id) on delete cascade,
  average_rating numeric not null default 0,
  total_reviews  int not null default 0,
  five_star      int not null default 0,
  updated_at     timestamptz not null default now()
);

create table conversations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id         uuid references profiles(id) on delete cascade,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text,
  attachment_url  text,
  created_at      timestamptz not null default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  body       text,
  data       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create trigger t_profiles_updated   before update on profiles         for each row execute function set_updated_at();
create trigger t_prepper_updated     before update on prepper_profiles for each row execute function set_updated_at();
create trigger t_meals_updated       before update on meals            for each row execute function set_updated_at();
create trigger t_orders_updated      before update on orders           for each row execute function set_updated_at();
create trigger t_carts_updated       before update on carts            for each row execute function set_updated_at();

-- ============================================================================
-- Indexes (index aggressively — query keys + created_at)
-- ============================================================================
create index idx_user_roles_user      on user_roles(user_id);
create index idx_addresses_user       on addresses(user_id);
create index idx_kitchens_prepper     on kitchens(prepper_id);
create index idx_certs_prepper        on certifications(prepper_id);
create index idx_avail_prepper        on availability_schedules(prepper_id);
create index idx_follows_prepper      on follows(prepper_id);
create index idx_follows_follower     on follows(follower_id);
create index idx_meals_prepper        on meals(prepper_id);
create index idx_meals_category       on meals(category_id);
create index idx_meals_status         on meals(status);
create index idx_meal_variants_meal   on meal_variants(meal_id);
create index idx_meal_images_meal     on meal_images(meal_id);
create index idx_cart_items_cart      on cart_items(cart_id);
create index idx_orders_customer      on orders(customer_id, created_at desc);
create index idx_orders_prepper       on orders(prepper_id, created_at desc);
create index idx_orders_status        on orders(status);
create index idx_order_items_order    on order_items(order_id);
create index idx_payments_order       on payments(order_id);
create index idx_subscriptions_cust   on subscriptions(customer_id);
create index idx_reviews_prepper      on reviews(prepper_id);
create index idx_messages_conv        on messages(conversation_id, created_at);
create index idx_conv_part_user       on conversation_participants(user_id);
create index idx_notifications_user   on notifications(user_id, read, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Enable on every table, then add policies. Default-deny when no policy matches.
-- Writes with no policy => only the service_role key can perform them (correct
-- for payments/refunds/summaries which must never be client-trusted).
-- ============================================================================
alter table profiles                  enable row level security;
alter table roles                      enable row level security;
alter table user_roles                 enable row level security;
alter table addresses                  enable row level security;
alter table notification_preferences   enable row level security;
alter table prepper_profiles           enable row level security;
alter table kitchens                   enable row level security;
alter table certifications             enable row level security;
alter table availability_schedules     enable row level security;
alter table delivery_zones             enable row level security;
alter table pickup_locations           enable row level security;
alter table follows                    enable row level security;
alter table meal_categories            enable row level security;
alter table allergens                  enable row level security;
alter table ingredients                enable row level security;
alter table meals                      enable row level security;
alter table meal_variants              enable row level security;
alter table nutrition_profiles         enable row level security;
alter table meal_ingredients           enable row level security;
alter table meal_allergens             enable row level security;
alter table meal_images                enable row level security;
alter table meal_videos                enable row level security;
alter table carts                      enable row level security;
alter table cart_items                 enable row level security;
alter table coupons                    enable row level security;
alter table orders                     enable row level security;
alter table order_items                enable row level security;
alter table payments                   enable row level security;
alter table refunds                    enable row level security;
alter table subscriptions              enable row level security;
alter table delivery_tracking          enable row level security;
alter table reviews                    enable row level security;
alter table prepper_rating_summary     enable row level security;
alter table conversations              enable row level security;
alter table conversation_participants  enable row level security;
alter table messages                   enable row level security;
alter table notifications              enable row level security;

-- Identity
create policy p_profiles_read   on profiles for select using (id = auth.uid() or is_admin());
create policy p_profiles_update on profiles for update using (id = auth.uid());
create policy p_roles_read      on roles for select using (true);
create policy p_user_roles_read on user_roles for select using (user_id = auth.uid() or is_admin());
-- (role grants are admin/service only — no client insert/update policy)
create policy p_addresses_all   on addresses for all using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid());
create policy p_notif_pref_all  on notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prepper (public profiles; owner writes)
create policy p_prepper_read    on prepper_profiles for select using (true);
create policy p_prepper_insert  on prepper_profiles for insert with check (user_id = auth.uid());
create policy p_prepper_update  on prepper_profiles for update using (user_id = auth.uid() or is_admin());
create policy p_kitchens_owner  on kitchens for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());
create policy p_certs_owner     on certifications for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());
create policy p_avail_read      on availability_schedules for select using (true);
create policy p_avail_write     on availability_schedules for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());
create policy p_zones_read      on delivery_zones for select using (true);
create policy p_zones_write     on delivery_zones for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());
create policy p_pickup_read     on pickup_locations for select using (true);
create policy p_pickup_write    on pickup_locations for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());
create policy p_follows_read    on follows for select using (follower_id = auth.uid() or prepper_id = my_prepper_id() or is_admin());
create policy p_follows_write   on follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- Food (published meals public; prepper owns drafts/writes)
create policy p_cat_read     on meal_categories for select using (true);
create policy p_allergen_read on allergens for select using (true);
create policy p_ingr_read    on ingredients for select using (true);
create policy p_meals_read   on meals for select using (status = 'published' or prepper_id = my_prepper_id() or is_admin());
create policy p_meals_write  on meals for all using (prepper_id = my_prepper_id() or is_admin()) with check (prepper_id = my_prepper_id());

-- Meal children: visible if parent visible; writable if parent owned.
create policy p_variants_read on meal_variants for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_variants_write on meal_variants for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));
create policy p_nutri_read on nutrition_profiles for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_nutri_write on nutrition_profiles for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));
create policy p_mi_read on meal_ingredients for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_mi_write on meal_ingredients for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));
create policy p_ma_read on meal_allergens for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_ma_write on meal_allergens for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));
create policy p_img_read on meal_images for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_img_write on meal_images for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));
create policy p_vid_read on meal_videos for select using (
  exists (select 1 from meals m where m.id = meal_id and (m.status='published' or m.prepper_id = my_prepper_id() or is_admin())));
create policy p_vid_write on meal_videos for all using (
  exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()))
  with check (exists (select 1 from meals m where m.id = meal_id and m.prepper_id = my_prepper_id()));

-- Commerce
create policy p_carts_own  on carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_cart_items on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy p_coupons_read on coupons for select using (active or is_admin());
create policy p_orders_read   on orders for select using (customer_id = auth.uid() or prepper_id = my_prepper_id() or is_admin());
create policy p_orders_insert on orders for insert with check (customer_id = auth.uid());
create policy p_orders_update on orders for update using (prepper_id = my_prepper_id() or customer_id = auth.uid() or is_admin());
create policy p_order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.prepper_id = my_prepper_id() or is_admin())));
create policy p_order_items_insert on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
-- payments/refunds: READ for related parties; WRITE only via service_role (Stripe webhook).
create policy p_payments_read on payments for select using (
  exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.prepper_id = my_prepper_id() or is_admin())));
create policy p_refunds_read on refunds for select using (
  exists (select 1 from payments p join orders o on o.id = p.order_id
          where p.id = payment_id and (o.customer_id = auth.uid() or o.prepper_id = my_prepper_id() or is_admin())));
create policy p_subs_rw on subscriptions for all
  using (customer_id = auth.uid() or prepper_id = my_prepper_id() or is_admin())
  with check (customer_id = auth.uid());

-- Delivery
create policy p_tracking_read on delivery_tracking for select using (
  driver_id = auth.uid() or is_admin() or
  exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.prepper_id = my_prepper_id())));

-- Social
create policy p_reviews_read   on reviews for select using (true);
create policy p_reviews_insert on reviews for insert with check (
  author_id = auth.uid() and
  exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid() and o.status = 'completed'));
create policy p_reviews_update on reviews for update using (author_id = auth.uid() or is_admin());
create policy p_reviews_delete on reviews for delete using (author_id = auth.uid() or is_admin());
create policy p_rating_read    on prepper_rating_summary for select using (true);  -- write = service/trigger only
create policy p_conv_read on conversations for select using (
  exists (select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()));
create policy p_convpart_read on conversation_participants for select using (
  conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid()));
create policy p_messages_read on messages for select using (
  conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid()));
create policy p_messages_send on messages for insert with check (
  sender_id = auth.uid() and
  conversation_id in (select conversation_id from conversation_participants where user_id = auth.uid()));
create policy p_notifications_read   on notifications for select using (user_id = auth.uid());
create policy p_notifications_update on notifications for update using (user_id = auth.uid());

-- ============================================================================
-- New-user trigger (after tables/functions exist)
-- ============================================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
