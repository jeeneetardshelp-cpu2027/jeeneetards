-- CREATE-ONLY import: eSaral Mathematics for JEE.
--
-- WHY: measured through the exam-goal filter students browse with, JEE
-- Mathematics had 14 chapters taught by a single institute -- Competishun alone
-- across the whole of calculus, conics, matrices and complex numbers. ALLEN's
-- JEE maths one-shots could not close them because that series pairs chapters
-- ("Determinants and Matrices", "Binomial Theorem & Complex Number"), leaving no
-- single correct chapter_id.
--
-- eSaral's Mathematics Revision series is taught chapter by chapter, so it maps
-- cleanly. Across both files these 58 lessons take the JEE view from 18 to 29 of
-- 32 chapters with two or more institutes, closing 11: Relations and Functions,
-- Differential Equations, Parabola, Complex Numbers, Determinants, Continuity,
-- Definite Integration, Differentiation, Indefinite Integration, Matrices and
-- Applications of Derivatives.
--
-- Three JEE Mathematics gaps remain and are NOT closable from any source now in
-- the catalogue: Ellipse, Application of Integrals and Probability. eSaral
-- covers Parabola and Hyperbola but not Ellipse, and teaches probability only
-- inside combined sets.
--
-- Source     : eSaral — https://www.youtube.com/playlist?list=PLMjEg73ogUEKNYWOBCDJ7wh4ny2Z0iXVW
-- Lessons    : 50    Chapters: 25
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

  if exists (select 1 from public.playlists where title = 'Mathematics Topicwise Revision — eSaral') then
    raise exception 'course "%" already exists - this file has already been run', 'Mathematics Topicwise Revision — eSaral';
  end if;

  if exists (select 1 from public.videos where youtube_video_id = any(array['kijwrAOqZqA', 'IrW5zg9K-W0', 'UBwu6wSSfJw', 'UwMAo_x_dMM', 'a7Wd4FadC9k', 'deMgtjXdKzs', 'p5vNdpg6rDY', 'Esefo3tII6I', '2xryJwfyQu0', 'zyNXZIYc0Xo', 'AxPNXT9fUOg', 'A1us4JbwRP0', 'UCmH1GjFVIo', 'IKvln21tW60', 'ENPk7jBXhDw', '2eqXwjy16X4', 'UeyBApcFIcM', 'uw_jXtSULmE', 'PT50KQwT2EU', 'NKMGpPcbg7g', 'strpyL0apQk', 'Zc-xguq7AoM', 'xy8zYcKddqw', 'er7WlEM1HRA', 'oQVAIDgMJMc', 'p7KGqdlvzos', 'Xn4KCVVdyvI', 'jlCP3kHPK1g', '_-XEMe72irI', 'AO8vuRo6kpA', '1KvnxeJWboc', 'GUP9wUIIwIM', 'L7Qv6TIxcHE', 'L3vxK4PrEjo', 'n43SrwYj6Cc', 'F835xnUQu3o', 'BnRY60Jx9B4', 'yz-Kp-X3ht4', 'IOul0u49-KI', '33rjHZ-UnZY', 'mRrpTmFBPB4', 'k1xorsqRSr4', 'P7bqjBTm1QI', 'Mg_T7dpFtAE', '3z3fPqAMECE', 'HIMHzgft0O0', 'oLhtFnOs318', '1R3HMQeYzCM', 'I4_vREOCd4Y', 'l0uQ5IsTHmQ'])) then
    raise exception 'at least one of these 50 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Mathematics Topicwise Revision — eSaral', 'Mathematics Topicwise Revision — eSaral', 'Chapter-by-chapter Mathematics revision for JEE, from the official eSaral channel.',
    null, v_channel_id, 1, 3, 'revision', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'kijwrAOqZqA', 'Vector Algebra (Part 1)', 'Vector Algebra - Part 1 | Maths Revision Series | Formulae & Important Points | Class 12 & JEE', 3303, 72),
      (2, 'IrW5zg9K-W0', 'Vector Algebra (Part 2)', 'Vector Algebra - Part 2 | Maths Revision Series | Formulae & Important Points | Class 12 & JEE', 2578, 72),
      (3, 'UBwu6wSSfJw', '3D Geometry (Part 1)', '3D Geometry - Part 1 | Quick Revision | All Formulae & Key Points | Class 12, JEE | N.K. Gupta Sir', 3206, 72),
      (4, 'UwMAo_x_dMM', '3D Geometry (Part 2)', '3D Geometry - Part 2 | Quick Revision | All Formulae & Key Points | Class 12, JEE | N.K. Gupta Sir', 2002, 72),
      (5, 'a7Wd4FadC9k', 'Logarithm', 'Logarithm | Maths Revision Series | All Formulae & Key Points | Class 11 & JEE (Main + Advanced)', 3081, 74),
      (6, 'deMgtjXdKzs', 'Trigonometric Ratio of Compound Angles', 'Trigonometric Ratio of Compound Angles | Maths Revision Series | Class 11 & JEE (Main + Advanced)', 3726, 79),
      (7, 'p5vNdpg6rDY', 'Relations and Functions (Part 1)', 'Relations and Functions (Part 1) | Maths Revision Series | Class 12 & JEE (Main + Advanced)', 3285, 276),
      (8, 'Esefo3tII6I', 'Relations and Functions (Part 2)', 'Relations and Functions (Part 2) | Maths Revision Series | Class 12 & JEE (Main + Advanced)', 2614, 276),
      (9, '2xryJwfyQu0', 'Relations and Functions (Part 3)', 'Relations and Functions (Part 3) | Maths Revision Series | Class 12 & JEE (Main + Advanced)', 3573, 276),
      (10, 'zyNXZIYc0Xo', 'Functions', 'Functions | Transformations of Graph | Maths Revision Series | Class 12 & JEE (Main + Advanced)', 1261, 276),
      (11, 'AxPNXT9fUOg', 'Quadratic Equations (Part 1)', 'Quadratic Equations (Part -1) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 2644, 76),
      (12, 'A1us4JbwRP0', 'Quadratic Equations (Part 2)', 'Quadratic Equations (Part - 2) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 3645, 76),
      (13, 'UCmH1GjFVIo', 'Inverse Trigonometric Functions (Part 1)', 'Inverse Trigonometric Functions (Part - 1) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2069, 58),
      (14, 'IKvln21tW60', 'Inverse Trigonometric Functions (Part 2)', 'Inverse Trigonometric Functions (Part - 2) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 1138, 58),
      (15, 'ENPk7jBXhDw', 'Trigonometric Equations', 'Trigonometric Equations in One Shot | Maths Revision Series | Class 11, JEE (Main + Advanced)', 2755, 59),
      (16, '2eqXwjy16X4', 'Limits (Part 1)', 'Limits (Part - 1) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 1901, 284),
      (17, 'UeyBApcFIcM', 'Limits (Part 2)', 'Limits (Part - 2) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 1441, 284),
      (18, 'uw_jXtSULmE', 'Continuity', 'Continuity in One Shot | Maths Revision Series | Class 11, JEE (Main + Advanced)', 2744, 70),
      (19, 'PT50KQwT2EU', 'Differentiability', 'Differentiability in One Shot | Maths Revision Series | Class 12, JEE (Main + Advanced)', 1632, 284),
      (20, 'NKMGpPcbg7g', 'Sequence and Series (Part 1)', 'Sequence and Series (Part - 1) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 2458, 77),
      (21, 'strpyL0apQk', 'Sequence and Series (Part 2)', 'Sequence and Series (Part - 2) | Maths Revision Series | Class 11, JEE (Main + Advanced)', 2874, 77),
      (22, 'Zc-xguq7AoM', 'Methods of Differentiation (Part 1)', 'Methods of Differentiation (Part - 1) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2170, 75),
      (23, 'xy8zYcKddqw', 'Methods of Differentiation (Part 2)', 'Methods of Differentiation (Part - 2) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2095, 75),
      (24, 'er7WlEM1HRA', 'Solution of Triangles', 'Solution of Triangles in one shot | Maths Revision Series | Class 11, JEE (Main + Advanced)', 3632, 277),
      (25, 'oQVAIDgMJMc', 'Application of Derivatives (Part 1)', 'Application of Derivatives (Part - 1) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2953, 280),
      (26, 'p7KGqdlvzos', 'Application of Derivatives (Part 2)', 'Application of Derivatives (Part - 2) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2788, 280),
      (27, 'Xn4KCVVdyvI', 'Application of Derivatives (Part 3)', 'Application of Derivatives (Part - 3) | Maths Revision Series | Class 12, JEE (Main + Advanced)', 2578, 280),
      (28, 'jlCP3kHPK1g', 'Binomial Theorem (Part 1)', 'Binomial Theorem Part-1 I Maths Revision series I Class 11, JEE (Main + Advanced)', 2973, 78),
      (29, '_-XEMe72irI', 'Binomial Theorem (Part 2)', 'Binomial Theorem Part -2 I Maths Revision Series I Class 11 , JEE (Main + Advanced)', 1921, 78),
      (30, 'AO8vuRo6kpA', 'Indefinite Integration (Part 1)', 'Indefinite Integration Part -1 I Maths Revision Series I Class 12, JEE (Main + Advanced)', 2805, 278),
      (31, '1KvnxeJWboc', 'Indefinite Integration (Part 2)', 'Indefinite Integration Part 2 I Maths Revision Series I Class- 12, JEE (Mains+ Advanced)', 2451, 278),
      (32, 'GUP9wUIIwIM', 'Permutation and Combination (Part 1)', 'Permutation and Combination Part -1 I Maths Revision Series I Class 11, JEE (Main + Advanced)', 2080, 67),
      (33, 'L7Qv6TIxcHE', 'Permutation and Combination (Part 2)', 'Permutation and Combination Part -2 I Maths Revision Series I Class -11, JEE (Main + Advanced)', 2422, 67),
      (34, 'L3vxK4PrEjo', 'Permutation and Combination (Part 3)', 'Permutation and Combination Part -3 I Maths Revision Series I Class 11, JEE (Main + Advanced)', 2390, 67),
      (35, 'n43SrwYj6Cc', 'Definite Integration (Part 1)', 'Definite Integration Part -1 I  Maths Revision Series I Class 12, JEE (Main + Advanced)', 2160, 73),
      (36, 'F835xnUQu3o', 'Definite Integration (Part 2)', 'Definite Integration Part -2 I Maths Revision Series I JEE (Main + Advanced)', 1977, 73),
      (37, 'BnRY60Jx9B4', 'Point', 'Point Complete with Mind Map I Maths Revision Series I Class 11, JEE (Main + Advanced)', 2512, 68),
      (38, 'yz-Kp-X3ht4', 'Differential Equation (Part 1)', 'Differential Equation Part 1 I Maths Revision Series I Class 12, JEE (Main + Advanced)', 1849, 57),
      (39, 'IOul0u49-KI', 'Differential Equation (Part 2)', 'Differential Equation Part -2 I Maths Revision Series I Class 12, JEE (Main + Advanced)', 1645, 57),
      (40, '33rjHZ-UnZY', 'Circle', 'Circle Part -1 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 3617, 64),
      (41, 'mRrpTmFBPB4', 'Matrices (Part 1)', 'Matrices Part -1 I Maths Revision Series I Class 12, JEE (Main + Advanced)', 1723, 279),
      (42, 'k1xorsqRSr4', 'Matrices (Part 2)', 'Matrices Part -2 I Maths Revision Series I Class 12, JEE (Main + Advanced) | eSaral', 2251, 279),
      (43, 'P7bqjBTm1QI', 'Matrices (Part 3)', 'Matrices Part -3 I Maths Revision Series I Class 12, JEE (Main + Advanced)', 1689, 279),
      (44, 'Mg_T7dpFtAE', 'Parabola', 'Parabola Part -2 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2525, 63),
      (45, '3z3fPqAMECE', 'Complex (Part 1)', 'Complex Part -1 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2842, 65),
      (46, 'HIMHzgft0O0', 'Complex (Part 2)', 'Complex Part -2 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2749, 65),
      (47, 'oLhtFnOs318', 'Complex (Part 3)', 'Complex Part -3 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2296, 65),
      (48, '1R3HMQeYzCM', 'Hyperbola (Part 1)', 'Hyperbola Part -1 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2517, 61),
      (49, 'I4_vREOCd4Y', 'Hyperbola (Part 2)', 'Hyperbola Part -2 I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2583, 61),
      (50, 'l0uQ5IsTHmQ', 'Statistics', 'Statistics I Maths Revision Series I Class-11,12, JEE (Main + Advanced)', 2985, 62)
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

  if v_inserted <> 50 then
    raise exception 'expected 50 lessons for "%", inserted %', 'Mathematics Topicwise Revision — eSaral', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Mathematics Topicwise Revision — eSaral';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Mathematics Topicwise Revision — eSaral';
  end if;
end $$;
