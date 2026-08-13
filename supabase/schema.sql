-- AfterPayday cloud sync — run once in the Supabase SQL editor for a new
-- project. One row per user, holding the whole app-state document (the same
-- object Settings → Backup → Export writes). Row Level Security means each
-- user can only ever read/write their own row — enforced by the database,
-- not by any server code this app ships.

create table public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  doc        jsonb       not null,
  rev        bigint      not null default 1,
  updated_at timestamptz not null default now(),
  device_id  text
);

alter table public.app_state enable row level security;

create policy "own row only" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
