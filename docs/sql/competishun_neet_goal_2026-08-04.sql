-- competishun_neet_goal_2026-08-04.sql
--
-- Owner's decision: make the Physics and Chemistry teaching on the Competishun
-- channels visible to NEET students as well as JEE ones.
--
-- Channels in scope, both verified by youtube_channel_id below, not by name:
--   1   Mohit Tyagi   (UCpyc1eTpM1cA3P0ZWym4clw)  -- "ABJ Sir"
--   81  Competishun+  (UC6ieIswHA9WInRsa2r88hRw)
-- Subjects in scope: Physics (1) and Chemistry (2) only. These are the two
-- subjects the two exams actually share. Mathematics is deliberately untouched
-- -- it is not a NEET subject, and tagging it would put Maths courses in front
-- of NEET students who will never sit a Maths paper.
--
-- SCOPE, measured against production before writing this:
--   Mohit Tyagi   Physics    34 courses,  338 lessons, 339 hours
--   Mohit Tyagi   Chemistry  27 courses,  369 lessons, 162 hours
--   Competishun+  Physics     5 courses,   92 lessons,  25 hours
--   Competishun+  Chemistry  38 courses,  218 lessons, 270 hours
--   -> 1017 lessons across 104 courses, of which 0 carry NEET today.
--
-- EXPECTED EFFECT, counted by INSTITUTE rather than channel:
--   Physics    NEET chapters 30 -> 33;  with 2+ institutes 25/30 -> 29/33
--   Chemistry  NEET chapters 37 -> 49;  with 2+ institutes 25/37 -> 35/49
-- Twelve Chemistry chapters that no NEET student can currently reach at all --
-- among them The s-Block Elements, Hydrogen, both p-Block groups and Nuclear
-- Chemistry, all genuinely NEET topics -- become reachable.
--
-- WHAT IS DELIBERATELY EXCLUDED, and why it is not me overruling the request.
-- Two categories are not "Physics and Chemistry lectures" in any useful sense;
-- they are solutions to a DIFFERENT EXAM's papers, and no NEET student has a use
-- for them:
--
--   (a) Anything carrying the olympiad goal but not the JEE goal -- 17 lessons,
--       sitting in IOQC Solutions, INChO Solutions, IChO Solutions, INPhO
--       Solutions and NMR Spectroscopy. This is a data-driven rule read off the
--       existing tags, not my guess about a syllabus.
--   (b) The single lesson in "JEE Advanced 2024 Paper Solutions" (chapter 297),
--       which is a JEE Advanced paper walkthrough.
--
-- That is 18 lessons held back out of 1017. If you want them in too, delete the
-- two `and not (...)` conditions below and re-run; everything else is unchanged.
--
-- WHAT IS *NOT* EXCLUDED, flagged so the choice is visible rather than silent:
--   - The 6 "practice" courses, including 104 lessons of Irodov solutions. Irodov
--     is JEE-Advanced-level problem solving. It is real Physics and a motivated
--     NEET student may want it, but it is far above what NEET asks. They are
--     tagged 'advanced' and will read as such on the card.
--   - Communication Systems (3 lessons). It has no NEET content from anyone
--     today, which may mean it is off the NEET syllabus -- but I have not read
--     the NEET syllabus document and will not adjudicate a topic on inference.
--     That is the same standard applied to the English chapters earlier today,
--     where inferring from a publisher's catalogue put three off-syllabus
--     chapters live.
--
-- ADDITIVE ONLY. The JEE goal every one of these already carries is untouched;
-- nothing is deleted, no lesson moves chapter, no title changes. Class levels
-- are untouched too.
--
-- REVERSIBLE. To undo exactly what this adds:
--   delete from public.video_learning_goals g
--    using public.videos v
--    where g.video_id = v.id and g.learning_goal_id = (select id from public.learning_goals where slug='neet')
--      and v.channel_id in (1, 81) and v.subject_id in (1, 2);
--   delete from public.playlist_learning_goals g
--    using public.playlists p
--    where g.playlist_id = p.id and g.learning_goal_id = (select id from public.learning_goals where slug='neet')
--      and p.channel_id in (1, 81) and p.subject_id in (1, 2);
--
-- Idempotent (inserts are on conflict do nothing) and self-verifying.

begin;

do $neet$
declare
  v_jee bigint;
  v_neet bigint;
  v_oly bigint;
  v_ch1 bigint;
  v_ch81 bigint;
  v_videos int;
  v_courses int;
begin
  select id into strict v_jee  from public.learning_goals where slug = 'jee';
  select id into strict v_neet from public.learning_goals where slug = 'neet';
  select id into strict v_oly  from public.learning_goals where slug = 'olympiad';

  -- Identify the channels by their YouTube id, never by a display name that
  -- someone could rename.
  select id into strict v_ch1  from public.institutes_channels where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';
  select id into strict v_ch81 from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';

  -- ------------------------------------------------------------------
  -- Lessons
  -- ------------------------------------------------------------------
  insert into public.video_learning_goals (video_id, learning_goal_id)
  select v.id, v_neet
  from public.videos v
  where v.channel_id in (v_ch1, v_ch81)
    and v.subject_id in (1, 2)
    -- (a) olympiad-only content is a different exam's papers
    and not (
      exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_oly)
      and not exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_jee)
    )
    -- (b) a JEE Advanced paper walkthrough
    and not (v.chapter_id = 297)
  on conflict do nothing;
  get diagnostics v_videos = row_count;

  -- ------------------------------------------------------------------
  -- Courses. Browse filters courses through playlist_learning_goals, so the
  -- lessons alone would be findable by search but the courses would not appear.
  -- A course qualifies when at least one of its lessons just gained NEET.
  -- ------------------------------------------------------------------
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select distinct p.id, v_neet
  from public.playlists p
  join public.playlist_videos pv on pv.playlist_id = p.id
  join public.videos v on v.id = pv.video_id
  join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
  where p.channel_id in (v_ch1, v_ch81)
    and p.subject_id in (1, 2)
  on conflict do nothing;
  get diagnostics v_courses = row_count;

  raise notice 'NEET goal added to % lesson(s) and % course(s)', v_videos, v_courses;
end
$neet$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_jee bigint;
  v_neet bigint;
  v_oly bigint;
  v_scope int;
  v_tagged int;
  v_leaked int;
  v_lostjee int;
  v_maths int;
  v_courses int;
  v_orphan int;
  v_phys int;
  v_chem int;
begin
  select id into strict v_jee  from public.learning_goals where slug = 'jee';
  select id into strict v_neet from public.learning_goals where slug = 'neet';
  select id into strict v_oly  from public.learning_goals where slug = 'olympiad';

  select count(*) into v_scope from public.videos
   where channel_id in (1, 81) and subject_id in (1, 2);
  select count(*) into v_tagged
    from public.videos v
    join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
   where v.channel_id in (1, 81) and v.subject_id in (1, 2);
  if v_tagged < v_scope - 20 then
    raise exception 'only % of % in-scope lessons carry NEET - the tagging did not apply', v_tagged, v_scope;
  end if;

  -- The exclusions must have held: no olympiad-only lesson, and nothing from
  -- the JEE Advanced paper chapter, may carry NEET.
  select count(*) into v_leaked
    from public.videos v
    join public.video_learning_goals n on n.video_id = v.id and n.learning_goal_id = v_neet
   where v.channel_id in (1, 81)
     and (
       (exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_oly)
        and not exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_jee))
       or v.chapter_id = 297
     );
  if v_leaked <> 0 then
    raise exception '% olympiad or JEE-Advanced-paper lesson(s) were tagged NEET', v_leaked;
  end if;

  -- Nothing may have LOST its JEE goal.
  select count(*) into v_lostjee
    from public.videos v
   where v.channel_id in (1, 81) and v.subject_id in (1, 2)
     and exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_neet)
     and not exists (select 1 from public.video_learning_goals g where g.video_id = v.id and g.learning_goal_id = v_jee);
  if v_lostjee <> 0 then
    raise exception '% lesson(s) carry NEET without JEE - the JEE goal was lost', v_lostjee;
  end if;

  -- Mathematics must be untouched: it is not a NEET subject.
  select count(*) into v_maths
    from public.videos v
    join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
   where v.subject_id = 3;
  if v_maths <> 0 then
    raise exception '% Mathematics lesson(s) carry the NEET goal', v_maths;
  end if;

  -- Courses must be NEET-visible too, or Browse will show none of this.
  select count(*) into v_courses
    from public.playlists p
    join public.playlist_learning_goals g on g.playlist_id = p.id and g.learning_goal_id = v_neet
   where p.channel_id in (1, 81) and p.subject_id in (1, 2);
  if v_courses = 0 then
    raise exception 'no course was made NEET-visible - Browse would show nothing';
  end if;

  -- Every NEET-tagged lesson in scope must sit in a NEET-visible course.
  select count(*) into v_orphan
    from public.videos v
    join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
   where v.channel_id in (1, 81) and v.subject_id in (1, 2)
     and not exists (
       select 1 from public.playlist_videos pv
       join public.playlist_learning_goals pg on pg.playlist_id = pv.playlist_id and pg.learning_goal_id = v_neet
       where pv.video_id = v.id);
  if v_orphan <> 0 then
    raise exception '% NEET lesson(s) sit in no NEET-visible course', v_orphan;
  end if;

  -- The outcome, counted by chapter.
  select count(*) into v_phys from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
      join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
     where c.subject_id = 1 group by c.id) s;
  select count(*) into v_chem from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
      join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_neet
     where c.subject_id = 2 group by c.id) s;

  raise notice 'SELF-TEST PASSED: % of % in-scope lessons now NEET-visible across % courses; NEET now reaches % Physics and % Chemistry chapters; JEE goal intact; Mathematics untouched.',
    v_tagged, v_scope, v_courses, v_phys, v_chem;
end
$verify$;

commit;
