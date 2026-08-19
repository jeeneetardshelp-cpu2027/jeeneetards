-- CREATE-ONLY import: "Number Theory" for JEE/olympiad Mathematics.
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
-- Source     : Mohit Tyagi — https://www.youtube.com/playlist?list=PL_A4M5IAkMaeC1JQUXbAYMTKGu0DppkSz
-- Lessons    : 18
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
  where subject_id = 3 and name = 'Number Theory';
  if v_chapter_id is null then
    if exists (select 1 from public.chapters where subject_id = 3 and display_order = 45) then
      raise exception 'Mathematics display_order 45 is already taken - resolve before creating "%"', 'Number Theory';
    end if;
    insert into public.chapters (name, slug, subject_id, display_order)
    values ('Number Theory', 'number-theory', 3, 45)
    returning id into v_chapter_id;
  end if;

  if exists (select 1 from public.playlists where title = 'Number Theory for Maths Olympiads') then
    raise exception 'course "%" already exists - this file has already been run', 'Number Theory for Maths Olympiads';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'mhzQzaoG_Wk', '5w3xY-fkz54', 'dWkRE5IJWuw', 'aVLNKqdGUck', 'hQ6wrI1zPMc', 'k0ns62ZniHk',
      'fBvOKVUDurg', 'FNjcuwMJqYM', 'ZzQiLXwoV4w', 'j4i0Uvr_oQA', 'aqwwK29orpQ', 'IniNmWAzkd8',
      'T0mHp5rChAU', 'mzxuYBdXTqo', 'x-dW4Q7lg2g', 'GhXZBm53hAo', 'YO82aRo5BWc', 'NnpHI1Sc91g'
    ])
  ) then
    raise exception 'at least one of these 18 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Number Theory for Maths Olympiads', 'Number Theory for Maths Olympiads', 'Number theory for RMO and PRMO, taught in sequence on the official Mohit Tyagi channel.',
    'Mohit Tyagi', v_channel_id, 3, 3, 'full-course', 'hinglish',
    'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, id from public.learning_goals
  where slug = any(array['olympiad']);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'mhzQzaoG_Wk', 'Number Theory (Part 1)', '#1-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 470),
      (2, '5w3xY-fkz54', 'Number Theory (Part 2)', '#2-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 364),
      (3, 'dWkRE5IJWuw', 'Number Theory (Part 3)', '#3-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 353),
      (4, 'aVLNKqdGUck', 'Number Theory (Part 4)', '#4-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 471),
      (5, 'hQ6wrI1zPMc', 'Number Theory (Part 5)', '#5-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 558),
      (6, 'k0ns62ZniHk', 'Number Theory (Part 6)', '#6-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 672),
      (7, 'fBvOKVUDurg', 'Number Theory — LCM-Properties (Part 7)', '#7-Number Theory-LCM-Properties-RMO-PRMO-Math Olympiads by Mohit Tyagi', 458),
      (8, 'FNjcuwMJqYM', 'Number Theory (Part 8)', '#8-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 681),
      (9, 'ZzQiLXwoV4w', 'Number Theory (Part 9)', '#9-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 694),
      (10, 'j4i0Uvr_oQA', 'Number Theory (Part 10)', '#10-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 464),
      (11, 'aqwwK29orpQ', 'Number Theory (Part 11)', '#11-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 597),
      (12, 'IniNmWAzkd8', 'Number Theory (Part 12)', '#12-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 607),
      (13, 'T0mHp5rChAU', 'Number Theory (Part 13)', '#13-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 887),
      (14, 'mzxuYBdXTqo', 'Number Theory (Part 14)', '#14-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 424),
      (15, 'x-dW4Q7lg2g', 'Number Theory (Part 15)', '#15-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 669),
      (16, 'GhXZBm53hAo', 'Number Theory (Part 16)', '#16-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 716),
      (17, 'YO82aRo5BWc', 'Number Theory (Part 17)', '#17-Number Theory-RMO and PRMO-Maths Olympiads by Mohit Tyagi', 575),
      (18, 'NnpHI1Sc91g', 'Chinese Remainder Theorem Explained', 'Chinese Remainder Theorem Explained | Must-Know for Math Olympiads: IOQM, RMO, INMO, IMO', 2510)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 3,
      3, v_chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    for v_goal in
      select id from public.learning_goals where slug = any(array['olympiad'])
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

  if v_inserted <> 18 then
    raise exception 'expected 18 lessons for "%", inserted %', 'Number Theory for Maths Olympiads', v_inserted;
  end if;

  -- A new chapter must not be left empty, and no lesson may be left unfiled.
  if not exists (select 1 from public.videos where chapter_id = v_chapter_id) then
    raise exception 'chapter "%" is still empty after the import', 'Number Theory';
  end if;
  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Number Theory for Maths Olympiads';
  end if;
end $$;
