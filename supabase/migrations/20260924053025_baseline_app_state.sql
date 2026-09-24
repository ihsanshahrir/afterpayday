-- Baseline: the schema as originally set up by hand from supabase/schema.sql.
-- Idempotent so it can be recorded against the existing production project
-- and also run cleanly on a fresh one.
--
-- One row per user, holding the whole app-state document (the same object
-- Settings → Backup → Export writes). Row Level Security means each user can
-- only ever read/write their own row — enforced by the database, not by any
-- server code this app ships.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  doc        jsonb       not null,
  rev        bigint      not null default 1,
  updated_at timestamptz not null default now(),
  device_id  text
);

alter table public.app_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_state' and policyname = 'own row only'
  ) then
    create policy "own row only" on public.app_state
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
