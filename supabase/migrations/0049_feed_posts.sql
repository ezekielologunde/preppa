create table if not exists public.feed_posts (
  id            uuid        primary key default gen_random_uuid(),
  prepper_id    uuid        not null references public.prepper_profiles(id) on delete cascade,
  caption       text,
  thumbnail_url text,
  video_url     text,
  tags          text[]      not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists feed_posts_prepper_idx on public.feed_posts(prepper_id);
create index if not exists feed_posts_created_idx on public.feed_posts(created_at desc);

alter table public.feed_posts enable row level security;

create policy "feed posts are public" on public.feed_posts
  for select using (true);

create policy "approved preppers can post" on public.feed_posts
  for insert with check (
    exists (
      select 1 from public.prepper_profiles
      where id = prepper_id and user_id = auth.uid() and status = 'approved'
    )
  );

create policy "prepper manages their posts" on public.feed_posts
  for all using (
    auth.uid() = (select user_id from public.prepper_profiles where id = prepper_id)
  );
