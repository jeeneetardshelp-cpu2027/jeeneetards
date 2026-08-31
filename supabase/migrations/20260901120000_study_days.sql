-- ============================================================================
-- STUDY DAYS -- server copy of the prep-streak's study days, for signed-in
-- students only.
--
-- WHAT THIS IS. streak.js keeps the set of calendar days a student actually
-- played a lesson (ll_streak_v1, localStorage) and deliberately WIPES it on
-- sign-out, because that store is un-namespaced and a shared school-lab
-- machine must not hand one student another's streak. The honest cost was
-- that a student's own streak died with every sign-out. This table is the
-- fix: the client best-effort upserts one (user_id, day) row per study day
-- while signed in (streakSync.js), and on the next sign-in pulls the set
-- back down and unions it into localStorage. One row is one date -- no
-- lesson ids, no titles, no durations, no times of day.
--
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it via `supabase db push` once the baseline
-- exists -- never by pasting into the SQL Editor. The frontend already
-- degrades cleanly while this table does not exist: streakSync.js catches
-- PostgREST's missing-relation error and goes quiet, so the site behaves
-- exactly as it did before the sync shipped.
--
-- ROLLBACK. `drop table if exists public.study_days;` -- nothing else in the
-- schema references it, and the client silently returns to local-only
-- streaks (the same missing-relation path as before this was applied).
--
-- SECURITY SHAPE: mirrors video_progress (src/migrations/video_progress_sync.sql).
-- Deliberately PRIVATE -- when a student studies is nobody else's business.
-- Default-deny RLS, owner-only select/insert, no anon access at all, and
-- explicit table grants so the policy story and the privilege story agree.
-- Safe to re-run: create if not exists + drop policy if exists.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.study_days (
    user_id uuid not null references auth.users (id) on delete cascade,
    -- The student's LOCAL calendar day, exactly as streak.js counts it
    -- (dayKey): the client owns the timezone question, this table just
    -- stores the answer.
    day     date not null,
    primary key (user_id, day)
);

alter table public.study_days enable row level security;

drop policy if exists "user reads own study days"   on public.study_days;
drop policy if exists "user inserts own study days" on public.study_days;

-- Owner-only, and only what the client actually does: read the set back on
-- sign-in, and insert new days. No update policy (a row IS its primary key --
-- there is nothing to update) and no delete policy (deletion is an account
-- request handled by the owner, not a client code path).
create policy "user reads own study days"   on public.study_days
  for select to authenticated using (auth.uid() = user_id);
create policy "user inserts own study days" on public.study_days
  for insert to authenticated with check (auth.uid() = user_id);

-- Explicit grants: the browser roles hold exactly the privileges the
-- policies above scope, and anon holds none at all.
revoke all on table public.study_days from public, anon, authenticated;
grant select, insert on table public.study_days to authenticated;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION (same discipline as video_progress_sync.sql)
-- ---------------------------------------------------------------------
do $$
declare
  policy_count int;
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'study_days'
  ) then
    raise exception 'study_days table was not created';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'study_days' and c.relrowsecurity
  ) then
    raise exception 'study_days does not have row level security enabled';
  end if;

  select count(*) into policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'study_days';
  if policy_count <> 2 then
    raise exception 'expected 2 RLS policies on study_days, found %', policy_count;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.study_days'::regclass
       and contype = 'p'
  ) then
    raise exception 'study_days is missing its primary key (user_id, day)';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'study_days'
       and grantee = 'anon'
  ) then
    raise exception 'anon must hold no privileges on study_days';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'study_days'
       and grantee = 'authenticated'
       and privilege_type not in ('SELECT', 'INSERT')
  ) then
    raise exception 'authenticated must hold only SELECT and INSERT on study_days';
  end if;

  raise notice 'SELF-TEST PASSED: study_days exists, RLS enabled, 2 owner-only policies, PK present, grants are select+insert for authenticated only.';
end
$$;

commit;
