-- CREATE-ONLY import: "Principle of Mathematical Induction" for JEE/olympiad Mathematics.
--
-- WHY A NEW CHAPTER: this catalogue had nowhere to file olympiad topic content.
-- Its existing olympiad chapters (INMO Solutions, ISI Entrance PYQs, PRMO and
-- IOQM Solutions) are all past-paper solutions; there was no chapter for the
-- underlying topics an olympiad student actually studies. ALLEN JEE's own
-- Foundation Series lesson on mathematical induction had to be skipped during
-- the 3 August Mathematics import for exactly this reason.
--
-- The chapter is created here if it does not already exist, so these files can
-- be run in any order and re-running is safe.
--
-- Source     : Mohit Tyagi — https://www.youtube.com/playlist?list=PL_A4M5IAkMad3oVwABWAwMOPxsQlIEz38
-- Lessons    : 11
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi", and none was already
--              in the catalogue.
-- Titles     : cleaned for display; source_title keeps YouTube's original
--              verbatim. All pass src/titleQuality.js with zero blocking issues
--              and zero warnings, and are unique within this course.
--
-- Safe to re-run: aborts rather than duplicating.
do $$
declare
  v_channel_id bigint;
  v_chapter_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_goal record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('Mohit Tyagi', 'UCpyc1eTpM1cA3P0ZWym4clw') returning id into v_channel_id;
  end if;

  select id into v_chapter_id from public.chapters
  where subject_id = 3 and name = 'Principle of Mathematical Induction';
  if v_chapter_id is null then
    if exists (select 1 from public.chapters where subject_id = 3 and display_order = 47) then
      raise exception 'Mathematics display_order 47 is already taken - resolve before creating "%"', 'Principle of Mathematical Induction';
    end if;
    insert into public.chapters (name, slug, subject_id, display_order)
    values ('Principle of Mathematical Induction', 'principle-of-mathematical-induction', 3, 47)
    returning id into v_chapter_id;
  end if;

  if exists (select 1 from public.playlists where title = 'Principle of Mathematical Induction') then
    raise exception 'course "%" already exists - this file has already been run', 'Principle of Mathematical Induction';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'IOA1CsxJPgQ', 'u2oMxKABvIo', 'WSyHISSTvqo', 'x6FfBWh-Z6A', '0sc2nvsoNIs', 'to4hUEeZrxs',
      'xJPhCSl5TKw', 'isX1Vt_TG3o', 'eRIk6t9yRck', 'AKZuLElOqm0', 'YorCPsPeEpU'
    ])
  ) then
    raise exception 'at least one of these 11 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Principle of Mathematical Induction', 'Principle of Mathematical Induction', 'The principle of mathematical induction, taught in sequence on the official Mohit Tyagi channel.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, id from public.learning_goals
  where slug = any(array['jee', 'olympiad']);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'IOA1CsxJPgQ', 'Principle of Mathematical Induction — Introduction (Part 1)', '#1-Principle of Mathematical Induction-Introduction-RMO,PRMO,CBSE boards', 784),
      (2, 'u2oMxKABvIo', 'Principle of Mathematical Induction — questions (Part 2)', '#2-Principle of Mathematical Induction-questions-RMO,PRMO,CBSE boards', 691),
      (3, 'WSyHISSTvqo', 'Principle of Mathematical Induction — questions (Part 3)', '#3-Principle of Mathematical Induction-questions-RMO,PRMO,CBSE boards', 764),
      (4, 'x6FfBWh-Z6A', 'Principle of Mathematical Induction — questions (Part 4)', '#4-Principle of Mathematical Induction-questions-RMO,PRMO,CBSE boards', 564),
      (5, '0sc2nvsoNIs', 'Principle of Mathematical Induction — TYPE-II (Part 5)', '#5-Principle of Mathematical Induction-TYPE-II-RMO,PRMO,CBSE boards', 435),
      (6, 'to4hUEeZrxs', 'Principle of Mathematical Induction — TYPE-III (Part 6)', '#6-Principle of Mathematical Induction-TYPE-III-RMO,PRMO,CBSE boards', 540),
      (7, 'xJPhCSl5TKw', 'Principle of Mathematical Induction — TYPE-IV (Part 7)', '#7-Principle of Mathematical Induction-TYPE-IV-RMO,PRMO,CBSE boards', 805),
      (8, 'isX1Vt_TG3o', 'Principle of Mathematical Induction — TYPE-IV-Examples (Part 8)', '#8-Principle of Mathematical Induction-TYPE-IV-Examples-RMO,PRMO,CBSE boards', 746),
      (9, 'eRIk6t9yRck', 'Principle of Mathematical Induction — TYPE-V & Example (Part 9)', '#9-Principle of Mathematical Induction-TYPE-V & Example-RMO,PRMO,CBSE boards', 674),
      (10, 'AKZuLElOqm0', 'Principle of Mathematical Induction — TYPE-VI & Example (Part 10)', '#10-Principle of Mathematical Induction-TYPE-VI & Example-RMO,PRMO,CBSE boards', 1292),
      (11, 'YorCPsPeEpU', 'PMI — Two Dimensional Induction-TYPE-VII & Example (Part 11)', '#11-PMI-Two Dimensional Induction-TYPE-VII & Example-RMO,PRMO,CBSE boards', 1034)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, v_chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    for v_goal in
      select id from public.learning_goals where slug = any(array['jee', 'olympiad'])
    loop
      insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal.id) on conflict do nothing;
    end loop;

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

  if v_inserted <> 11 then
    raise exception 'expected 11 lessons for "%", inserted %', 'Principle of Mathematical Induction', v_inserted;
  end if;

  -- A new chapter must not be left empty, and no lesson may be left unfiled.
  if not exists (select 1 from public.videos where chapter_id = v_chapter_id) then
    raise exception 'chapter "%" is still empty after the import', 'Principle of Mathematical Induction';
  end if;
  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Principle of Mathematical Induction';
  end if;
end $$;
