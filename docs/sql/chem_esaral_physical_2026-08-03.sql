-- CREATE-ONLY import: eSaral Chemistry for JEE.
--
-- These are the last cleanly-mappable JEE Chemistry lessons available from the
-- five institutes now in the catalogue. Across both files they close two
-- chapters -- Solid State and Solutions -- and give three more a third
-- institute.
--
-- HONEST CEILING, recorded so nobody re-runs this search expecting more:
-- 16 JEE Chemistry chapters stay single-institute after this (Hydrogen,
-- s-Block, both p-Block groups, Redox Reactions, Chemical Kinetics, Surface
-- Chemistry, Nuclear Chemistry, Qualitative Analysis, Basic Inorganic
-- Nomenclature, Structural Isomerism, Introduction to Chemistry, General
-- Inorganic Chemistry and the rest). All five institutes teach those inside
-- COMBINED one-shots -- "Mole & Redox", "P Block + D and F Block", "GOC,
-- Isomerism & Alkyl Halide" -- which have no single correct chapter_id and are
-- excluded here for the same reason they were excluded everywhere else. Closing
-- them needs a source that teaches physical and inorganic chemistry chapter by
-- chapter; none of the five does.
--
-- Source     : eSaral — https://www.youtube.com/playlist?list=PLMjEg73ogUELTbkUa2B2RHjFefT8Jwp_-
-- Lessons    : 2    Chapters: 2
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API, all hosted on this one channel, none already present.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCddnJhXMUxzHoH8AZkZSd8w';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('eSaral', 'UCddnJhXMUxzHoH8AZkZSd8w') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Physical Chemistry Revision — eSaral') then
    raise exception 'course "%" already exists - this file has already been run', 'Physical Chemistry Revision — eSaral';
  end if;

  if exists (select 1 from public.videos where youtube_video_id = any(array['yYdLQxymYlM', 'TZlVwb9bwdc'])) then
    raise exception 'at least one of these 2 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physical Chemistry Revision — eSaral', 'Physical Chemistry Revision — eSaral', 'Physical Chemistry revision for JEE, from the official eSaral channel.',
    null, v_channel_id, 1, 2, 'revision', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'yYdLQxymYlM', 'Chemical Equilibrium', 'Chemical Equilibrium One-Shot | Physical Chemistry Complete Revision for Class 11, JEE, NEET', 6190, 30),
      (2, 'TZlVwb9bwdc', 'Solid State', 'Solid State in One Shot | Chemistry Class 12, JEE, NEET | eSaral | Prateek Sir', 13116, 34)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 2) then
      raise exception 'chapter % is not a Chemistry chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    for v_level in
      select id from public.class_levels where slug in ('class-11', 'class-12', 'dropper')
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 2 then
    raise exception 'expected 2 lessons for "%", inserted %', 'Physical Chemistry Revision — eSaral', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physical Chemistry Revision — eSaral';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physical Chemistry Revision — eSaral';
  end if;
end $$;
