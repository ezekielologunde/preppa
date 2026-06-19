create table holiday_events (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  emoji        text not null default '🍽️',
  date_str     text not null,   -- ISO date string or 'dynamic' for floating dates
  description  text not null,
  color_hex    text not null default '#E8611A',
  dishes       text[] not null default '{}',
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table holiday_events enable row level security;

-- Everyone can read active holiday events
create policy "Anyone can read active holiday events"
  on holiday_events for select
  using (active = true);

-- Seed with current hardcoded events
insert into holiday_events (key, name, emoji, date_str, description, color_hex, dishes, sort_order) values
  ('eid_al_adha', 'Eid al-Adha', '🐑', '2026-06-06', 'Celebrate the feast of sacrifice with traditional dishes', '#10B981', ARRAY['Suya', 'Jollof Rice', 'Puff Puff', 'Kilishi'], 1),
  ('juneteenth', 'Juneteenth', '✊🏿', '2026-06-19', 'Honor freedom with soul food traditions', '#EF4444', ARRAY['Red Velvet Cake', 'BBQ Ribs', 'Collard Greens', 'Cornbread'], 2),
  ('fathers_day', 'Father''s Day', '👨‍👧‍👦', 'dynamic', 'Treat dad to his favorite meal', '#3B82F6', ARRAY['Pepper Soup', 'Grilled Fish', 'Egusi Soup', 'Ofada Rice'], 3),
  ('sallah_day', 'Sallah Day', '🌙', '2026-06-07', 'Enjoy festive Sallah delicacies', '#8B5CF6', ARRAY['Masa', 'Tuwo Shinkafa', 'Miyan Kuka', 'Dambu Nama'], 4),
  ('canada_day', 'Canada Day', '🍁', '2026-07-01', 'Celebrate with Canadian-inspired dishes', '#EF4444', ARRAY['Poutine', 'Butter Tarts', 'Nanaimo Bars', 'BeaverTails'], 5),
  ('nigeria_independence', 'Nigerian Independence', '🇳🇬', '2026-10-01', 'Mark 66 years of independence with Nigerian classics', '#008751', ARRAY['Jollof Rice', 'Egusi Soup', 'Banga Soup', 'Moi Moi'], 6);
