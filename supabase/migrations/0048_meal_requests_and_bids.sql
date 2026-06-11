create table if not exists public.meal_requests (
  id                  uuid          primary key default gen_random_uuid(),
  customer_id         uuid          not null references public.profiles(id) on delete cascade,
  title               text          not null,
  description         text,
  servings            integer       not null default 1 check (servings > 0),
  budget_per_serving  numeric(10,2) check (budget_per_serving > 0),
  cuisine             text,
  deadline            date,
  status              text          not null default 'open'
                        check (status in ('open', 'fulfilled', 'cancelled')),
  created_at          timestamptz   not null default now()
);

create table if not exists public.meal_request_bids (
  id                  uuid          primary key default gen_random_uuid(),
  request_id          uuid          not null references public.meal_requests(id) on delete cascade,
  prepper_id          uuid          not null references public.prepper_profiles(id) on delete cascade,
  price_per_serving   numeric(10,2) not null check (price_per_serving > 0),
  note                text,
  status              text          not null default 'pending'
                        check (status in ('pending', 'accepted', 'rejected')),
  created_at          timestamptz   not null default now(),
  unique (request_id, prepper_id)
);

create index if not exists meal_requests_customer_idx on public.meal_requests(customer_id);
create index if not exists meal_requests_status_created_idx on public.meal_requests(status, created_at desc);
create index if not exists meal_request_bids_request_idx on public.meal_request_bids(request_id);
create index if not exists meal_request_bids_prepper_idx on public.meal_request_bids(prepper_id);

alter table public.meal_requests enable row level security;
alter table public.meal_request_bids enable row level security;

create policy "open requests visible to all" on public.meal_requests
  for select using (status = 'open' or auth.uid() = customer_id);

create policy "customers can post requests" on public.meal_requests
  for insert with check (auth.uid() = customer_id);

create policy "customer can update their own request" on public.meal_requests
  for update using (auth.uid() = customer_id);

create policy "request owner and bidder can read bids" on public.meal_request_bids
  for select using (
    auth.uid() = (select customer_id from public.meal_requests where id = request_id)
    or auth.uid() = (select user_id from public.prepper_profiles where id = prepper_id)
  );

create policy "approved preppers can place bids" on public.meal_request_bids
  for insert with check (
    exists (
      select 1 from public.prepper_profiles
      where id = prepper_id and user_id = auth.uid() and status = 'approved'
    )
  );

create policy "prepper can update their own bid" on public.meal_request_bids
  for update using (
    auth.uid() = (select user_id from public.prepper_profiles where id = prepper_id)
  );
