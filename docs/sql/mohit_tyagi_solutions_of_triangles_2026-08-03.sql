-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 277.
--
-- Chapter 277 ("Solutions of Triangles") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMaerL1K-p5sRRdzjNrqn72Rg
-- Lessons    : 9 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 9 pass src/titleQuality.js with
--              zero blocking issues and zero warnings, and are unique within the course.
--
-- Safe to re-run: it aborts rather than duplicating. Order-independent, so it does
-- not matter which of the six 2026-08-03 import files you run first.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_dropper_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-11';
  select id into strict v_dropper_id from public.class_levels where slug = 'dropper';

  -- Guard the target rather than a global row count, so these six files can be
  -- run in any order and a re-run fails loudly instead of duplicating lessons.
  if not exists (
    select 1 from public.chapters
    where id = 277 and subject_id = 3 and name = 'Solutions of Triangles'
  ) then
    raise exception 'chapter 277 is not the expected "%" chapter', 'Solutions of Triangles';
  end if;

  if exists (select 1 from public.playlists where title = 'Solutions of Triangles') then
    raise exception 'course "%" already exists - this file has already been run', 'Solutions of Triangles';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      '7seemsdE7Ok', '4Z_eesxEJYU', 'xGFBRJzxe4M', 'iYFJj7au4v0', 'aJSPt06GLt8', '1q7yTaYcS24',
      'FD6a01Lg4Ro', 'NLWlEgtJv2Q', 'JZh8LrRr_4U'
    ])
  ) then
    raise exception 'at least one of these 9 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Solutions of Triangles',
    'Solution/Properties of Triangle',
    'Solution and properties of triangles from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '11th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, '7seemsdE7Ok', 'Solution/properties Of Triangle — Basics and Notation', '#1-Solution/properties Of Triangle-Basics and Notation-IIT JEE Mains and Advance Lectures', 3351),
      (2, '4Z_eesxEJYU', 'Solution Of Triangle — Sine and Cosine Rule Projection Formula', '#2-Solution Of Triangle-Sine and Cosine Rule Projection Formula-IIT JEE Mains and Advance Lectures', 3298),
      (3, 'xGFBRJzxe4M', 'Solution Of Triangle — Illustrations on Sine and Cosine Rule', '#3-Solution Of Triangle-Illustrations on Sine and Cosine Rule-IIT JEE', 4209),
      (4, 'iYFJj7au4v0', 'Solution Of Triangles', '#4-Solution Of Triangles-IIT JEE Mains 2018-Best Video Lectures on Maths by MOHIT TYAGI(in Hindi)', 671),
      (5, 'aJSPt06GLt8', 'SOT — Half Angle formula', '#5-SOT-Half Angle formula-IIT JEE Mains/Advanced 2018-online maths lecture by Mohit Tyagi', 1357),
      (6, '1q7yTaYcS24', 'SOT — Cot m-n Theorem', '#6-SOT-Cot m-n Theorem - IIT JEE Maths by Mohit Tyagi in hindi', 1548),
      (7, 'FD6a01Lg4Ro', 'Centroid and its properties in a triangles', '#7-Centroid and its properties in a triangles-IITJEE online maths by Mohit Tyagi advanced 2018', 466),
      (8, 'NLWlEgtJv2Q', 'Circumcenter in a triangles', '#8-Circumcenter in a triangles-IITJEE online maths by Mohit Tyagi advanced 2018', 274),
      (9, 'JZh8LrRr_4U', 'Orthocenter in a triangles', '#9-Orthocenter in a triangles-IITJEE online maths by Mohit Tyagi advanced 2018', 804)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 277, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 9 then
    raise exception 'expected 9 lessons for "%", inserted %', 'Solutions of Triangles', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 277
  ) < 2 then
    raise exception 'chapter 277 still has fewer than two teaching voices after import';
  end if;
end $$;
