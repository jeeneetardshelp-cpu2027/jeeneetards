-- CREATE-ONLY import: Aakash NEET Chemistry.
--
-- WHY: Chemistry had 29 of 49 chapters taught by a single INSTITUTE. The two
-- coaching families already in the catalogue are Competishun (channels 1/81/77)
-- and Physics Wallah (channels 5/89/76) -- adding one channel of a family that
-- is already present does not give a student a second opinion. Aakash NEET
-- is an independent institute, so these lessons are a genuine second voice.
--
-- Source     : https://www.youtube.com/playlist?list=PL7AAT-ai0VD6CGHujJIXxNS2Q6HUltSqb
-- Lessons    : 10 (playlist declares 10)
-- Chapters   : 34 Solid State
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Aakash NEET" and none of them was
--              already present in the catalogue.
-- Titles     : cleaned for display; source_title keeps YouTube's original
--              verbatim. All pass src/titleQuality.js with zero blocking issues
--              and zero warnings, and are unique within this course.
-- Teacher    : left null on purpose -- the source titles name more than one
--              faculty member (or none), and inventing a single name would be false.
--
-- Each lesson carries its OWN chapter_id, so a series covering several chapters
-- files each lesson where it belongs instead of all landing under one guess.
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
  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';

  select id into strict v_goal_id from public.learning_goals where slug = 'neet';

  if exists (select 1 from public.playlists where title = 'Solid State — Class 12 Chemistry') then
    raise exception 'course "%" already exists - this file has already been run', 'Solid State — Class 12 Chemistry';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'itP5-qq9SN4', 'PAcoNJga6jU', '-TyFsY3uPVc', '0dUHBfdPlzE', '3GTJeCJswIE', 'wpsCaBQutK0',
      'tu9WZfWcCVo', 'siEHQEnr_Fs', 'hfxUGDFzMVY', 'DWb7QZc1Aws'
    ])
  ) then
    raise exception 'at least one of these 10 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Solid State — Class 12 Chemistry',
    'Solid State — Class 12 Chemistry',
    'The Solid State chapter taught in sequence, from the official Aakash NEET channel.',
    null, v_channel_id, 2, 2, 'full-course', 'hinglish',
    'intermediate'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug = any(array['class-12', 'dropper']);

  for v_row in
    select * from (values
      (1, 'itP5-qq9SN4', 'Solid State (Part 1)', 'Solid State Class 12 Chemistry Concepts Explained (L-1) | NEET 2023 Chemistry Exam Preparation', 3669, 34),
      (2, 'PAcoNJga6jU', 'Crystal Lattice and Unit Cell (Part 2)', 'Crystal Lattice and Unit Cell Class 12 Chemistry - Solid State Concepts (L 2) | NEET 2023 Chemistry', 3766, 34),
      (3, '-TyFsY3uPVc', 'Coordination Number (Part 3)', 'Coordination Number Class 12 Chemistry - Solid State Concepts (L3) | NEET 2023 Chemistry Exam', 3783, 34),
      (4, '0dUHBfdPlzE', 'Close Packed Structures (Part 4)', 'Close Packed Structures Class 12 Chemistry - Solid State Concepts (L 4) | NEET 2023 Exam Preparation', 3691, 34),
      (5, '3GTJeCJswIE', 'Packing Efficiency and Density (Part 5)', 'Packing Efficiency and Density - Solid State Class 12 Chemistry Concepts (L 5) | NEET 2022 Exam', 3716, 34),
      (6, 'wpsCaBQutK0', 'Radius Ratio and Ionic Structures (Part 6)', 'Radius Ratio and Ionic Structures - Solid State Class 12 Chemistry Concepts (L 6) | NEET 2022 Exam', 3636, 34),
      (7, 'tu9WZfWcCVo', 'Imperfections in Solids (Part 7)', 'Imperfections in Solids Class 12 Chemistry - Solid State Concepts (L7) | NEET 2022 Chemistry Exam', 4051, 34),
      (8, 'siEHQEnr_Fs', 'Electrical & Magnetic Properties of Solid (Part 8)', 'Electrical & Magnetic Properties of Solid - Solid State Class 12 Chemistry Concept (L8) | NEET 2022', 3536, 34),
      (9, 'hfxUGDFzMVY', 'Ionic Structures and Spinels (Part 9)', 'Ionic Structures and Spinels - Solid State Class 12 Chemistry Concepts (L9) | NEET 2022 Chemistry', 3380, 34),
      (10, 'DWb7QZc1Aws', 'Solid State — 15 Most Important Questions', '15 Most Important Questions from Solid State Class 12 Chemistry | NEET 2022 Chemistry Exam', 2218, 34)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    -- Refuse to file a lesson under a chapter that is not Chemistry.
    if not exists (
      select 1 from public.chapters where id = v_row.chapter_id and subject_id = 2
    ) then
      raise exception 'chapter % is not a Chemistry chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 2,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    -- Class levels follow the lesson's OWN chapter: the Class 11 half of the
    -- syllabus is display_order 1-18, the Class 12 half 19+, and every lesson is
    -- also useful to a dropper.
    for v_level in
      select cl.id
      from public.class_levels cl
      join public.chapters ch on ch.id = v_row.chapter_id
      where cl.slug = 'dropper'
         or (cl.slug = 'class-11' and (ch.display_order <= 18 or ch.id in (93, 288)))
         or (cl.slug = 'class-12' and (ch.display_order >= 19 or ch.id in (93, 288)))
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 10 then
    raise exception 'expected 10 lessons for "%", inserted %', 'Solid State — Class 12 Chemistry', v_inserted;
  end if;

  -- Every lesson must be filed under a goal and a class level, or it is
  -- invisible to goal-scoped search (see backfill_video_taxonomy_junctions).
  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Solid State — Class 12 Chemistry';
  end if;
end $$;
