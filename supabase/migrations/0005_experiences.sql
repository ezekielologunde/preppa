-- ============================================================================
-- Preppa — Experiences marketplace (additive, re-runnable)
--
-- The "Post a request → receive bids → compare → book" flow for catering,
-- private chefs, cooking classes and tastings. Customers post a request;
-- approved preppers bid; the customer accepts one bid (which books it).
--
-- Mirrors the security model in 0001: RLS isolates each party, and the
-- accept-bid transition runs through an admin/owner-guarded RPC.
-- ============================================================================

set check_function_bodies = off;

do $$ begin
  create type experience_kind   as enum ('catering','private_chef','class','tasting','other');
  create type experience_status as enum ('open','booked','completed','cancelled');
  create type bid_status        as enum ('pending','accepted','declined','withdrawn');
exception when duplicate_object then null; end $$;

-- A customer's request for a food experience.
create table if not exists experience_requests (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  kind        experience_kind not null default 'other',
  title       text not null,
  details     text,
  guests      int  check (guests is null or guests > 0),
  budget      numeric check (budget is null or budget >= 0),
  event_date  date,
  location    text,
  status      experience_status not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A prepper's bid on a request.
create table if not exists experience_bids (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references experience_requests(id) on delete cascade,
  prepper_id uuid not null references prepper_profiles(id) on delete cascade,
  amount     numeric not null check (amount >= 0),
  message    text,
  status     bid_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (request_id, prepper_id)               -- one active bid per prepper per request
);

create index if not exists idx_exp_req_customer on experience_requests(customer_id, created_at desc);
create index if not exists idx_exp_req_status   on experience_requests(status, created_at desc);
create index if not exists idx_exp_bid_request  on experience_bids(request_id);
create index if not exists idx_exp_bid_prepper  on experience_bids(prepper_id);

drop trigger if exists t_exp_req_updated on experience_requests;
create trigger t_exp_req_updated before update on experience_requests
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table experience_requests enable row level security;
alter table experience_bids     enable row level security;

drop policy if exists p_exp_req_read   on experience_requests;
drop policy if exists p_exp_req_write  on experience_requests;
drop policy if exists p_exp_bid_read   on experience_bids;
drop policy if exists p_exp_bid_write  on experience_bids;

-- Requests: owner manages theirs; approved preppers can see OPEN requests to bid;
-- admins see all.
create policy p_exp_req_read on experience_requests for select using (
  customer_id = auth.uid()
  or is_admin()
  or (status = 'open' and exists (
        select 1 from prepper_profiles pp where pp.user_id = auth.uid() and pp.status = 'approved'))
);
create policy p_exp_req_write on experience_requests for all
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid());

-- Bids: the bidding prepper and the request's customer (and admins) can read;
-- only the owning prepper may insert/update their own bid.
create policy p_exp_bid_read on experience_bids for select using (
  prepper_id = my_prepper_id()
  or is_admin()
  or exists (select 1 from experience_requests r where r.id = request_id and r.customer_id = auth.uid())
);
create policy p_exp_bid_write on experience_bids for all
  using (prepper_id = my_prepper_id())
  with check (prepper_id = my_prepper_id()
    and exists (select 1 from prepper_profiles pp where pp.id = prepper_id and pp.status = 'approved'));

-- ----------------------------------------------------------------------------
-- Accept a bid: books the request + the winning bid, declines the rest.
-- Customer (request owner) or admin only. SECURITY DEFINER to update sibling bids.
-- ----------------------------------------------------------------------------
create or replace function accept_experience_bid(p_bid uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_request uuid; v_customer uuid; v_status experience_status;
begin
  select b.request_id, r.customer_id, r.status
    into v_request, v_customer, v_status
    from experience_bids b join experience_requests r on r.id = b.request_id
    where b.id = p_bid;
  if v_request is null then raise exception 'Bid not found'; end if;
  if not (is_admin() or v_customer = auth.uid()) then raise exception 'Not authorized'; end if;
  if v_status <> 'open' then raise exception 'Request is no longer open'; end if;

  update experience_bids set status = 'accepted' where id = p_bid;
  update experience_bids set status = 'declined' where request_id = v_request and id <> p_bid and status = 'pending';
  update experience_requests set status = 'booked' where id = v_request;
end $$;

grant execute on function accept_experience_bid(uuid) to authenticated;
