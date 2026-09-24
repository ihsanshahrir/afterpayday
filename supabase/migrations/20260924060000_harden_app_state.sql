-- Hardening pass from the 2026-09 perf/DB/uptime audit.

-- 1. RLS: scope the policy to signed-in users and wrap auth.uid() in a
--    sub-select so Postgres evaluates it once per statement instead of once
--    per row (Supabase advisor lint 0003_auth_rls_initplan). Same semantics.
drop policy if exists "own row only" on public.app_state;
create policy "own row only" on public.app_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2. Least privilege. Supabase grants anon/authenticated every table
--    privilege by default and relies on RLS alone. anon keeps SELECT only so
--    the keepalive workflow (.github/workflows/supabase-keepalive.yml) can
--    reach Postgres — with no anon policy it always sees zero rows.
--    TRUNCATE ignores RLS entirely, so nobody client-side should hold it.
revoke all on public.app_state from anon;
grant select on public.app_state to anon;
revoke truncate, references, trigger on public.app_state from authenticated;

-- 3. Server-authoritative rev + updated_at. The client still sends both (so
--    older builds keep working), but the database now decides: updated_at
--    no longer depends on a device clock, and rev can only ever step by one,
--    which is what the client's compare-and-swap push relies on.
create or replace function public.app_state_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.rev := 1;
  else
    new.rev := old.rev + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.app_state_stamp() from public, anon, authenticated;

drop trigger if exists app_state_stamp on public.app_state;
create trigger app_state_stamp
  before insert or update on public.app_state
  for each row execute function public.app_state_stamp();

-- 4. Guard rails on the document: must be a JSON object, and capped at 2 MB
--    of text (years of daily entries are ~hundreds of KB). The client maps
--    a violation (SQLSTATE 23514) to a clear "too large to sync" error.
alter table public.app_state drop constraint if exists app_state_doc_shape;
alter table public.app_state
  add constraint app_state_doc_shape
  check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 2000000);

-- 5. rls_auto_enable() is Supabase's event-trigger helper that turns on RLS
--    for new public tables. It was callable over /rest/v1/rpc by anon and
--    authenticated (advisor lints 0028/0029). Event triggers don't check
--    EXECUTE when they fire, so revoking it changes nothing functionally.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
