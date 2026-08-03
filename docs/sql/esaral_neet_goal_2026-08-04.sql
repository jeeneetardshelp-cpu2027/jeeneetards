-- Give the eSaral lessons the NEET goal their own titles claim.
--
-- WHY: the eSaral Chemistry and Physics imports were tagged JEE-only. But 103
-- of those 110 lessons carry "NEET" in the title eSaral itself published --
-- "d & f block in One Shot | Class 12 Chemistry | JEE, NEET | Prateek Sir",
-- "General Organic Chemistry (GOC) Part 2 | Chemistry Revision for JEE, NEET,
-- Class 11". Browse is scoped by exam goal, so a NEET student cannot currently
-- see a single one of them.
--
-- This is NOT the same move I declined earlier. There the proposal was to tag
-- Aakash/ALLEN *NEET* content as *JEE* -- asserting that NEET material covers
-- JEE depth, which is my inference and not true. Here the publisher's own title
-- names both exams, and the condition below is that claim, checked per row
-- against source_title rather than assumed for the batch.
--
-- Effect: NEET Chemistry 21 -> 25 of 34 chapters with two or more institutes
-- (closing Stereoisomerism, Polymers, Organic Reaction Mechanisms and
-- Biomolecules) and NEET Physics 22 -> 25 of 29 (closing Dual Nature of
-- Radiation and Matter, Friction and Thermodynamics).
--
-- Additive only: the existing JEE goal is left in place, because these lessons
-- genuinely serve both. Nothing is deleted, and a lesson whose title does not
-- mention NEET is not touched.
--
-- Reversible: delete the NEET rows this adds with
--   delete from public.video_learning_goals g
--    using public.videos v, public.learning_goals lg
--    where g.video_id = v.id and g.learning_goal_id = lg.id
--      and lg.slug = 'neet' and v.channel_id = <eSaral> and v.source_title ilike '%NEET%';
--
-- Safe to re-run: the inserts are idempotent and the assertions still hold.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_eligible integer;
  v_lessons integer;
  v_courses integer;
begin
  select id into strict v_channel_id
  from public.institutes_channels where youtube_channel_id = 'UCddnJhXMUxzHoH8AZkZSd8w';

  select id into strict v_goal_id from public.learning_goals where slug = 'neet';

  -- Mathematics is not a NEET subject, so its lessons are excluded even if a
  -- title happens to mention NEET.
  select count(*) into v_eligible
  from public.videos v
  where v.channel_id = v_channel_id
    and v.subject_id in (1, 2)
    and v.source_title ilike '%neet%';

  if v_eligible = 0 then
    raise exception 'no eSaral lesson advertises NEET - refusing to guess';
  end if;

  insert into public.video_learning_goals (video_id, learning_goal_id)
  select v.id, v_goal_id
  from public.videos v
  where v.channel_id = v_channel_id
    and v.subject_id in (1, 2)
    and v.source_title ilike '%neet%'
  on conflict do nothing;

  -- A course becomes NEET-visible only when EVERY one of its lessons advertises
  -- NEET. A course with a single NEET-labelled lesson is not a NEET course.
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select p.id, v_goal_id
  from public.playlists p
  where p.channel_id = v_channel_id
    and p.subject_id in (1, 2)
    and exists (select 1 from public.playlist_videos pv where pv.playlist_id = p.id)
    and not exists (
      select 1
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
      where pv.playlist_id = p.id and v.source_title not ilike '%neet%'
    )
  on conflict do nothing;

  select count(*) into v_lessons
  from public.videos v
  join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_goal_id
  where v.channel_id = v_channel_id and v.subject_id in (1, 2);

  select count(*) into v_courses
  from public.playlists p
  join public.playlist_learning_goals g on g.playlist_id = p.id and g.learning_goal_id = v_goal_id
  where p.channel_id = v_channel_id and p.subject_id in (1, 2);

  if v_lessons <> v_eligible then
    raise exception 'expected % eSaral lessons to carry NEET, found %', v_eligible, v_lessons;
  end if;

  -- No lesson may have gained NEET without its own title saying so.
  if exists (
    select 1
    from public.videos v
    join public.video_learning_goals g on g.video_id = v.id and g.learning_goal_id = v_goal_id
    where v.channel_id = v_channel_id and v.source_title not ilike '%neet%'
  ) then
    raise exception 'a lesson gained the NEET goal without advertising NEET - refusing to leave that behind';
  end if;

  -- The JEE goal these lessons already had must survive.
  if exists (
    select 1 from public.videos v
    where v.channel_id = v_channel_id and v.subject_id in (1, 2)
      and not exists (
        select 1 from public.video_learning_goals g
        join public.learning_goals lg on lg.id = g.learning_goal_id
        where g.video_id = v.id and lg.slug = 'jee'
      )
  ) then
    raise exception 'an eSaral lesson lost its JEE goal';
  end if;

  raise notice 'eSaral now NEET-visible: % lessons across % courses', v_lessons, v_courses;
end $$;
