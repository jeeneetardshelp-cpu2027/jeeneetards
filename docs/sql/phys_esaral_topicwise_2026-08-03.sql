-- CREATE-ONLY import: eSaral Physics for JEE.
--
-- WHY: measured through the exam-goal filter students browse with, JEE Physics
-- had 15 chapters taught by a single institute -- almost the whole of
-- electricity, magnetism, optics and modern physics, all Competishun alone.
-- The Aakash NEET and ALLEN NEET Physics in the catalogue is NEET-tagged and
-- invisible to a JEE student, and ALLEN's JEE Physics closed the mechanics half
-- but not this one.
--
-- eSaral's Physics Topicwise Revision series is taught chapter by chapter, which
-- is what makes a clean mapping possible. These 63 lessons take the JEE view
-- from 17 to 28 of 33 chapters with two or more institutes, closing 11:
-- Electrostatics, Capacitance, Current Electricity, Moving Charges and
-- Magnetism, Magnetism and Matter, Electromagnetic Induction, Alternating
-- Current, Ray Optics, Dual Nature of Radiation and Matter, Atoms, and Modern
-- Physics.
--
-- Source     : eSaral — https://www.youtube.com/playlist?list=PLMjEg73ogUEJRcKsxQrnOZhPTcAvhE16J
-- Lessons    : 63    Chapters: 23
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API, all hosted on the one eSaral channel, none already present.
--
-- Modern Physics is split across three chapters here, so those lessons are
-- filed individually: Atoms -> Atoms, Photoelectric Effect -> Dual Nature,
-- Nuclei/Radioactivity/X-Rays -> Modern Physics. One PYQ drill was excluded --
-- it is practice, not a concept lesson.
--
-- Safe to re-run: aborts rather than duplicating.
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

  if exists (select 1 from public.playlists where title = 'Physics Topicwise Revision — eSaral') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics Topicwise Revision — eSaral';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'jWrN9xtl-M0', 'wYqayvoKSM0', '5Lc7fXr0tUQ', 'gYrs1Ac5K5A', 'Y7R3mtKSh3M', 'jja4WbwLKUA',
      'iNvHRQMtMAw', 'Eq8omHhBJPs', 'Q0uYq3aKRDA', 'z1oQjHNoOu4', '184WDL-OPqg', 'GQVaO7_X16Q',
      'eI3C4UO_0Cs', 'TTvikHg-Xng', 'ySuvxqvcZak', 'WCJbmk45v9c', 'mKQ-q1cdAF4', 'n_luXKV8jm0',
      'DCNNlKkxUFg', 'm2WjC4fw2t4', 'wI7HSuav2Mk', 'mbfvmvtMHRA', 'JXXNsck0SOY', 'EYxW-uiEp2Y',
      'Y0pC8P-7JoQ', 'W53xCsIVgS8', 'JCfuEdA2nrw', 'D6RxRlFujgo', 'SfcdURl_Pys', 'xk-IuQbOghI',
      'waXE2YyZ264', 'fUq4tCX64CE', 'h6NJbQgVr9c', 'Z8EDiCW0ZFk', 'G88th1uBuJ8', 'AS9C6BA89XQ',
      '7R8yo877hd4', 'Oibhvs3CuZA', '-0o3Ouhm0Xw', 'wozwu2GDXn8', 'd0T82coY-ZM', '6l4qSUsPlA0',
      'TXzFIvG7xCc', '8Kbj2IC2kso', 'W-F0d-hKm3Q', '9YR4-GHZYxU', 'tQaiVZtMZrQ', 'uf__PfNcN0E',
      '_NJfMB3qrkY', '0pJZaXoE5bA', 'RZzSdWaSHA4', 'AFzbMEJ1C2k', 'vBpl5bTaKJ0', 'nA0-7hMmwv8',
      '8rRen_L16bU', 'wqL004d2skk', 'af3vnagj4G0', 'q466o0z88_o', 'JAAuCrEpEIk', 'C9YscaOOAwY',
      'l2p6JvLM04I', 'tqUbrV7S8Rg', 'GU_fAEWtAms'
    ])
  ) then
    raise exception 'at least one of these 63 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics Topicwise Revision — eSaral', 'Physics Topicwise Revision — eSaral',
    'Chapter-by-chapter Physics revision for JEE, from the official eSaral channel.',
    null, v_channel_id, 1, 1, 'revision', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'jWrN9xtl-M0', 'Electrostatics (Part 1)', 'Electrostatics Revision PART 1- Physics Class 12, JEE, NEET', 884, 8),
      (2, 'wYqayvoKSM0', 'Electrostatics (Part 2)', 'Electrostatics Revision PART 2- Physics Class 12, JEE, NEET', 2176, 8),
      (3, '5Lc7fXr0tUQ', 'Electrostatics (Part 3)', 'Electrostatics Revision PART 3- Physics Class 12, JEE, NEET', 1707, 8),
      (4, 'gYrs1Ac5K5A', 'Electrostatics (Part 4)', 'Electrostatics Revision PART 4- Physics Class 12, JEE, NEET', 1432, 8),
      (5, 'Y7R3mtKSh3M', 'Electrostatics (Part 5)', 'Electrostatics Revision PART 5- Physics Class 12, JEE, NEET', 1564, 8),
      (6, 'jja4WbwLKUA', 'Electrostatics (Part 6)', 'Electrostatics Revision PART 6- Physics Class 12, JEE, NEET', 1767, 8),
      (7, 'iNvHRQMtMAw', 'Electrostatics (Part 7)', 'Electrostatics Revision PART 7- Physics Class 12, JEE, NEET', 1412, 8),
      (8, 'Eq8omHhBJPs', 'Electrostatics (Part 8)', 'Electrostatics Revision PART 8- Physics Class 12, JEE, NEET', 1592, 8),
      (9, 'Q0uYq3aKRDA', 'Current Electricity (Part 1)', 'Current Electricity Revision PART1- Physics Class 12, JEE, NEET', 1201, 10),
      (10, 'z1oQjHNoOu4', 'Current Electricity (Part 2)', 'Current Electricity Revision PART2- Physics Class 12, JEE, NEET', 1476, 10),
      (11, '184WDL-OPqg', 'Current Electricity (Part 3)', 'Current Electricity Revision PART3- Physics Class 12, JEE, NEET', 668, 10),
      (12, 'GQVaO7_X16Q', 'Current Electricity (Part 4)', 'Current Electricity Revision PART4- Physics Class 12, JEE, NEET', 869, 10),
      (13, 'eI3C4UO_0Cs', 'Current Electricity (Part 5)', 'Current Electricity Revision PART5- Physics Class 12, JEE, NEET', 1437, 10),
      (14, 'TTvikHg-Xng', 'Kinematics 1D (Part 1)', 'Kinematics 1D Revision PART1- Physics Class 11, JEE, NEET', 1143, 1),
      (15, 'ySuvxqvcZak', 'Kinematics 1D (Part 2)', 'Kinematics 1D Revision PART2- Physics Class 11, JEE, NEET', 1567, 1),
      (16, 'WCJbmk45v9c', 'Kinematics 1D (Part 3)', 'Kinematics 1D Revision PART3- Physics Class 11, JEE, NEET', 1391, 1),
      (17, 'mKQ-q1cdAF4', 'Kinematics 1D (Part 4)', 'Kinematics 1D Revision PART4- Physics Class 11, JEE, NEET', 788, 1),
      (18, 'n_luXKV8jm0', 'Kinematics 2D (Part 1)', 'Kinematics 2D Revision PART1- Physics Class 11, JEE, NEET', 1707, 1),
      (19, 'DCNNlKkxUFg', 'Kinematics 2D (Part 2)', 'Kinematics 2D Revision PART2- Physics Class 11, JEE, NEET', 1147, 1),
      (20, 'm2WjC4fw2t4', 'Kinematics 2D (Part 3)', 'Kinematics 2D Revision PART3- Physics Class 11, JEE, NEET', 1058, 1),
      (21, 'wI7HSuav2Mk', 'Capacitor (Part 1)', 'Capacitor Revision PART 1- Physics Class 12, JEE, NEET', 1609, 9),
      (22, 'mbfvmvtMHRA', 'Capacitor (Part 2)', 'Capacitor Revision PART2- Physics Class 12, JEE, NEET', 1348, 9),
      (23, 'JXXNsck0SOY', 'Capacitor (Part 3)', 'Capacitor Revision PART3- Physics Class 12, JEE, NEET', 1887, 9),
      (24, 'EYxW-uiEp2Y', 'Capacitor (Part 4)', 'Capacitor Revision PART4- Physics Class 12, JEE, NEET', 1196, 9),
      (25, 'Y0pC8P-7JoQ', 'Magnetic Effect of Current (Part 1)', 'Magnetic Effect of Current Revision PART1- Physics Class 12, JEE, NEET', 1335, 11),
      (26, 'W53xCsIVgS8', 'Magnetic Effect of Current (Part 2)', 'Magnetic Effect of Current Revision PART2- Physics Class 12, JEE, NEET', 1813, 11),
      (27, 'JCfuEdA2nrw', 'Magnetic Effect of Current - Class 12 Physics', 'Magnetic Effect of Current Revision PART 3- Class 12 Physics | JEE Mains & Advanced | NEET | eSaral', 1684, 11),
      (28, 'D6RxRlFujgo', 'Magnetic Effect of Current (Part 3)', 'Magnetic Effect of Current Revision PART4- Physics Class 12, JEE, NEET', 1345, 11),
      (29, 'SfcdURl_Pys', 'Magnetism and Matter (Part 1)', 'Magnetism and Matter Revision PART1- Physics Class 12, JEE, NEET', 2291, 12),
      (30, 'xk-IuQbOghI', 'Magnetism and Matter (Part 2)', 'Magnetism and Matter Revision PART2- Physics Class 12, JEE, NEET', 2477, 12),
      (31, 'waXE2YyZ264', 'Gravitation', 'Gravitation Revision- Physics Class 11, JEE, NEET', 2138, 81),
      (32, 'fUq4tCX64CE', 'Electromagnetic Induction', 'Electromagnetic Induction Revision- Physics Class 12, JEE, NEET', 2462, 13),
      (33, 'h6NJbQgVr9c', 'Alternating Current', 'Alternating Current Revision- Physics Class 12, JEE, NEET', 2032, 14),
      (34, 'Z8EDiCW0ZFk', 'Ray Optics- Reflection of Light', 'Ray Optics- Reflection of Light Revision- Physics Class 12, JEE, NEET', 1791, 20),
      (35, 'G88th1uBuJ8', 'Ray Optics- Refraction of Light', 'Ray Optics- Refraction of Light Revision- Physics Class 12, JEE, NEET', 2011, 20),
      (36, 'AS9C6BA89XQ', 'Ray Optics- Optical Instruments', 'Ray Optics- Optical Instruments Revision- Physics Class 12, JEE, NEET', 1113, 20),
      (37, '7R8yo877hd4', 'Simple Harmonic Motion (SHM)', 'Simple Harmonic Motion (SHM) Revision- Physics Class 11, JEE, NEET', 1865, 84),
      (38, 'Oibhvs3CuZA', 'Waves', 'Waves Revision- Physics Class 11, JEE, NEET', 2444, 84),
      (39, '-0o3Ouhm0Xw', 'Sound Waves', 'Sound Waves One Shot Revision |  Physics Class 11, JEE, NEET | Saransh Sir | eSaral', 2539, 84),
      (40, 'wozwu2GDXn8', 'Wave Optics', 'Wave Optics Revision- Physics Class 12, JEE, NEET', 3179, 16),
      (41, 'd0T82coY-ZM', 'Modern Physics-Atoms', 'Modern Physics-Atoms Revision- Physics Class 12, JEE, NEET', 3069, 19),
      (42, '6l4qSUsPlA0', 'Modern Physics-Photoelectric Effect', 'Modern Physics-Photoelectric Effect Revision- Physics Class 12, JEE, NEET', 1585, 18),
      (43, 'TXzFIvG7xCc', 'Modern Physics-Nuclei', 'Modern Physics-Nuclei Revision- Physics Class 12, JEE, NEET', 1542, 83),
      (44, '8Kbj2IC2kso', 'Modern Physics- Radioactivity', 'Modern Physics- Radioactivity Revision- Physics Class 12, JEE, NEET', 1932, 83),
      (45, 'W-F0d-hKm3Q', 'Modern Physics-X-Rays', 'Modern Physics-X-Rays Revision- Physics Class 12, JEE, NEET', 980, 83),
      (46, '9YR4-GHZYxU', 'Fluid : Fluid Statics', 'Fluid : Fluid Statics Revision- Physics Class 11, JEE, NEET', 1470, 26),
      (47, 'tQaiVZtMZrQ', 'Fluid : Fluid Dynamics', 'Fluid : Fluid Dynamics Revision- Physics Class 11, JEE, NEET', 882, 26),
      (48, 'uf__PfNcN0E', 'Fluid : Viscosity', 'Fluid : Viscosity Revision- Physics Class 11, JEE, NEET', 813, 26),
      (49, '_NJfMB3qrkY', 'Fluid: Surface Tension', 'Fluid: Surface Tension Revision by Saransh Sir | Physics Class 11, JEE, NEET Preparation - #eSaral', 1241, 26),
      (50, '0pJZaXoE5bA', 'Units and Dimensions', 'Units and Dimensions Revision - Physics Class 11, JEE, NEET', 1701, 28),
      (51, 'RZzSdWaSHA4', 'Vectors', 'Vectors Revision - Physics Class 11, JEE, NEET', 1353, 80),
      (52, 'AFzbMEJ1C2k', 'Error in Measurement', 'Error in Measurement Revision - Physics Class 11, JEE, NEET', 1291, 28),
      (53, 'vBpl5bTaKJ0', 'Error in Measurement: Significant Figures', 'Error in Measurement: Significant Figures Revision - Physics Class 11, JEE, NEET', 1005, 28),
      (54, 'nA0-7hMmwv8', 'Electromagnetic Waves', 'Electromagnetic Waves Revision - Physics Class 12, JEE, NEET', 1304, 15),
      (55, '8rRen_L16bU', 'Rotational Motion (Part 1)', 'Rotational Motion Revision PART 1 - Physics Class 11, JEE, NEET', 2377, 27),
      (56, 'wqL004d2skk', 'Rotational Motion (Part 2)', 'Rotational Motion Revision PART2- Physics Class 11, JEE, NEET', 2400, 27),
      (57, 'af3vnagj4G0', 'Rotational Motion (Part 3)', 'Rotational Motion Revision PART3- Physics Class 11, JEE, NEET', 1853, 27),
      (58, 'q466o0z88_o', 'Rotational Motion (Part 4)', 'Rotational Motion Revision PART4- Physics Class 11, JEE, NEET', 1905, 27),
      (59, 'JAAuCrEpEIk', 'Thermodynamics (Part 1)', 'Thermodynamics Revision By Saransh Sir | Class 11, JEE, NEET', 3011, 23),
      (60, 'C9YscaOOAwY', 'Thermodynamics (Part 2)', 'Thermodynamics Revision Part2- Physics Class 11, JEE, NEET by Saransh Gupta Sir', 2906, 23),
      (61, 'l2p6JvLM04I', 'Thermodynamics (Part 3)', 'Thermodynamics Revision Part3- Physics Class 11, JEE, NEET', 1141, 23),
      (62, 'tqUbrV7S8Rg', 'Newtons Law of Motion', 'Newtons Law of Motion One Shot Revision | Class 11 Physics | JEE, NEET', 2839, 6),
      (63, 'GU_fAEWtAms', 'Friction', 'Friction Revision - Physics Class 11, JEE, NEET | One Shot | #eSaral', 2028, 7)
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
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      1, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
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

  if v_inserted <> 63 then
    raise exception 'expected 63 lessons for "%", inserted %', 'Physics Topicwise Revision — eSaral', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physics Topicwise Revision — eSaral';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics Topicwise Revision — eSaral';
  end if;
end $$;
