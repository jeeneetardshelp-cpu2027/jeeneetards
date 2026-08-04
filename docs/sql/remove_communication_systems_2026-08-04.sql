-- remove_communication_systems_2026-08-04.sql
--
-- Owner's decision: Communication Systems should not appear under JEE or NEET.
-- It was removed from the CBSE Class 12 Physics syllabus in the 2023-24
-- rationalisation and is not on either exam's current syllabus.
--
-- WHAT IS THERE, measured before writing this:
--   chapter 56 "Communication Systems", Physics, display_order 31
--   3 lessons, all published by Mohit Tyagi (channel 1), 174 minutes:
--     Z8_iwVGcpjA  Transducer, Channel, Noise, Transmitter, Amplification
--     tvMABjmxQ3k  Propagation of EM Waves: Ground Wave, Sky Wave, Space Wave
--     lkDKA5D8Nng  Examples of Communication Systems, Amplitude Modulation
--   1 course, 66 "Communication Systems", which holds exactly those 3 and
--   nothing else.
--
-- All three currently carry BOTH goals -- they were JEE-tagged already and
-- gained NEET an hour ago from competishun_neet_goal_2026-08-04.sql, which
-- deliberately did not rule on this chapter because no NEET syllabus document
-- had been read. This file is that ruling, made by the owner.
--
-- WHY DELETE RATHER THAN UNTAG. Removing the goals alone would leave three
-- lessons with no learning goal at all, and src/useScopedSearch.js inner-joins
-- video_learning_goals -- an unfiled lesson is invisible to every search while
-- still occupying a chapter. That is precisely the defect that left 670 lessons
-- unreachable and that backfill_video_taxonomy_junctions_2026-08-03.sql had to
-- repair. A chapter nobody should reach should not exist, not sit hidden.
--
-- The now-empty course 66 goes too, otherwise Browse would offer a course with
-- zero lessons.
--
-- Physics display_order is closed up afterwards so it stays a contiguous 1..32
-- (it is 1..33 today, and 56 sits at 31).
--
-- Guarded: refuses to run if the chapter holds any lesson other than the three
-- named above, so it cannot delete work added in the meantime. Every foreign key
-- onto videos is ON DELETE CASCADE -- checked, not assumed -- so the junction and
-- watch-progress rows go with them.
--
-- Idempotent and self-verifying.

begin;

do $comms$
declare
  v_chapter_id bigint := 56;
  v_course_id bigint := 66;
  v_extra int;
  v_videos int;
  v_pos int;
  r record;
begin
  if not exists (select 1 from public.chapters where id = v_chapter_id and subject_id = 1 and name = 'Communication Systems') then
    raise notice 'chapter 56 Communication Systems is already gone - nothing to do';
    return;
  end if;

  -- Refuse to delete anything this file was not written against.
  select count(*) into v_extra
    from public.videos
   where chapter_id = v_chapter_id
     and youtube_video_id not in ('Z8_iwVGcpjA', 'tvMABjmxQ3k', 'lkDKA5D8Nng');
  if v_extra <> 0 then
    raise exception '% lesson(s) in Communication Systems are not the three this file knows about - refusing to delete someone else''s work', v_extra;
  end if;

  -- Lessons first; the cascade takes their goals, class levels, course
  -- membership and any student watch progress with them.
  delete from public.videos where chapter_id = v_chapter_id;
  get diagnostics v_videos = row_count;

  -- The course exists only to hold them.
  delete from public.playlists
   where id = v_course_id
     and not exists (select 1 from public.playlist_videos where playlist_id = v_course_id);

  delete from public.chapters where id = v_chapter_id;

  -- Close the gap so Physics stays a contiguous run.
  v_pos := 0;
  for r in select id from public.chapters where subject_id = 1 order by display_order, id loop
    v_pos := v_pos + 1;
    update public.chapters set display_order = v_pos where id = r.id;
  end loop;

  raise notice 'removed % lesson(s), 1 course and 1 chapter; Physics renumbered to 1..%', v_videos, v_pos;
end
$comms$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n int;
  v_empty int;
  v_unfiled int;
  v_orphan int;
begin
  -- The chapter, its lessons and its course must all be gone.
  if exists (select 1 from public.chapters where name = 'Communication Systems') then
    raise exception 'the Communication Systems chapter survived';
  end if;
  if exists (select 1 from public.videos where youtube_video_id in ('Z8_iwVGcpjA', 'tvMABjmxQ3k', 'lkDKA5D8Nng')) then
    raise exception 'a Communication Systems lesson survived';
  end if;
  if exists (select 1 from public.playlists where id = 66) then
    raise exception 'the empty Communication Systems course survived';
  end if;

  -- Nothing anywhere may still be reachable by that name under either exam.
  select count(*) into v_n
    from public.videos v
    join public.video_learning_goals g on g.video_id = v.id
   where v.title ilike '%communication system%' and g.learning_goal_id in (1, 2);
  if v_n <> 0 then
    raise exception '% lesson(s) titled Communication Systems are still tagged JEE or NEET', v_n;
  end if;

  -- Physics display_order must be a clean contiguous run.
  select count(*) into v_n from public.chapters where subject_id = 1;
  select count(*) into v_orphan from public.chapters
   where subject_id = 1 and display_order between 1 and v_n;
  if v_orphan <> v_n then raise exception 'Physics display_order is not a clean 1..% run', v_n; end if;
  select count(*) into v_orphan from (
    select display_order from public.chapters where subject_id = 1
     group by display_order having count(*) > 1) d;
  if v_orphan <> 0 then raise exception 'Physics chapters share a display_order'; end if;

  -- The deletes must not have left wreckage.
  select count(*) into v_empty
    from public.playlists p
   where not exists (select 1 from public.playlist_videos pv where pv.playlist_id = p.id);
  if v_empty <> 0 then raise exception '% course(s) now have no lessons', v_empty; end if;

  select count(*) into v_unfiled
    from public.videos v
   where not exists (select 1 from public.video_learning_goals g where g.video_id = v.id);
  if v_unfiled <> 0 then raise exception '% lesson(s) now have no learning goal', v_unfiled; end if;

  select count(*) into v_empty
    from public.chapters c
   where not exists (select 1 from public.videos v where v.chapter_id = c.id);
  if v_empty <> 0 then raise exception '% chapter(s) now have no lessons', v_empty; end if;

  raise notice 'SELF-TEST PASSED: Communication Systems removed from both exams; Physics is a clean 1..% run; no empty course, chapter or unfiled lesson anywhere.', v_n;
end
$verify$;

commit;
