-- CREATE-ONLY import: ALLEN NEET Physics.
--
-- WHY: Physics had 8 of 33 chapters taught by a single INSTITUTE, and the only
-- two coaching families already in the catalogue are Competishun (channels
-- 1/81/77) and Physics Wallah (5/89/76). ALLEN NEET is independent of both,
-- so these lessons are a genuine second opinion rather than the same institute
-- on a different channel.
--
-- Source     : https://www.youtube.com/playlist?list=PLru9htpOg_gcY1PbcVZRVahYuYSsOpLl9
-- Lessons    : 29
-- Chapters   : 13 (Electromagnetic Induction; Magnetism and Matter; Mechanical Properties of Fluids; Modern Physics; Rotational Motion; Laws of Motion; Wave Optics; Ray Optics and Optical Instruments; Work, Energy and Power; Current Electricity; Newton's Laws of Motion (NLM); Electrostatics; Kinematics)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "ALLEN NEET", and none was already
--              in the catalogue.
-- Teacher    : left null -- more than one faculty member teaches this series,
--              and naming a single one would be false.
--
-- Each lesson carries its own chapter_id, decided from its own title, and the
-- migration refuses at runtime to file a lesson under a non-Physics chapter.
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
  from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  select id into strict v_goal_id from public.learning_goals where slug = 'neet';

  if exists (select 1 from public.playlists where title = 'Physics — NCERT Decode Series') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics — NCERT Decode Series';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'dxayONHvuC0', 'ysSlowELN7o', '-Ijfl4y9XZc', 'o5QRXTQe7lU', 'M3DyE2JVTAw', 'sfk0J6ytnp8',
      'DuMOluaZhzs', '61y0xtCafGg', 'LOYKyLzwNPU', 'Hr9WOmKZ3sY', 'A74vYSbOyuw', 'efkwuM1wfPw',
      '7Hxh7wlzpWI', 'vsHgQT9TswA', 'ESrhdfNDWTY', 'y0KPWNdxi74', 'a_GGJ-mFFQw', 'BprC1EMq4KM',
      'TIwYI8ehpFc', 'dj62ebZcdQg', '_B7QAu-JpGI', 'uw0QaOw3QvI', 'YE3slV96QLg', 'VOvpwTf1Clo',
      '264s9iiMAc0', 'vajbiwGm2nE', '4KfRSpsEAso', 'Slg3XCzlrWE', 'SEk3vePg7d0'
    ])
  ) then
    raise exception 'at least one of these 29 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics — NCERT Decode Series', 'Physics — NCERT Decode Series', 'NCERT-focused Physics revision from the official ALLEN NEET Decode series.',
    null, v_channel_id, 2, 1, 'revision', 'hinglish', 'intermediate'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'dxayONHvuC0', 'Electromagnetic Induction — NCERT Decode (Part 3)', 'Electromagnetic Induction Part-3 | Important for NEET 2024 Exam | Physics NCERT Decode @ALLENNEET', 3272, 13),
      (2, 'ysSlowELN7o', 'Electromagnetic Induction — NCERT Decode (Part 2)', 'Electromagnetic Induction Part-2 | Important for NEET 2024 Exam | Physics NCERT Decode @ALLENNEET', 3510, 13),
      (3, '-Ijfl4y9XZc', 'Electromagnetic Induction — NCERT Decode (Part 1)', 'Electromagnetic Induction Part-1 | Important for NEET 2024 Exam | Physics NCERT Decode @ALLENNEET', 2895, 13),
      (4, 'o5QRXTQe7lU', 'Magnetic Field and Magnetism — NCERT Decode (Part 3)', 'Magnetic Field and Magnetism (Part-3) | Important for NEET 2024 Exam | Physics NCERT Decode', 3631, 12),
      (5, 'M3DyE2JVTAw', 'Magnetic Field and Magnetism — NCERT Decode (Part 2)', 'Magnetic Field and Magnetism (Part-2) Live 🔴 Important for NEET 2024 Exam | Physics NCERT Decode', 3572, 12),
      (6, 'sfk0J6ytnp8', 'Magnetic Field and Magnetism — NCERT Decode', 'Magnetic Field and Magnetism | Important for NEET 2024 Exam | Physics NCERT Decode | @ALLENNEET', 3679, 12),
      (7, 'DuMOluaZhzs', 'Mechanical Properties Of Fluids & Solids — NCERT Decode (Part 3)', 'Mechanical Properties Of Fluids & Solids (Part-3) | Important for NEET 2024 Exam | Physics NCERT', 3009, 26),
      (8, '61y0xtCafGg', 'Mechanical Properties Of Fluids & Solids — NCERT Decode (Part 2)', 'Mechanical Properties Of Fluids & Solids Part-2 | Important for NEET 2024 Exam | Physics NCERT', 3396, 26),
      (9, 'LOYKyLzwNPU', 'Mechanical Properties Of Fluids & Solids — NCERT Decode (Part 1)', 'Mechanical Properties Of Fluids & Solids Part-1| Important for NEET 2024 Exam | Physics NCERT Decode', 3364, 26),
      (10, 'Hr9WOmKZ3sY', 'Modern Physics — NCERT Decode (Part 2)', 'Modern Physics (Part-2) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | ALLEN NEET', 2961, 83),
      (11, 'A74vYSbOyuw', 'Modern Physics — NCERT Decode (Part 1)', 'Modern Physics (Part-1) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2105, 83),
      (12, 'efkwuM1wfPw', 'System of Particles & Rotational Motion — NCERT Decode (Part 2)', 'System of Particles & Rotational Motion Part-2 | Important for NEET 2024 Exam | Physics NCERT Decode', 2440, 27),
      (13, '7Hxh7wlzpWI', 'System of Particles & Rotational Motion — NCERT Decode (Part 1)', 'System of Particles & Rotational Motion Part-1 | Important for NEET 2024 Exam | Physics NCERT Decode', 2941, 27),
      (14, 'vsHgQT9TswA', 'Circular Motion — NCERT Decode', 'Circular Motion | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2280, 82),
      (15, 'ESrhdfNDWTY', 'Wave Optics — NCERT Decode', 'Wave Optics | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 3573, 16),
      (16, 'y0KPWNdxi74', 'Ray Optics — NCERT Decode (Part 2)', 'Ray Optics (Part-2) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 3311, 20),
      (17, 'a_GGJ-mFFQw', 'Ray Optics — NCERT Decode (Part 1)', 'Ray Optics  (part-1) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET​', 3021, 20),
      (18, 'BprC1EMq4KM', 'Work Power Energy — NCERT Decode (Part 3)', 'Work Power Energy (part-3) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2217, 21),
      (19, 'TIwYI8ehpFc', 'Work Power Energy — NCERT Decode (Part 2)', 'Work Power Energy (part-2) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2605, 21),
      (20, 'dj62ebZcdQg', 'Work Power Energy — NCERT Decode (Part 1)', 'Work Power Energy (part-1) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2215, 21),
      (21, '_B7QAu-JpGI', 'Current Electricity — NCERT Decode (Part 2)', 'Current Electricity (Part-2) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode |  @ALLENNEET', 3165, 10),
      (22, 'uw0QaOw3QvI', 'Current Electricity — NCERT Decode (Part 1)', '➡️ Current Electricity (Part-1) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | @ALLENNEET', 2820, 10),
      (23, 'YE3slV96QLg', 'Newton''s Laws of Motion — NCERT Decode (Part 2)', '➡️ Newton''s Laws of Motion (Part-2) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | ALLEN', 2361, 6),
      (24, 'VOvpwTf1Clo', 'Newton''s Laws of Motion — NCERT Decode (Part 1)', '➡️ Newton''s Laws of Motion (Part-1) | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | ALLEN', 2100, 6),
      (25, '264s9iiMAc0', 'Electrostatics Potential — NCERT Decode', '➡️ Electrostatics Potential | Important for NEET 2024 Exam 📚 | Physics NCERT Decode | ALLEN', 3106, 8),
      (26, 'vajbiwGm2nE', 'Electrostatics Fields — NCERT Decode', 'NCERT Decode Series | Electrostatics Fields | Physics | Easy way to Crack NEET 2024 Exam  @ALLENNEET', 2690, 8),
      (27, '4KfRSpsEAso', 'Electrostatics Forces — NCERT Decode', 'NCERT Decode Series | Electrostatics Forces | Physics | Easy way to Crack NEET 2024 Exam  @ALLENNEET', 2485, 8),
      (28, 'Slg3XCzlrWE', 'Motion in a Plane — NCERT Decode', '📌NCERT Decode Series | Motion in a Plane | Physics | Easy way to Crack NEET 2024 Exam 📚 | @ALLENNEET', 2711, 1),
      (29, 'SEk3vePg7d0', 'Motion in a Straight Line — NCERT Decode', '📌NCERT Decode Series | Motion in a Straight Line | Physics | Important for NEET 2024 Exam @ALLENNEET', 2711, 1)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 1) then
      raise exception 'chapter % is not a Physics chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 2,
      1, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    -- Class levels follow the lesson's own chapter: display_order 1-16 is the
    -- Class 11 half of the Physics syllabus, 17+ the Class 12 half.
    for v_level in
      select cl.id from public.class_levels cl
      join public.chapters ch on ch.id = v_row.chapter_id
      where cl.slug = 'dropper'
         or (cl.slug = 'class-11' and ch.display_order <= 16)
         or (cl.slug = 'class-12' and ch.display_order >= 17)
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 29 then
    raise exception 'expected 29 lessons for "%", inserted %', 'Physics — NCERT Decode Series', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics — NCERT Decode Series';
  end if;
end $$;
