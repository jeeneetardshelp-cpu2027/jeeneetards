-- video_progress_sync.sql — server-side mirror of progress.js's localStorage
-- watch progress, for signed-in students only. Additive; safe to re-run.
--
-- WHY: progress.js has tracked resume points and "watched" ticks in
-- localStorage since day one -- per-device only. Now that accounts exist
-- (studentAccounts / courseRatingSubmission), a student who opens the site
-- on a second device sees no history there. This table lets the client push
-- position updates in the background and pull them back down on sign-in;
-- localStorage stays the primary, synchronous read path (see progress.js's
-- own header comment, written well before this table existed: "If we later
-- add accounts, this becomes the offline mirror of a server-side progress
-- table").
--
-- Deliberately PRIVATE, unlike playlist_ratings: a student's watch history
-- is not something other students or anon visitors have any reason to read.
-- Every policy is "owner only" -- no "public read" policy at all.

create table if not exists public.video_progress (
    id                bigint generated always as identity primary key,
    user_id           uuid   not null references public.profiles(id) on delete cascade,
    playlist_id       bigint not null references public.playlists(id) on delete cascade,
    video_id          bigint not null references public.videos(id)   on delete cascade,
    chapter_id        bigint references public.chapters(id) on delete set null,
    position_seconds  numeric not null default 0 check (position_seconds >= 0),
    duration_seconds  numeric check (duration_seconds is null or duration_seconds >= 0),
    watched           boolean not null default false,
    updated_at        timestamptz not null default now(),
    unique (user_id, playlist_id, video_id)
);

alter table public.video_progress enable row level security;

drop policy if exists "user reads own progress"   on public.video_progress;
drop policy if exists "user inserts own progress" on public.video_progress;
drop policy if exists "user updates own progress" on public.video_progress;
drop policy if exists "user deletes own progress" on public.video_progress;

create policy "user reads own progress"   on public.video_progress for select using (auth.uid() = user_id);
create policy "user inserts own progress" on public.video_progress for insert with check (auth.uid() = user_id);
create policy "user updates own progress" on public.video_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user deletes own progress" on public.video_progress for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  policy_count int;
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'video_progress'
  ) then
    raise exception 'video_progress table was not created';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'video_progress' and c.relrowsecurity
  ) then
    raise exception 'video_progress does not have row level security enabled';
  end if;

  select count(*) into policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'video_progress';
  if policy_count <> 4 then
    raise exception 'expected 4 RLS policies on video_progress, found %', policy_count;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.video_progress'::regclass
       and contype = 'u'
  ) then
    raise exception 'video_progress is missing its unique(user_id, playlist_id, video_id) constraint';
  end if;

  raise notice 'SELF-TEST PASSED: video_progress exists, RLS enabled, 4 owner-only policies, unique constraint present.';
end
$$;
