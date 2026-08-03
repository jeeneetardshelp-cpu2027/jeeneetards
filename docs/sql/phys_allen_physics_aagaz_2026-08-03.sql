-- CREATE-ONLY import: ALLEN NEET Physics.
--
-- WHY: Physics had 8 of 33 chapters taught by a single INSTITUTE, and the only
-- two coaching families already in the catalogue are Competishun (channels
-- 1/81/77) and Physics Wallah (5/89/76). ALLEN NEET is independent of both,
-- so these lessons are a genuine second opinion rather than the same institute
-- on a different channel.
--
-- Source     : https://www.youtube.com/playlist?list=PLru9htpOg_gdu2KTm-9x3I0POx4gcR8GF
-- Lessons    : 26
-- Chapters   : 18 (Basic Mathematics for Physics; Moving Charges and Magnetism; Magnetism and Matter; Current Electricity; Electromagnetic Induction; Alternating Current; Electromagnetic Waves; Ray Optics and Optical Instruments; Wave Optics; Dual Nature of Radiation and Matter; Modern Physics; Gravitation; Oscillations and Waves; Electrostatics; Thermal Properties of Matter; Units and Measurements; Capacitance; Kinematics)
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

  if exists (select 1 from public.playlists where title = 'Physics One Shot — Aagaz Series') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics One Shot — Aagaz Series';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      '8m_pvsnhWQA', 'MgYmoP1pmw4', 'dkFNfhlbx3A', '1FNm3M_QcO4', 'e5M-8X-cYNU', 'c_8I-fFJjtc',
      'i3X70Y1g78U', 'J4Ma09TrG7s', 'kK8jOqLKaI4', '9RQFbpuqbFI', 'yK9pRn36NlE', 'R_fV2VK3sIk',
      '3GqnvdMPzOg', 'j_9WmuiSurE', 'GyDRiN4Ifvg', '3__7e1Vkizk', '2TiShTXk2g0', 'h8ZlP-vNckE',
      'n3Tz9kWt7R8', '0THhVA8zV3g', 'CFqbfN6Cy8o', 'ZebQGdzzYqE', 'z8j1N-1-fag', 'hty_LUeFano',
      '2ZNZzjuHmFI', 'MDewEYF7n48'
    ])
  ) then
    raise exception 'at least one of these 26 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics One Shot — Aagaz Series', 'Physics One Shot — Aagaz Series', 'Full-chapter one-shot Physics lectures from the official ALLEN NEET Aagaz series.',
    null, v_channel_id, 2, 1, 'one-shot', 'hinglish', 'intermediate'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, '8m_pvsnhWQA', 'Basic Maths — One Shot', 'Basic Maths | One Shot for NEET 2026 | Physics by Aman Mathur Sir | ALLEN', 23269, 80),
      (2, 'MgYmoP1pmw4', 'Moving Charges & Magnetism — One Shot', 'Moving Charges & Magnetism NEET One Shot | Physics by Rahul Jain Sir | ALLEN NEET', 25117, 11),
      (3, 'dkFNfhlbx3A', 'Moving Charges & Magnetism — One Shot (Part 2)', 'Moving Charges & Magnetism NEET One Shot (Part-2) | Physics by Rahul Jain Sir | ALLEN NEET', 25316, 11),
      (4, '1FNm3M_QcO4', 'Magnetism & Matter — One Shot', 'Magnetism & Matter One Shot by Rahul Jain Sir | NEET 2026 Physics 🧲 @ALLENNEET', 21122, 12),
      (5, 'e5M-8X-cYNU', 'Current Electricity — One Shot', 'Current Electricity One Shot for NEET 2026 | Complete Chapter in One Lecture | Rahul Jain Sir', 33606, 10),
      (6, 'c_8I-fFJjtc', 'Electromagnetic Induction — One Shot', 'Electromagnetic Induction One Shot for NEET 2026 | Most Scoring Chapter | Rahul Jain Sir', 28466, 13),
      (7, 'i3X70Y1g78U', 'Current Electricity — One Shot (Part 2)', 'Current Electricity One Shot (Part 2) for NEET 2026 | Complete Chapter | Rahul Jain Sir', 19820, 10),
      (8, 'J4Ma09TrG7s', 'Alternating Current — One Shot', 'Alternating Current One Shot for NEET 2026 | Most Scoring Chapter in Physics | Rahul Jain Sir', 29335, 14),
      (9, 'kK8jOqLKaI4', 'Electromagnetic Waves — One Shot', 'Electromagnetic Waves One Shot for NEET 2026 | EM Waves NEET/ Class 12 One Shot  | Rahul Jain Sir', 16996, 15),
      (10, '9RQFbpuqbFI', 'Ray Optics — One Shot (Part 1)', 'Ray Optics One Shot Part-1 | NEET 2026 Physics | Aman Mathur Sir', 23989, 20),
      (11, 'yK9pRn36NlE', 'Ray Optics — One Shot (Part 2)', 'Ray Optics One Shot Part-2 | Prism In Detail | NEET 2026 Physics | Aman Mathur Sir', 26378, 20),
      (12, 'R_fV2VK3sIk', 'Wave Optics — One Shot', 'Wave Optics Full Chapter in One Shot | NEET 2026 Physics by Aman Mathur Sir', 30991, 16),
      (13, '3GqnvdMPzOg', 'Dual Nature of Radiation and Matter — One Shot', 'Dual Nature of Radiation and Matter | One Shot for NEET 2026 | Physics by Aman Mathur Sir', 16918, 18),
      (14, 'j_9WmuiSurE', 'Modern Physics — One Shot (Part 2)', 'Modern Physics Part-2 | One Shot for NEET 2026 | Physics by Aman Mathur Sir', 22408, 83),
      (15, 'GyDRiN4Ifvg', 'Gravitation — One Shot', 'Gravitation Complete One Shot 🔥 NEET 2026 | Physics by Aman Mathur Sir', 27605, 81),
      (16, '3__7e1Vkizk', 'Simple Harmonic Motion — One Shot', 'Simple Harmonic Motion for NEET 2026 | SHM Full Chapter in One Shot by Aman Mathur Sir', 25956, 84),
      (17, '2TiShTXk2g0', 'Wave Motion — One Shot', 'Wave Motion | String Wave | Sound Wave | Standing Wave 1 Shot | NEET 2026 Physics | Aman Mathur Sir', 31886, 84),
      (18, 'h8ZlP-vNckE', 'Electric Field & Charges — One Shot', 'Electric Field & Charges One Shot | NEET 2026 Physics | Rahul Jain Sir', 40766, 8),
      (19, 'n3Tz9kWt7R8', 'Thermal Properties of Matter — One Shot', 'Thermal Properties of Matter 🔥 One Shot | NEET 2026 Physics | Aman Mathur Sir', 31524, 25),
      (20, '0THhVA8zV3g', 'Vectors — One Shot', 'Vectors One Shot for NEET 2026 🔥 | Complete Physics Chapter by Aman Mathur Sir', 18958, 80),
      (21, 'CFqbfN6Cy8o', 'Units & Dimensions + Error Measurement - Vernier Calliper & Screw Gauge — One Shot', 'NEET 2026 Physics: Units & Dimensions + Error Measurement - Vernier Calliper & Screw Gauge | 1 Shot', 22083, 28),
      (22, 'ZebQGdzzYqE', 'Electric Potential & Capacitance — One Shot', 'NEET 2026 Physics 🔥 Electric Potential & Capacitance One Shot | Rahul Jain Sir', 41417, 9),
      (23, 'z8j1N-1-fag', 'Kinematics Motion in a Straight Line — One Shot', 'Kinematics Full Chapter 🔥 Motion in a Straight Line | NEET 2026 Physics', 17141, 1),
      (24, 'hty_LUeFano', 'Kinematics Motion Under Gravity and Graph — One Shot', 'Kinematics 🔥 Motion Under Gravity and Graph | Motion in a Straight Line | NEET 2026 Physics', 15375, 1),
      (25, '2ZNZzjuHmFI', 'Kinematics Motion in a Plane — One Shot', 'Kinematics  🔥 Motion in a Plane One Shot | NEET 2026 Physics | Aman Mathur Sir', 19788, 1),
      (26, 'MDewEYF7n48', 'Capacitance — Dielectric — One Shot', 'Capacitance - One Shot ! Dielectric One Shot | NEET 2026 Physics Rahul Jain Sir', 10371, 9)
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

  if v_inserted <> 26 then
    raise exception 'expected 26 lessons for "%", inserted %', 'Physics One Shot — Aagaz Series', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics One Shot — Aagaz Series';
  end if;
end $$;
