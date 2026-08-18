-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 279.
--
-- Chapter 279 ("Matrices") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMafsNaawDfrQl6EhgdEiWVD6
-- Lessons    : 12 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 12 pass src/titleQuality.js with
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
  select id into strict v_class_id from public.class_levels where slug = 'class-12';
  select id into strict v_dropper_id from public.class_levels where slug = 'dropper';

  -- Guard the target rather than a global row count, so these six files can be
  -- run in any order and a re-run fails loudly instead of duplicating lessons.
  if not exists (
    select 1 from public.chapters
    where id = 279 and subject_id = 3 and name = 'Matrices'
  ) then
    raise exception 'chapter 279 is not the expected "%" chapter', 'Matrices';
  end if;

  if exists (select 1 from public.playlists where title = 'Matrices') then
    raise exception 'course "%" already exists - this file has already been run', 'Matrices';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      '8XOF3ePoJdI', 'GQFfNvs1kg8', 'h8zcsZ6UREc', 'TsJMHt9i_rI', 'qkY24wTyQO4', 'GATHNlyv9pk',
      'eJckF-FUsP4', '-0VJejNzo9k', 'W7J-ERLBwNg', 'tf9TSluy4Os', 'BV_H_NelhWQ', '2ltnP6-y6EU'
    ])
  ) then
    raise exception 'at least one of these 12 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Matrices',
    'Matrices',
    'The complete Matrices course from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '12th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, '8XOF3ePoJdI', 'Matrices — Introduction and Terminology', '#1-Matrices-Introduction and Terminology IIT JEE mains and advance online videos', 1707),
      (2, 'GQFfNvs1kg8', 'Matrices — Classification of Square Matrices', '#2-Matrices-Classification of Square Matrices IIT JEE mains and advance online videos', 1465),
      (3, 'h8zcsZ6UREc', 'Matrices — Product of two Matrices', '#3- Matrices-Product of two Matrices-IIT JEE mains and advance online videos', 2839),
      (4, 'TsJMHt9i_rI', 'Matrices — Illustrations on Matrices', '#4-Matrices-Illustrations on Matrices-IIT JEE mains and advance online videos', 2193),
      (5, 'qkY24wTyQO4', 'Matrices — Idempotent, Involutory, Periodic and Nilpotent Matrices', '#5-Matrices-Idempotent,Involutory,Periodic and Nilpotent Matrices- IIT JEE', 1486),
      (6, 'GATHNlyv9pk', 'Matrices — Transpose, Symmetric and Skew Symmetric Matrices', '#6-Matrices-Transpose,Symmetric and Skew Symmetric Matrices-IIT JEE', 1883),
      (7, 'eJckF-FUsP4', 'Matrices — Orthogonal Matrices', '#7-Matrices-Orthogonal Matrices- IIT JEE Maths video lectures', 1203),
      (8, '-0VJejNzo9k', 'Matrices — Adjoint and Inverse of a Matrices', '#8-Matrices-Adjoint and Inverse of a Matrices   IIT JEE Maths video lectures', 2092),
      (9, 'W7J-ERLBwNg', 'Matrices Adjoint and Inverse of a Matrices illustrations', '#9-Matrices Adjoint and Inverse of a Matrices illustrations--IIT JEE Maths video lectures', 828),
      (10, 'tf9TSluy4Os', 'Matrices — System Of Equations Cramer''s Rule', '#10-Matrices--System Of Equations Cramer''s Rule--IIT JEE Maths video lectures', 1732),
      (11, 'BV_H_NelhWQ', 'Matrices — Solving System of Equations-Matrix Method', '#11-Matrices-Solving System of Equations-Matrix Method-IIT JEE Maths video lectures', 2792),
      (12, '2ltnP6-y6EU', 'Characteristic Equation And Cayley Hamilton Theorem For JEE Main+Advanced — Rajat Jain Sir', 'Characteristic Equation And Cayley Hamilton Theorem For JEE Main+Advanced | Rajat Jain Sir', 1791)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 279, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 12 then
    raise exception 'expected 12 lessons for "%", inserted %', 'Matrices', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 279
  ) < 2 then
    raise exception 'chapter 279 still has fewer than two teaching voices after import';
  end if;
end $$;
