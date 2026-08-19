-- CREATE-ONLY import: ALLEN JEE Mathematics.
--
-- WHY: Mathematics was the worst subject in the catalogue for teaching
-- diversity -- 31 of 44 chapters taught by a single INSTITUTE, almost all of
-- them Competishun. Aakash NEET and ALLEN NEET cannot help, because Mathematics
-- is not a NEET subject. ALLEN JEE is ALLEN's JEE-side channel: the same
-- institute already trusted in this catalogue for Biology, Chemistry and
-- Physics, teaching the subject Competishun currently owns alone.
--
-- Source     : https://www.youtube.com/playlist?list=PL_aKL95N88s3Lagk_JrSrLOK6PFqM2lUk
-- Lessons    : 21
-- Chapters   : 64 Circles; 62 Statistics; 67 Permutations and Combinations; 78 Binomial Theorem; 284 Limits, Continuity and Differentiability; 68 Straight Lines; 277 Solutions of Triangles; 59 Trigonometric Equations; 77 Sequences and Series; 76 Quadratic Equations; 79 Trigonometry; 281 Modulus and Graphs; 74 Logarithms; 282 Fundamentals of Mathematics
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "ALLEN JEE", and none was already in
--              the catalogue.
--
-- Lessons that genuinely span several chapters (ALLEN's one-shots often pair
-- two topics, e.g. "Determinants and Matrices") were EXCLUDED rather than filed
-- under a guess -- there is no single correct chapter_id for them.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent; whichever
-- of the 4 files runs first creates the ALLEN JEE channel row.
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
  -- ALLEN JEE is a new institute channel for this catalogue.
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCkUI45drrKTWLxy3q3voJRw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('ALLEN JEE', 'UCkUI45drrKTWLxy3q3voJRw')
    returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Mathematics Foundation Series') then
    raise exception 'course "%" already exists - this file has already been run', 'Mathematics Foundation Series';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'yRDCyWF_oWI', '2DTdJrnxJBQ', '9uHnWXcXSHE', 'Oyefja-xBkw', '_wBGPsRmOKw', 'xa5kPGXtF-I',
      't08ga9xpQh8', 'juqIi_BWDDw', 't45IZLULz10', 'dYjrkU19wvo', 'ZtwljN31jrs', '0lDiH-QfasI',
      'z4OJd5wzl2I', '3hazCJP2JjI', 'Eww1xObqddk', '1e-64nA7_Oc', 'tHqpw3L8Dz8', 'Gm3LzKlHDpU',
      'R4M68sdvWNg', 'caxOhbXkB_w', 'G222svYtGYk'
    ])
  ) then
    raise exception 'at least one of these 21 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Mathematics Foundation Series', 'Mathematics Foundation Series', 'Fundamental concepts, chapter by chapter, from the official ALLEN JEE Foundation Series.',
    null, v_channel_id, 1, 3, 'full-course', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'yRDCyWF_oWI', 'Circle', 'Mathematics - Fundamental Concepts of Circle | Foundation Series', 5705, 64),
      (2, '2DTdJrnxJBQ', 'Statistics', 'Mathematics - Fundamental Concepts of Statistics | Foundation Series', 5395, 62),
      (3, '9uHnWXcXSHE', 'Permutations & Combinations', 'Mathematics - Fundamental Concepts of Permutations & Combinations (NCERT) | Foundation Series', 6341, 67),
      (4, 'Oyefja-xBkw', 'Binomial Theorem', 'Mathematics - Fundamental Concepts of Binomial Theorem (NCERT) | Foundation Series', 4375, 78),
      (5, '_wBGPsRmOKw', 'Permutations & Combinations (P&C) (Part 2)', 'Mathematics - Fundamental Concepts of Permutations & Combinations (P&C) Part-2 | Foundation Series', 9101, 67),
      (6, 'xa5kPGXtF-I', 'Limits & Derivatives', 'Mathematics - Fundamental Concepts of Limits & Derivatives (NCERT) | Foundation Series', 8061, 284),
      (7, 't08ga9xpQh8', 'Point & Straight Lines', 'Mathematics - Fundamental Concepts of Point & Straight Lines (NCERT) | Foundation Series', 8810, 68),
      (8, 'juqIi_BWDDw', 'Permutations & Combinations (P&C) (Part 1)', 'Mathematics - Fundamental Concepts of Permutations & Combinations (P&C) Part-1 | Foundation Series', 6546, 67),
      (9, 't45IZLULz10', 'Solution of Triangles (SOT) (Part 2)', 'Mathematics - Fundamental Concepts of Solution of Triangles (SOT) Part-2 | Foundation Series', 4571, 277),
      (10, 'dYjrkU19wvo', 'Solution of Triangles (SOT) (Part 1)', 'Mathematics - Fundamental Concepts of Solution of Triangles (SOT) Part-1 | Foundation Series', 4931, 277),
      (11, 'ZtwljN31jrs', 'Trigonometric Equations (Part 2)', 'Mathematics - Fundamental Concepts of Trigonometric Equations (Part-2) | Foundation Series', 11571, 59),
      (12, '0lDiH-QfasI', 'Trigonometric Equations (Part 1)', 'Mathematics - Fundamental Concepts of Trigonometric Equations (Part-1) | Foundation Series', 11146, 59),
      (13, 'z4OJd5wzl2I', 'Sequence & Series', 'Mathematics - Fundamental Concepts of Sequence & Series | Foundation Series | @ALLENJEE', 5671, 77),
      (14, '3hazCJP2JjI', 'Quadratic Equation (Part 1)', 'Mathematics - Fundamental Concepts of Quadratic Equation | Foundation Series | @ALLENJEE', 10301, 76),
      (15, 'Eww1xObqddk', 'Trigonometric Ratios & Identities (Part 2)', 'Mathematics - Fundamental Concepts of Trigonometric Ratios & Identities (Part-2) | Foundation Series', 7896, 79),
      (16, '1e-64nA7_Oc', 'Trigonometric Ratios & Identities (Part 1)', 'Mathematics - Fundamental Concepts of Trigonometric Ratios & Identities (Part-1) | Foundation Series', 9571, 79),
      (17, 'tHqpw3L8Dz8', 'Sequence & Series (Part 1)', 'Mathematics - Fundamental Concepts of Sequence & Series (Part-1) | Foundation Series', 15359, 77),
      (18, 'Gm3LzKlHDpU', 'Rational & Irrational Inequality', 'Mathematics - Fundamental Concepts of Rational & Irrational Inequality | Foundation Series', 11361, 281),
      (19, 'R4M68sdvWNg', 'Logarithm', 'Mathematics - Fundamental Concepts of Logarithm | Foundation Series | @ALLENJEE', 12536, 74),
      (20, 'caxOhbXkB_w', 'Set Theory & Number System', 'Mathematics - Fundamentals of Set Theory & Number System | Foundation Series', 12548, 282),
      (21, 'G222svYtGYk', 'Quadratic Equation (Part 2)', 'Mathematics - Fundamentals Concepts of Quadratic Equation | Foundation Series | @ALLENJEE', 19149, 76)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 3) then
      raise exception 'chapter % is not a Mathematics chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
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

  if v_inserted <> 21 then
    raise exception 'expected 21 lessons for "%", inserted %', 'Mathematics Foundation Series', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Mathematics Foundation Series';
  end if;
end $$;
