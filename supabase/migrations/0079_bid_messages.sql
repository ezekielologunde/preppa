create table if not exists public.bid_messages (
  id         uuid        primary key default gen_random_uuid(),
  bid_id     uuid        not null references public.meal_request_bids(id) on delete cascade,
  sender_id  uuid        not null references auth.users(id),
  body       text        not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists bid_messages_bid_idx on public.bid_messages(bid_id, created_at);

alter table public.bid_messages enable row level security;

-- Participants: the customer who posted the request OR the prepper who placed the bid
create policy "bid_messages_select" on public.bid_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.meal_request_bids b
      join public.meal_requests r on r.id = b.request_id
      where b.id = bid_id
        and (
          r.customer_id = auth.uid()
          or b.prepper_id in (
            select id from public.prepper_profiles where user_id = auth.uid()
          )
        )
    )
  );

create policy "bid_messages_insert" on public.bid_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.meal_request_bids b
      join public.meal_requests r on r.id = b.request_id
      where b.id = bid_id
        and (
          r.customer_id = auth.uid()
          or b.prepper_id in (
            select id from public.prepper_profiles where user_id = auth.uid()
          )
        )
    )
  );
