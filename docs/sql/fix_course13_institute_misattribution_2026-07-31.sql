-- fix_course13_institute_misattribution_2026-07-31.sql
--
-- Course 13 "Kinematics| Irodov solutions" credits Mohit Tyagi as the
-- institute, but 43 of its 67 lessons are videos published by Competishun+.
-- The course page renders ONE institute (from the playlist row) and the JSON-LD
-- `provider` sent to Google does the same, so 43 lessons are publicly
-- attributed to the wrong publisher. The institute filter is wrong in both
-- directions too: filtering browse by Competishun+ omits this course entirely,
-- while filtering by Mohit Tyagi returns a course whose majority of lessons
-- are not his. Audit finding A11, 31 July 2026.
--
-- Verified against live production before writing this:
--   * course 13 is the ONLY course in the catalogue with this defect (all 291
--     others have every lesson on their own course's channel);
--   * the split is clean, not interleaved -- positions 1-24 are Mohit Tyagi,
--     positions 25-67 are Competishun+;
--   * course 298 "Irodov Solutions" already exists on the Competishun+ channel
--     with 26 lessons, and there is ZERO video overlap with course 13, so the
--     (playlist_id, video_id) unique constraint cannot fire;
--   * the numbering joins perfectly: 298 currently covers Irodov problems
--     1.2-1.27, and the mis-filed block is Q.1.28-Q.1.70. Moving them makes 298
--     a complete Competishun+ Irodov Mechanics course (1.2-1.70, 69 lessons)
--     rather than merely relocating an orphan block.
--
-- NOT changed: course 13's teacher stays "ABJ Sir". ABJ Sir teaches on the
-- Mohit Tyagi channel, so teacher and channel are consistent for the 24 lessons
-- that remain -- an earlier reading of this as a second defect was wrong.
--
-- Idempotent: the move only matches lessons still mis-filed, so a re-run is a
-- no-op. Self-verifying.

begin;

-- ---------------------------------------------------------------------
-- 1. RE-HOME the 43 Competishun+ lessons onto the Competishun+ course,
--    appending them after that course's existing lessons and preserving
--    their current relative order (Q.1.28 -> Q.1.70).
-- ---------------------------------------------------------------------
do $move$
declare
  v_moved int;
  v_base int;
begin
  select coalesce(max(position), 0) into v_base
    from public.playlist_videos where playlist_id = 298;

  with moving as (
    select pv.id,
           row_number() over (order by pv.position) as seq
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
     where pv.playlist_id = 13
       and v.channel_id = 81          -- Competishun+
  )
  update public.playlist_videos pv
     set playlist_id = 298,
         position    = v_base + moving.seq
    from moving
   where pv.id = moving.id;

  get diagnostics v_moved = row_count;
  raise notice 'moved % lesson(s) from course 13 to course 298', v_moved;
end
$move$;

-- ---------------------------------------------------------------------
-- 2. CLOSE THE GAP left in course 13 so its lessons stay 1..n contiguous
--    (the UI numbers lessons straight from this column).
-- ---------------------------------------------------------------------
with renumbered as (
  select id, row_number() over (order by position, id) as seq
    from public.playlist_videos
   where playlist_id = 13
)
update public.playlist_videos pv
   set position = renumbered.seq
  from renumbered
 where pv.id = renumbered.id
   and pv.position is distinct from renumbered.seq;

-- ---------------------------------------------------------------------
-- 3. PERMANENT GUARD so an import can never reintroduce this silently.
--    A course displays exactly one institute, so a lesson published by a
--    different channel can only ever be a misattribution.
--    DEFERRABLE so a transaction may legitimately create the playlist and
--    attach lessons in any order before the check runs at commit.
-- ---------------------------------------------------------------------
create or replace function public.playlist_video_channel_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video_channel bigint;
  v_course_channel bigint;
begin
  select channel_id into v_video_channel from public.videos where id = new.video_id;
  select channel_id into v_course_channel from public.playlists where id = new.playlist_id;

  if v_video_channel is distinct from v_course_channel then
    raise exception
      'lesson % is published by channel %, but course % credits channel % -- a course shows a single institute, so this would misattribute the lesson',
      new.video_id, v_video_channel, new.playlist_id, v_course_channel;
  end if;
  return null;
end;
$$;

revoke all on function public.playlist_video_channel_matches() from public, anon, authenticated;
grant execute on function public.playlist_video_channel_matches() to service_role;

drop trigger if exists playlist_video_channel_guard on public.playlist_videos;
create constraint trigger playlist_video_channel_guard
  after insert or update of playlist_id, video_id on public.playlist_videos
  deferrable initially deferred
  for each row execute function public.playlist_video_channel_matches();

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_offenders int;
  v_c13 int;
  v_c298 int;
  v_c13_gaps int;
  v_c298_gaps int;
begin
  select count(*) into v_offenders
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_offenders <> 0 then
    raise exception '% lesson(s) are still published by a channel other than their course''s', v_offenders;
  end if;

  select count(*) into v_c13  from public.playlist_videos where playlist_id = 13;
  select count(*) into v_c298 from public.playlist_videos where playlist_id = 298;
  if v_c13 <> 24 then
    raise exception 'expected course 13 to keep exactly 24 lessons, found %', v_c13;
  end if;
  if v_c298 <> 69 then
    raise exception 'expected course 298 to hold 69 lessons after the move, found %', v_c298;
  end if;

  -- Positions must remain a clean 1..n in both courses.
  select count(*) into v_c13_gaps from (
    select position, row_number() over (order by position) as seq
      from public.playlist_videos where playlist_id = 13
  ) t where t.position is distinct from t.seq;
  select count(*) into v_c298_gaps from (
    select position, row_number() over (order by position) as seq
      from public.playlist_videos where playlist_id = 298
  ) t where t.position is distinct from t.seq;
  if v_c13_gaps <> 0 or v_c298_gaps <> 0 then
    raise exception 'position sequence broken: % gap(s) in course 13, % in course 298', v_c13_gaps, v_c298_gaps;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'playlist_video_channel_guard') then
    raise exception 'playlist_video_channel_guard trigger was not created';
  end if;

  raise notice 'SELF-TEST PASSED: 0 misattributed lessons catalogue-wide; course 13 = 24 lessons (Mohit Tyagi), course 298 = 69 lessons (Competishun+); positions contiguous; guard trigger active.';
end
$verify$;

commit;
