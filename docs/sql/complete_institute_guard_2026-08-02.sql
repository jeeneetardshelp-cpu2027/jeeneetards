-- complete_institute_guard_2026-08-02.sql
--
-- Completes the institute-consistency guard added on 31 July.
--
-- THE INVARIANT: a course page shows ONE institute (taken from the playlist
-- row) and the JSON-LD `provider` sent to Google does the same, so every lesson
-- in a course must be published by that course's channel. Violating it
-- misattributes real teachers' work — that is exactly what course 13 did, with
-- 43 of 67 lessons credited to the wrong publisher.
--
-- WHAT THE EXISTING GUARD MISSES (audit finding, 2 August 2026): it fires only
-- on `playlist_videos` INSERT / `UPDATE OF playlist_id, video_id`. But that is
-- one of THREE ways to break the invariant:
--   1. attach a lesson to the wrong course            <- already covered
--   2. change a COURSE's channel_id out from under
--      lessons that already match the old one         <- NOT covered
--   3. change a VIDEO's channel_id                    <- NOT covered
-- Its own comment claims an import "can never silently reintroduce" the
-- problem, which was not true. This closes 2 and 3.
--
-- Also drops the `OF playlist_id, video_id` column list from the existing
-- trigger: an `on conflict (playlist_id, video_id) do update set position = ...`
-- — the exact idiom every import file in docs/sql/ uses — updates neither named
-- column, so the re-check was skipped on that path.
--
-- All three triggers are DEFERRABLE INITIALLY DEFERRED, so a legitimate
-- transaction may re-home a course and its lessons in any order and is only
-- judged at COMMIT.
--
-- Verified before writing: 0 violating rows exist today (all 3,094
-- playlist_videos rows have v.channel_id = p.channel_id), so these triggers
-- cannot fail on existing data.
--
-- Idempotent; safe to re-run.

begin;

-- Shared checker, reused by all three triggers. SECURITY DEFINER + pinned
-- search_path, matching every other trigger function in this schema.
create or replace function public.assert_playlist_video_channel(p_playlist_id bigint, p_video_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video_channel bigint;
  v_course_channel bigint;
begin
  select channel_id into v_video_channel  from public.videos    where id = p_video_id;
  select channel_id into v_course_channel from public.playlists where id = p_playlist_id;

  if v_video_channel is distinct from v_course_channel then
    raise exception
      'lesson % is published by channel %, but course % credits channel % -- a course shows a single institute, so this would misattribute the lesson',
      p_video_id, v_video_channel, p_playlist_id, v_course_channel;
  end if;
end;
$$;

revoke all on function public.assert_playlist_video_channel(bigint, bigint) from public, anon, authenticated;
grant execute on function public.assert_playlist_video_channel(bigint, bigint) to service_role;

-- 1. A lesson is attached to a course (existing path, column list removed).
create or replace function public.playlist_video_channel_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_playlist_video_channel(new.playlist_id, new.video_id);
  return null;
end;
$$;

-- Restated rather than relied upon: `create or replace function` preserves the
-- privileges the 31 July migration granted, but this file must also be correct
-- if it is ever applied to a fresh database (a staging rebuild) where the
-- function did not previously exist.
revoke all on function public.playlist_video_channel_matches() from public, anon, authenticated;
grant execute on function public.playlist_video_channel_matches() to service_role;

drop trigger if exists playlist_video_channel_guard on public.playlist_videos;
create constraint trigger playlist_video_channel_guard
  after insert or update on public.playlist_videos
  deferrable initially deferred
  for each row execute function public.playlist_video_channel_matches();

-- 2. A COURSE's institute changes: re-check every lesson it already holds.
create or replace function public.playlist_channel_still_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bad bigint;
begin
  if new.channel_id is not distinct from old.channel_id then
    return null;
  end if;

  select pv.video_id into v_bad
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
   where pv.playlist_id = new.id
     and v.channel_id is distinct from new.channel_id
   limit 1;

  if v_bad is not null then
    perform public.assert_playlist_video_channel(new.id, v_bad);
  end if;
  return null;
end;
$$;

revoke all on function public.playlist_channel_still_matches() from public, anon, authenticated;
grant execute on function public.playlist_channel_still_matches() to service_role;

drop trigger if exists playlist_channel_guard on public.playlists;
create constraint trigger playlist_channel_guard
  after update of channel_id on public.playlists
  deferrable initially deferred
  for each row execute function public.playlist_channel_still_matches();

-- 3. A VIDEO's institute changes: re-check every course that holds it.
create or replace function public.video_channel_still_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bad bigint;
begin
  if new.channel_id is not distinct from old.channel_id then
    return null;
  end if;

  select pv.playlist_id into v_bad
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where pv.video_id = new.id
     and p.channel_id is distinct from new.channel_id
   limit 1;

  if v_bad is not null then
    perform public.assert_playlist_video_channel(v_bad, new.id);
  end if;
  return null;
end;
$$;

revoke all on function public.video_channel_still_matches() from public, anon, authenticated;
grant execute on function public.video_channel_still_matches() to service_role;

drop trigger if exists video_channel_guard on public.videos;
create constraint trigger video_channel_guard
  after update of channel_id on public.videos
  deferrable initially deferred
  for each row execute function public.video_channel_still_matches();

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_violations int;
  v_triggers int;
begin
  select count(*) into v_violations
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_violations <> 0 then
    raise exception '% lesson(s) already violate the institute invariant -- fix the data before arming the guards', v_violations;
  end if;

  select count(*) into v_triggers
    from pg_trigger
   where tgname in ('playlist_video_channel_guard', 'playlist_channel_guard', 'video_channel_guard')
     and not tgisinternal;
  if v_triggers <> 3 then
    raise exception 'expected 3 institute guards, found %', v_triggers;
  end if;

  raise notice 'SELF-TEST PASSED: 0 violations; all three institute guards armed (lesson attach, course re-home, video re-home).';
end
$verify$;

commit;
