create table saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  meal_id     uuid not null references meals(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, meal_id)
);

alter table saved_meals enable row level security;

create policy "Users manage their own saved meals"
  on saved_meals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_saved_meals_user on saved_meals(user_id);
