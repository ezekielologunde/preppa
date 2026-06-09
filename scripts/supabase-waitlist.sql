-- Preppa waitlist — run ONCE in Supabase → SQL Editor:
-- https://supabase.com/dashboard/project/nfwfnnfbikjxwflpmsnu/sql/new

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- Lock the table down, then allow only inserts from the public/anon key.
alter table public.waitlist enable row level security;

-- Anyone with the publishable key can ADD their email...
create policy "anon can join waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- ...but nobody can READ the list with the public key (no select policy = no reads).
-- View signups in the Supabase dashboard, or via the service_role key on a server.
