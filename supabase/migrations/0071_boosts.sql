create table boosts (
  id                      uuid primary key default gen_random_uuid(),
  prepper_id              uuid not null references prepper_profiles(id) on delete cascade,
  meal_id                 uuid references meals(id) on delete set null,
  plan                    text not null,
  amount_cents            integer not null,
  starts_at               timestamptz not null default now(),
  expires_at              timestamptz not null,
  status                  text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  stripe_payment_intent_id text,
  created_at              timestamptz not null default now()
);

alter table boosts enable row level security;

create policy "Preppers manage their own boosts" on boosts for all
  using (prepper_id = (select id from prepper_profiles where user_id = auth.uid()))
  with check (prepper_id = (select id from prepper_profiles where user_id = auth.uid()));
