-- catalogue_depth_2026-07-30.sql
--
-- Adds real, network-verified courses from two genuinely under-represented
-- channels, researched and verified against the live YouTube Data API
-- (channel identity, embeddability, real lecture ordering) and cross-checked
-- against production for zero accidental overlap before generation:
--
--  * JEE Wallah (Physics Wallah's JEE-specific brand, @pw-jeewallah,
--    youtube_channel_id UCVJU_IChPMOe8RWkdVQjtfQ) — NOT previously in the
--    catalogue. Its "RAFTAAR" series is a clean, complete, per-chapter
--    Class 11 Physics course set: 15 courses, 94 lessons, a genuinely
--    different teacher from the site's dominant "ABJ Sir" content.
--  * Competishun+ (channel_id 81, already in the catalogue) — 17 new PYQ
--    lectures + 48 new Chemistry lectures across 4 courses (Atomic
--    Structure, Chemical Bonding, Coordination Compounds, Mole Concept).
--    This channel is the SAME teaching operation as the site's existing
--    "Mohit Tyagi" content (confirmed via the videos' own description
--    cross-links), so it does not add teacher diversity, but the content
--    itself is real and new.
--  * 43 new Irodov (Mechanics) problems, 1.28-1.70, APPENDED to the
--    EXISTING course 13 "Kinematics| Irodov solutions" rather than
--    creating a duplicate course — problems 1.1-1.27 already exist there.
--
-- DATA-INTEGRITY FIXES applied during research (see docs/sql or the
-- session record for detail): four Competishun+ Chemistry playlists were
-- returned NEWEST-LECTURE-FIRST by the YouTube API (L-8, L-7, ... L-1) —
-- importing at face value would have played every course backward; two
-- JEE Wallah chapters (Thermodynamics, Thermal Properties of Matter) were
-- also returned out of sequence. Every lesson below is ordered by its own
-- embedded lecture number, never by raw API order. One exact duplicate
-- video (Irodov problem 1.55, uploaded twice) was deduplicated; one PYQ
-- video with no verifiable topic in title, description or tags was
-- excluded rather than guessed.
--
-- Titles were drafted from source per-lesson, adversarially reviewed
-- (verified corrections applied: 9), then mechanically re-validated
-- against src/titleQuality.js rules and within-course collisions here.
--
-- Idempotent: every insert is on-conflict-safe; safe to re-run.
-- Self-verifying: aborts the whole transaction unless the final state
-- matches exactly what this file intends.

begin;

-- ---------------------------------------------------------------------
-- 1. CHANNEL — JEE Wallah is new to the catalogue.
-- ---------------------------------------------------------------------
insert into public.institutes_channels (name, youtube_channel_id)
values ('JEE Wallah', 'UCVJU_IChPMOe8RWkdVQjtfQ')
on conflict (youtube_channel_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. JEE WALLAH — 15 new Class 11 Physics courses (RAFTAAR series)
-- ---------------------------------------------------------------------

-- ---- JEE Wallah: Oscillations (5 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Oscillations — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('jz3fOlcdfo4', 'Periodic & Simple Harmonic Motion', 'Oscillations 01 - Periodic | Simple Harmonic Motion | Class 11/JEE | RAFTAAR', v_channel_id, 1, 84, 5453, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ue8D3n3aG6U', 'Velocity, Acceleration & Energy of SHM', 'Oscillations 02 - Velocity & Acceleration | Energy of S.H.M | Class 11/JEE || RAFTAAR', v_channel_id, 1, 84, 6536, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Kseh7NdSLZo', 'SHM as a Projection of Uniform Circular Motion', 'Oscillations 03 -  SHM as a Projection of Uniform Circular Motion | Class 11/JEE | RAFTAAR', v_channel_id, 1, 84, 6665, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ll9PWk0TfCw', 'Simple Pendulum & Compound Pendulum', 'Oscillations 04 - Simple Pendulum | Compound pendulum | Class 11/JEE | RAFTAAR', v_channel_id, 1, 84, 6164, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('iQFVBs9JDP8', 'Spring-Connected Blocks & Damped Oscillations', 'Oscillations 05 - 2 Block connected with Spring | Damped Oscillations | Class 11/JEE - RAFTAAR', v_channel_id, 1, 84, 3699, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Kinetic Theory of Gases (1 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Kinetic Theory of Gases — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Sby5zGJ_Dnw', 'Equation of Pressure & Degree of Freedom', 'Kinetic Theory of Gases 01 - Equation of Pressure | Degree of Freedom | Class 11/JEE', v_channel_id, 1, 23, 8168, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Thermodynamics (4 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Thermodynamics — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('7eN_tddYVls', 'First Law of Thermodynamics', 'Thermodynamics 01 - First Law Of Thermodynamics | Class 11/JEE | RAFTAAR', v_channel_id, 1, 23, 8515, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ypuN1dcuDf8', 'Isothermal & Adiabatic Processes', 'Thermodynamics 02 - Isothermal process l Adiabatic process | Class 11/JEE || RAFTAAR', v_channel_id, 1, 23, 5316, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Jb4HOclS1ko', 'Cyclic Process & Second Law', 'Thermodynamics 03 - Cyclic Process l 2nd Law | Class 11/JEE | RAFTAAR', v_channel_id, 1, 23, 6848, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('x9HasmhEFS4', 'Refrigerator & Entropy', 'Thermodynamics 04 - Refrigerator l Entropy | Class 11/JEE | RAFTAAR', v_channel_id, 1, 23, 3428, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Thermal Properties Of Matter (4 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Thermal Properties Of Matter — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DMnpn8WbgiM', 'Calorimetry', 'Thermal Properties of Matter 01 | Caloriemetry | Class 11/JEE', v_channel_id, 1, 25, 6604, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('U8J-18rmMjk', 'Calorimetry (Part 2)', 'Thermal Properties of Matter 02 | Caloriemetry | Class 11/JEE - RAFTAAR', v_channel_id, 1, 25, 6199, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('HA1Fwzp12ZI', 'Heat Transfer: Conduction & Convection', 'Thermal Properties of Matter 03 - Heat Transfer | Conduction | Convection | Class 11/JEE', v_channel_id, 1, 25, 7526, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('p9724By7OFg', 'Radiation', 'Thermal properties of matter 04 - Radiation | Class 11/JEE', v_channel_id, 1, 25, 8177, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Mechanical Properties Of Fluids (5 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Mechanical Properties Of Fluids — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('LbZuEc_oZDU', 'Variation of Pressure with Depth', 'Mechanical Properties of Fluids 01 | Variation Of Pressure With Depth | Class 11/JEE', v_channel_id, 1, 26, 4380, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('x_59j7wB_70', 'Pressure Variation in an Accelerated Container', 'Mechanical Properties of Fluids 02  | Pressure Variation in Accelerated Containe | Class 11/JEE', v_channel_id, 1, 26, 6650, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('_lENFM6z3kY', 'Equation of Continuity & Bernoulli''s Theorem', 'Mechanical Properties of Fluids 03 | Equation Of Continuity | Bernoulli''s Theorem | Class 11/JEE', v_channel_id, 1, 26, 6878, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('dQIvzIFROLM', 'Surface Tension', 'Mechanical Properties of Fluids 04 | Surface Tension | Class 11/JEE', v_channel_id, 1, 26, 8786, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('2v_7gI_6eBQ', 'Viscosity', 'Mechanical Properties of Fluids 05  | Viscosity | Class 11/JEE', v_channel_id, 1, 26, 4817, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Mechanical Properties Of Solids (2 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Mechanical Properties Of Solids — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('osBznypB0bY', 'Stress, Strain & Modulus of Elasticity', 'Mechanical Properties of Solids 01 | Stress | Strain | Modulus of Elasticity | Class 11/JEE', v_channel_id, 1, 24, 3769, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('oMl2MALp0iw', 'Stress-Strain Curve & Elastic Potential Energy', 'Mechanical Properties of Solids 02 | Stress-Strain Curve | Elastic Potential Energy | Class 11/JEE', v_channel_id, 1, 24, 5861, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Gravitation (6 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Gravitation — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('J0TuC1TVjm8', 'Newton''s Law of Gravitation & Superposition Principle', 'Gravitation 01 | Newton''s Law of Gravitation | Superposition Principle | Class 11/JEE | RAFTAAR', v_channel_id, 1, 81, 4208, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('91I2GGkPstY', 'Gravitational Field & Its Variation Due to Earth', 'Gravitation 02 | Gravitational Field | Variational in Gravitational Field Due to Earth | Class 11', v_channel_id, 1, 81, 7728, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('qaJa2p-Djpo', 'Earth''s Gravitational Field', 'Gravitation 03 | Earth''s Gravitational Field | Class 11/JEE | RAFTAAR', v_channel_id, 1, 81, 7645, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('RxXXBKDtIlg', 'Gravitational Potential', 'Gravitation 04 | Gravitational Potential | Class 11/JEE | RAFTAAR', v_channel_id, 1, 81, 4654, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('PEwCpYtP0C8', 'Gravitational Potential Energy', 'Gravitation 05 | Gravitational Potential Energy | Class 11/JEE | RAFTAAR', v_channel_id, 1, 81, 7387, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KAuUeaA6dpw', 'Kepler''s Laws', 'Gravitation 06 | Kepler''s Law | Class 11/JEE | RAFTAAR', v_channel_id, 1, 81, 6414, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: System of Particles (8 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('System of Particles — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('_Tw3OabH6Qw', 'Moment of Inertia', 'System of Particles 01 | Moment of Intertia | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 5995, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('u7-JV-7CyIA', 'Parallel & Perpendicular Axis Theorem', 'System of Particles 02 | Parallel & Perpendicular Axis Theorem | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 3878, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('AntzMbyXgZQ', 'Torque & Rotational Equilibrium', 'System of Particles 03 | Torque | Rotational Equilibrium | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 7021, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('WEx_Kv2kO2k', 'Rotation about a Fixed Axis & Angular Momentum', 'System of Particles 04 | Rotation about Fixed Axis | Angular Momentum | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 5184, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('P-a5NxPLcN0', 'Angular Momentum Conservation', 'System of Particles 05 | Angular Momentum Conservation | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 5141, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('x99JCP_7pOI', 'Combined Translational & Rotational Motion', 'System of Particles 06 || Combined Translation Rotational Motion || Class 11/JEE || RAFTAAR', v_channel_id, 1, 22, 8778, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('GngSA4Upr2g', 'Combined Translational & Rotational Motion (Part 2)', 'System of Particles 07 | Combined Translation Rotational Motion (Part-2) | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 9084, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('XvmQsSt0ZRE', 'Angular Momentum for CTRM & Toppling', 'System of Particles 08 | Angular Momentum for CTRM | Toppling | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 7757, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Center Of Mass (10 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Center Of Mass — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('La3b2JU1uzY', 'Calculation of Center of Mass', 'Center of Mass 01 | Calculation of Center of Mass | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5094, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('BrkgTX2wU3k', 'COM for Rigid Bodies', 'Center of Mass 02 | COM for Rigid Bodies | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5908, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('02v_HPu_D8U', 'Cavity Problems', 'Center of Mass 03 | Cavity Problems | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5928, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('fD6G0Zqn-L4', 'Momentum Conservation', 'Center of Mass 04 | Momentum Conservation | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 4571, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('C5kh9R3Y2xk', 'Spring-Mass System', 'Center of Mass 05 | Spring Mass System | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5945, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('uyYpLPSjVoQ', 'Impulse', 'Center of Mass 06 | Impulse | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5015, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('iqQFkXnqIH8', 'Impulse-Momentum Theorem', 'Center of Mass 07 | Impulse Momentum Theorem | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 22, 5038, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('P1CU6NVHCNQ', 'Collision', 'Center of Mass 08 | Collision | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 5852, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ruw36UrfXn0', 'Variable Mass System', 'Center of Mass 09 | Variable Mass System | Class 11/JEE | RAFTAAR', v_channel_id, 1, 22, 6544, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('hmHwq2Crsk4', 'Live Practice Session: Center of Mass & Rotational Motion', 'Live Practice Session - Center of Mass & Rotational Motion || Class 11/JEE || RAFTAAR', v_channel_id, 1, 22, 8186, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Circular Motion (6 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Circular Motion — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Vzxuhd94G54', 'Introduction', 'Circular Motion 01 | Introduction | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 5847, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('iVdwa0B0_MM', 'Relative Average Velocity & Radial-Tangential Acceleration', 'Circular Motion 02 | Relative Avg. Velocity | Radial & Tangential Acceleration | Class 11/JEE', v_channel_id, 1, 1, 6817, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('M-MyIfm-0dY', 'Circular Motion in a Horizontal Plane', 'Circular Motion 03 | Circular Motion in Horizontal Plane | Class 11/JEE', v_channel_id, 1, 1, 5199, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KtUZC5t7m7A', 'Radius of Curvature & Angle of Banking', 'Circular Motion 04 | Radius of Curvature Angle of Banking | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 1, 4719, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('lFTtCNE9pPs', 'Vertical Circular Motion', 'Circular Motion 05 | Vertical Circular Motion | Class 11 JEE/ RAFTAAR', v_channel_id, 1, 1, 5876, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Z2J5R5k6WyE', 'Live Practice Session: Laws of Motion, Work-Energy-Power & Circular Motion', 'Live Practice Session - Laws of Motion || Work, Power & Energy || Circular Motion || Class 11/JEE', v_channel_id, 1, 1, 7485, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Work, Energy And Power (7 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Work, Energy And Power — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('9BGKVIF0C-c', 'Calculation of Work', 'Work, Energy and Power 01 | Calculation of Work | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 4403, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('P2eLwT6zr4Y', 'Calculation of Work (Part 2)', 'Work, Energy and Power 02 | Calculation of Work | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 6215, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('0FHVcFv5mV0', 'Work-Energy Theorem', 'Work, Energy and Power 03 | Work Energy Theorem | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 5689, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('00hltGoN3Yw', 'Mechanical Energy Conservation', 'Work, Energy and Power 04 | Mechanical Energy Conservation | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 5337, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('FdQhelnlOqA', 'Relation between Force & Potential Energy', 'Work, Energy and Power 05 | Relation Between Force & Potential Energy | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 5074, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('3_jLXEW8pcI', 'Power', 'Work, Energy and Power 06 | Power | Class 11/JEE | RAFTAAR', v_channel_id, 1, 21, 4714, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Z2J5R5k6WyE', 'Live Practice Session: Laws of Motion, Work-Energy-Power & Circular Motion', 'Live Practice Session - Laws of Motion || Work, Power & Energy || Circular Motion || Class 11/JEE', v_channel_id, 1, 21, 7485, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Laws Of Motion (11 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Laws Of Motion — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('B5XcXCjW600', 'Introduction to Newton''s Laws & Free Body Diagram', 'Laws of Motion 01 | Introduction to 1st,2nd & 3rd Law | Free Body Diagram | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 4120, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZVUd0YQjwOE', 'Free Body Diagram & Equilibrium', 'Laws of Motion 02 | Free Body Diagram | Equilibrium | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 6803, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('9EB_CLTZf5s', 'Equilibrium', 'Laws of Motion 03 | Equilibrium | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 3434, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('W5iC7EnyMEo', 'Accelerated Motion & Constraint Motion', 'Laws of Motion 04 | Accelerated Motion | Constraint Motion | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 6593, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DucLqv5u8sw', 'Constraint Motion', 'Laws of Motion 05 | Constraint Motion | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 5320, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('UYgWh4QenCg', 'Wedge Constraint & NLM on a System', 'Laws of Motion 06 | Wedge Constraint | NLM on System | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 6442, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('GUgPa3DAMNw', 'Spring Force, Weighing Machine & Pseudo Force', 'Laws of Motion 07 | Spring Force | Weighing Machine | Pseudo Force | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 5769, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('3mCP_jx8U8Y', 'Pseudo Force & Friction', 'Laws of Motion 08 | Pseudo Force | Friction | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 6203, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZxTk9mN3XnM', 'Friction', 'Laws of Motion 09 | Friction | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 4547, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('1wrmPJA20n4', 'Two-Block Problem', 'Laws of Motion 10 | 2 Block Problem | Class 11/JEE | RAFTAAR', v_channel_id, 1, 6, 5076, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Z2J5R5k6WyE', 'Live Practice Session: Laws of Motion, Work-Energy-Power & Circular Motion', 'Live Practice Session - Laws of Motion || Work, Power & Energy || Circular Motion || Class 11/JEE', v_channel_id, 1, 6, 7485, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Motion In A Plane (11 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Motion In A Plane — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('FaeSwOvos_I', 'Ground-to-Ground Projectile & Equation of Trajectory', 'Motion in a Plane 01 | Ground to Ground Projectile | Equation of Trajectory | Class 11/JEE', v_channel_id, 1, 1, 6022, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('R81b6LjArJ8', 'Equation of Trajectory', 'Motion in a Plane 02 | Equation of Trajectory | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 6003, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Tn6OcqQ_FuI', 'Projectile from a Height', 'Motion in a Plane 03 | Projectile from H Height | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 5391, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('-fedxIyOe68', 'Projectile from an Inclined Plane', 'Motion in a Plane 04 | Projectile from Inclined Plane | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 3270, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('fmigO_uFO1s', 'Projectile from an Inclined Plane (Part 2)', 'Motion in a Plane 05 | Projectile from Inclined Plane | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 7064, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('W4TtB50Safo', 'Introduction to Relative Motion', 'Motion in a Plane 06 || Relative Motion Introduction || Class 11/JEE || RAFTAAR', v_channel_id, 1, 1, 3834, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('yxHdInR7TmQ', 'Relative Motion in 1-D', 'Motion in a Plane 07 | Relative Motion in 1-D | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 4818, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('dOt0R7ZDlw4', 'River Problems & Rain Problems', 'Motion in a Plane 08 | River Problems | Rain Problems | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 5315, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('oEe7ioicUeg', 'Wind Problems & Rain Problems', 'Motion in a Plane 09 | Wind Problems | Rain Problems | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 5901, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('-eWhQTF7kpE', 'Velocity of Approach & Separation in 2-D', 'Motion in a Plane 10 | Velocity of Approach | Separation in 2-D | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 6352, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DU4VBcclGwA', 'Live Practice Session: Relative & Projectile Motion', 'Live Practice Session - Motion in a Plane 11 | Relative & Projectile Motion | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 4336, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Motion In A Straight Line (6 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Motion In A Straight Line — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('PLyRVhRz3Ic', 'Distance & Displacement', 'Motion in a straight Line 01 || Distance & Displacement || Class 11/JEE || RAFTAAR', v_channel_id, 1, 1, 4054, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ti8dsqROXEI', 'Average & Instantaneous Velocity, Speed & Acceleration', 'Motion in a straight Line 02 || Average & Inst Velocity, Speed & Acceleration  || Class 11/JEE', v_channel_id, 1, 1, 6008, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('NUAzpa50zzM', 'Average & Instantaneous Acceleration, Uniformly Accelerated Motion', 'Motion in a straight Line 03 | Average & Inst Acceleration | Uniformly Accelerated Motion | Class 11', v_channel_id, 1, 1, 6154, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZIngU_KIZIs', 'Uniformly Accelerated Motion & Motion under Gravity', 'Motion in a straight Line 04 | Uniformly Accelerated Motion | Motion Under Gravity | Class 11/JEE', v_channel_id, 1, 1, 6390, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('M5Q4KwyPEzg', 'Graph-Related Questions', 'Motion in a straight Line 05 | Graph Related Questions | Class 11/JEE | RAFTAAR', v_channel_id, 1, 1, 6789, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('S8pUcF4x-FQ', 'Acceleration-Time Curve & Variable Acceleration', 'Motion in a straight Line 06 | Acceleration Time Curve | Variable Acceleration  | Class 11/JEE', v_channel_id, 1, 1, 6495, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- JEE Wallah: Mathematical Tools (8 lessons) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Mathematical Tools — RAFTAAR', null, v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('gHz4Q6y6M-g', 'Mathematical Tools', 'Let''s Start Our Journey with RAFTAAR 🚀 || Mathematical Tools 01', v_channel_id, 1, 80, 5937, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('itbCqpGNusA', 'Introduction to Differentiation', 'Mathematical Tools 02 || Introduction to Differentiation || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 5926, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KCnyHzvdkrY', 'Chain Rule, Double Differentiation & AOD', 'Mathematical Tools 03 || Chain Rule || Double Differentiation || AOD || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 6169, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('MyHWFs9FiEc', 'AOD & Introduction to Integration', 'Mathematical Tools 04 || AOD || Introduction to Integration || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 5744, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('fUQ2-GGNYig', 'Integration', 'Mathematical Tools 05 || Integration || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 5489, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('MmnyF07EM70', 'Introduction to Vectors & Vector Addition', 'Mathematical Tools 06 || Introduction to Vectors || Vector Addition || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 5564, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('7nJECGfb5SY', 'Polygon Law, Position Vector & Vector Components', 'Mathematical Tools 07 || Polygon Law || Position Vector || Component of Vector || Class 11/JEE', v_channel_id, 1, 80, 5884, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('tDjjqLyUbeY', 'Product of Vectors', 'Mathematical Tools 08 || Product of Vector || Class 11/JEE || RAFTAAR', v_channel_id, 1, 80, 5849, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---------------------------------------------------------------------
-- 3. COMPETISHUN+ — 1 new Physics PYQ course (17 lessons across chapters)
-- ---------------------------------------------------------------------

-- ---- Competishun+: new JEE Advanced Physics PYQs (17 lessons, spans multiple chapters) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('JEE Advanced Physics PYQs — Additional Topics', 'ABJ Sir', v_channel_id, 1, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('EqNB_3OiNLA', 'SHM PYQ Decoded — Elastic Collision + COM Frame Trick', 'JEE Advanced SHM PYQ Decoded | Elastic Collision + COM Frame Trick', v_channel_id, 1, 84, 1569, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('eNvH2SLz18I', 'Gravitation PYQ', 'This Gravitation PYQ Builds Real JEE Advanced Thinking', v_channel_id, 1, 81, 449, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('6Htbr9Fof7o', 'Gravitation PYQ 2017 — Escape Velocity in Sun-Earth System', 'JEE Advanced Gravitation PYQ 2017 | Escape Velocity in Sun-Earth System', v_channel_id, 1, 81, 373, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('-zEuCflRW3g', 'Gravitation PYQ 2025', 'This EASY Question Can Boost Your Rank 😳 | JEE Advanced 2025 Gravitation PYQ', v_channel_id, 1, 81, 386, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('MmXXm6-QC1U', 'KTG + Spring in 1 Shot — Thermodynamics PYQ 2025', 'KTG + Spring in 1 Shot | JEE Advanced 2025 Thermodynamics PYQ', v_channel_id, 1, 23, 377, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Y-78jb7ta5E', 'Fluid Mechanics PYQ 2024 — Tank Emptying Concept Explained', 'JEE Advanced 2024 Fluid Mechanics PYQ | Tank Emptying Concept Explained', v_channel_id, 1, 26, 1305, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('iMLGJLkw-Uc', 'Fluid Mechanics Comprehension 2021 — Buoyancy + Thermodynamics', 'JEE Advanced 2021 Fluid Mechanics Comprehension | Buoyancy + Thermodynamics Explained', v_channel_id, 1, 26, 879, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('X8UHxwQeVA0', 'PYQ 2022 — Fluid Mechanics + KTG + Thermodynamics Multi-Correct', 'JEE Advanced PYQ 2022 | Fluid Mechanics + KTG + Thermodynamics | Multi Correct Question Explained', v_channel_id, 1, 26, 1982, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('sk0AndvKmfE', 'Nuclear Physics PYQs — Part 2', 'JEE Advanced Physics PYQs🔥 | Nuclear Physics | Must Watch for Every Adv Aspirant | Part-2', v_channel_id, 1, 83, 5099, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('t0W23jE9epM', 'Nuclear Physics PYQs', 'JEE Advanced Physics PYQs🔥 | Nuclear Physics | Must Watch for Every Adv Aspirant', v_channel_id, 1, 83, 4631, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('cpeSiV0FR7s', 'X-Ray PYQs — Modern Physics', 'JEE Advanced Physics PYQs🔥| X Ray | Modern Physics| IIT | IIT advanced', v_channel_id, 1, 83, 928, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DTLM17doWFM', 'Sound Wave PYQs (2006-2024)', '13- JEE Advanced Physics PYQs🔥 Sound Wave (2024 -2006) Must attend for Every JEE ADV Aspirant', v_channel_id, 1, 84, 7226, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('PRmuj5qkTdg', 'Wave on String PYQs (2006-2024)', '12- JEE Advanced Physics PYQs🔥 WAVE ON STRING (2024-2006) | Must attend for Every JEE ADV Aspirant', v_channel_id, 1, 84, 3318, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('VaZYr1WQ7Vs', 'Circular Motion PYQs (2006-2023)', '8- JEE Advanced Physics PYQs🔥| Circular Motion 2006 - 2023 | Must watch for every Advanced aspirant!', v_channel_id, 1, 1, 2810, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('-6muQNvDRtw', 'Units and Dimensions PYQs (2006-2023)', '68- JEE Advanced Physics PYQs🔥| Unit and Dimension 2006 - 2023 | Must watch for every Adv aspirant!', v_channel_id, 1, 28, 4358, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('3UTLFFvHkOM', 'Geometrical Optics PYQs (2017-2023)', '67-JEE Advanced Physics PYQs | Geometrical Optics 2017 to 2023 | Must Attend For Every Adv Aspirants', v_channel_id, 1, 20, 6547, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('isaAs6sKdsw', 'Geometrical Optics PYQs (2004-2023)', '66- Geometrical Optics JEE Advanced Previous Year Questions PYQ (2004-2023)', v_channel_id, 1, 20, 8336, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---------------------------------------------------------------------
-- 4. COMPETISHUN+ — 4 new Chemistry courses (48 lessons)
-- ---------------------------------------------------------------------

-- ---- Competishun+: Atomic Structure (15 lessons, Class 11th) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Atomic Structure | Class XI Chemistry', 'Competishun+', v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DprbgFqOeZ0', 'Atomic Structure — Part 1', 'Atomic Structure L-1 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4950, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('b9m0QQ8s8cg', 'Atomic Structure — Part 2', 'Atomic Structure L-2 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4744, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('BQ20Aijqg7Q', 'Atomic Structure — Part 3', 'Atomic Structure L-3 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 5155, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('oiO1cMtgcqA', 'Atomic Structure — Part 4', 'Atomic Structure L-4 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4620, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('a_zixa-4EEM', 'Atomic Structure — Part 5', 'Atomic Structure L-5 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4641, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('otPdJS1wLdo', 'Atomic Structure — Part 6', 'Atomic Structure L-6 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4696, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KIHyatnPOhQ', 'Atomic Structure — Part 7', 'Atomic Structure L-7 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4570, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('69mZ07rAIFs', 'Atomic Structure — Part 8', 'Atomic Structure L-8 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 5007, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('vftUMKNC5y0', 'Atomic Structure — Part 9', 'Atomic Structure L-9 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4403, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('zGrCKFTFKbw', 'Atomic Structure — Part 10', 'Atomic Structure L-10 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4548, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('4Mu8fmbkV5M', 'Atomic Structure — Part 11', 'Atomic Structure L-11 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 5066, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('L5EcKxRgNT4', 'Atomic Structure — Part 12', 'Atomic Structure L-12 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4336, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('0Gn83ItDJsM', 'Atomic Structure — Part 13', 'Atomic Structure L-13 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 4710, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('1IPFiylW8n0', 'Atomic Structure — Part 14', 'Atomic Structure L-14 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 6065, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('9hb_R6SHodQ', 'Atomic Structure — Part 15', 'Atomic Structure L-15 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 37, 5179, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- Competishun+: Chemical Bonding (14 lessons, Class 11th) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Chemical Bonding | Class XI Chemistry', 'Competishun+', v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('A2o4cF7Semc', 'Chemical Bonding — Part 1', 'Chemical Bonding_L-1 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5038, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('1BNE7x2tX0U', 'Chemical Bonding — Part 2', 'Chemical Bonding_L-2 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5527, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Z7o7pYOk524', 'Chemical Bonding — Part 3', 'Chemical Bonding_L-3 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 4503, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZCrRrhWZwUY', 'Chemical Bonding — Part 4', 'Chemical Bonding_L-4 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 4817, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('kuq5JCsxwhI', 'Chemical Bonding — Part 5', 'Chemical Bonding_L-5 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5064, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('vhkMIgKS9xQ', 'Chemical Bonding — Part 6', 'Chemical Bonding_L-6 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5144, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('7AmMY6xWFi4', 'Chemical Bonding — Part 7', 'Chemical Bonding_L-7 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5149, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('8byJqldNEec', 'Chemical Bonding — Part 8', 'Chemical Bonding_L-8 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5138, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('iGAYjBimesw', 'Chemical Bonding — Part 9', 'Chemical Bonding_L-9 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 4935, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('y8xKvKHJh6Y', 'Chemical Bonding — Part 10', 'Chemical Bonding_L-10 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5235, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('c6zCbmf7Ebk', 'Chemical Bonding — Part 11', 'Chemical Bonding_L-11 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5414, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('FEGjpYmvjtA', 'Chemical Bonding — Part 12', 'Chemical Bonding_L-12 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 4541, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('0abgU_7hJUg', 'Chemical Bonding — Part 13', 'Chemical Bonding_L-13 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 5405, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('MqA9xkI_6W0', 'Chemical Bonding — Part 14', 'Chemical Bonding_L-14 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 86, 4782, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- Competishun+: Coordination Compounds (11 lessons, Class 12th) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Coordination Compounds | Class XII Chemistry', 'Competishun+', v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-12';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('qTrZbCr7NNY', 'Coordination Compound — Part 1', 'Coordination Compound_L-1 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4746, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('8CJXPGLjJWI', 'Coordination Compound — Part 2', 'Coordination Compound_L-2 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4530, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('r9_bsVLoPk0', 'Coordination Compound — Part 3', 'Coordination Compound_L-3 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4990, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('0tIfueuvt0U', 'Coordination Compound — Part 4', 'Coordination Compound_L-4 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4648, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('N0s3WBydDVc', 'Coordination Compound — Part 5', 'Coordination Compound_L-5 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 5008, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('4UGgD6FYSqM', 'Coordination Compound — Part 6', 'Coordination Compound_L-6 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4774, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('sHYTOY_Tki0', 'Coordination Compound — Part 7', 'Coordination Compound_L-7 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4890, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('1b-hiLN11ZE', 'Coordination Compound — Part 8', 'Coordination Compound_L-8 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 5266, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('eIMW5EODowM', 'Coordination Compound — Part 9', 'Coordination Compound_L-9 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4675, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('LVxKYanCVM0', 'Coordination Compound — Part 10', 'Coordination Compound_L-10 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4513, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('1OB_HmjZC2I', 'Coordination Compound — Part 11', 'Coordination Compound_L-11 | IIT JEE Chemistry Class 12 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 87, 4432, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---- Competishun+: Mole Concept (8 lessons, Class 11th) ----
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then raise exception 'channel % not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Mole Concept | Class XI Chemistry', 'Competishun+', v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('m5c6WofUqus', 'Mole Concept — Part 1', 'Mole Concept_L-1 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4506, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('bPcwEnYvqHQ', 'Mole Concept — Part 2', 'Mole Concept_L-2 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4291, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('IEQPvBhgIRk', 'Mole Concept — Part 3', 'Mole Concept_L-3 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4914, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('uoU2c3Oujx0', 'Mole Concept — Part 4', 'Mole Concept_L-4 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4471, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('W7qZ8aO6Em4', 'Mole Concept — Part 5', 'Mole Concept_L-5 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4292, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('5HDRgdEwZaI', 'Mole Concept — Part 6', 'Mole Concept_L-6 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4996, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('ssM-qIPHelM', 'Mole Concept — Part 7', 'Mole Concept_L-7 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 4769, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('aFNe7-Ti6TU', 'Mole Concept — Part 8', 'Mole Concept_L-8 | IIT JEE Chemistry Class 11 | Complete Chapter for JEE Main & Advanced', v_channel_id, 2, 54, 5273, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---------------------------------------------------------------------
-- 5. IRODOV EXTENSION — 43 new problems (1.28-1.70) appended to the
--    EXISTING course 13 "Kinematics| Irodov solutions", not a new course.
--    Position continues from whatever the course's real current max
--    position is, read live rather than assumed.
-- ---------------------------------------------------------------------
do $$
declare
  v_channel_id bigint;
  v_video_id bigint;
  v_next_position int;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select coalesce(max(position), 0) + 1 into v_next_position
    from public.playlist_videos where playlist_id = 13;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('2hkXa9BXtcY', 'Irodov Q.1.28', 'Irodov Solutions (Mechanics) Problem 1.28 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 344, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 0)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KhtZF3P9wIo', 'Irodov Q.1.29', 'Irodov Solutions (Mechanics) Problem 1.29 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 840, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('QoNW4NVDXCM', 'Irodov Q.1.30', 'Irodov Solutions (Mechanics) Problem 1.30 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 561, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('kLex_R5HOM4', 'Irodov Q.1.31', 'Irodov Solutions (Mechanics) Problem 1.31 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 368, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('JctkPBWBHJc', 'Irodov Q.1.32', 'Irodov Solutions (Mechanics) Problem 1.32 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 230, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Z32duMMJ-Js', 'Irodov Q.1.33', 'Irodov Solutions (Mechanics) Problem 1.33 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 384, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('XyUtlmSyVSM', 'Irodov Q.1.34', 'Irodov Solutions (Mechanics) Problem 1.34 | #jeeadvanced  #jeemains', v_channel_id, 1, 1, 432, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('9G7RxbYp1Vw', 'Irodov Q.1.35', 'Irodov Solutions (Mechanics) Problem 1.35 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 265, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('tFWiewSua-s', 'Irodov Q.1.36', 'Irodov Solutions (Mechanics) Problem 1.36 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 242, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('4bJLNVLNlD8', 'Irodov Q.1.37', 'Irodov Solutions (Mechanics) Problem 1.37 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 289, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('8YN3DHTkYX4', 'Irodov Q.1.38', 'Irodov Solutions (Mechanics) Problem 1.38 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 372, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('jhjQYRfZGEY', 'Irodov Q.1.39', 'Irodov Solutions (Mechanics) Problem 1.39 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 217, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('cr45xBA9MrA', 'Irodov Q.1.40', 'Irodov Solutions (Mechanics) Problem 1.40 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 635, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('NYY--H0pl2s', 'Irodov Q.1.41', 'Irodov Solutions (Mechanics) Problem 1.41 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 344, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('c58PMWMZZvc', 'Irodov Q.1.42', 'Irodov Solutions (Mechanics) Problem 1.42 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 408, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('abOU_4QWDFU', 'Irodov Q.1.43', 'Irodov Solutions (Mechanics) Problem 1.43 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 251, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('kA1FF4KIsiU', 'Irodov Q.1.44', 'Irodov Solutions (Mechanics) Problem 1.44 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 287, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('wGW3tFyL9Tg', 'Irodov Q.1.45', 'Irodov Solutions (Mechanics) Problem 1.45 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 336, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('QC7GRcId_HM', 'Irodov Q.1.46', 'Irodov Solutions (Mechanics) Problem 1.46 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 323, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('RkdJxS9habE', 'Irodov Q.1.47', 'Irodov Solutions (Mechanics) Problem 1.47 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 353, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('bQ1mUY86Hak', 'Irodov Q.1.48', 'Irodov Solutions (Mechanics) Problem 1.48 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 263, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('kjjJSLdTGAg', 'Irodov Q.1.49', 'Irodov Solutions (Mechanics) Problem 1.49 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 217, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('yYK-RE8Fw8A', 'Irodov Q.1.50', 'Irodov Solutions (Mechanics) Problem 1.50 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 245, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('aYDD7teQ9dE', 'Irodov Q.1.51', 'Irodov Solutions (Mechanics) Problem 1.51 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 610, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('HaWZgpVnGWc', 'Irodov Q.1.52', 'Irodov Solutions (Mechanics) Problem 1.52 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 807, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('HRQmvQ4IVx8', 'Irodov Q.1.53', 'Irodov Solutions (Mechanics) Problem 1.53 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 672, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('kcUMErkgyIo', 'Irodov Q.1.54', 'Irodov Solutions (Mechanics) Problem 1.54 | #jeeadvanced #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 358, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('qTs05vhcQmI', 'Irodov Q.1.55', 'Irodov Solutions (Mechanics) Problem 1.55 | #jeeadvanced #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 485, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 27)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('O2n8wpeR_lU', 'Irodov Q.1.56', 'Irodov Solutions (Mechanics) Problem 1.56 | #jeeadvanced  #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 225, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 28)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('IGDvBl1od6s', 'Irodov Q.1.57', 'Irodov Solutions (Mechanics) Problem 1.57 | #jeeadvanced #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 697, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 29)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('d7Yr1-gTquw', 'Irodov Q.1.58', 'Irodov Solutions (Mechanics) Problem 1.58 | #jeeadvanced  #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 455, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 30)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Pn2vYkjNRAA', 'Irodov Q.1.59', 'Irodov Solutions (Mechanics) Problem 1.59 | #jeeadvanced #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 215, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 31)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('KPkgZh6PU8Q', 'Irodov Q.1.60', 'Irodov Solutions (Mechanics) Problem 1.60 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 450, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 32)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('77g8R8S1ej8', 'Irodov Q.1.61', 'Irodov Solutions (Mechanics) Problem 1.61 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 560, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 33)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('unxPQhNta50', 'Irodov Q.1.62', 'Irodov Solutions (Mechanics) Problem 1.62 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 521, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 34)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('M47Z3YWZkFk', 'Irodov Q.1.63', 'Irodov Solutions (Mechanics) Problem 1.63 | #jeeadvanced  #jeemains #physics #irodovsolutions', v_channel_id, 1, 1, 522, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 35)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('Zy3kHGXBgHI', 'Irodov Q.1.64', 'Irodov Solutions (Mechanics) Problem 1.64 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 284, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 36)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('7ldNS0Z_JRc', 'Irodov Q.1.65', 'Irodov Solutions (Mechanics) Problem 1.65 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 833, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 37)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('p0fT_4nHkq8', 'Irodov Q.1.66', 'Irodov Solutions (Mechanics) Problem 1.66 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 440, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 38)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('8kkqF7lTHZU', 'Irodov Q.1.67', 'Irodov Solutions (Mechanics) Problem 1.67 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 290, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 39)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('DOY8WWj9MDU', 'Irodov Q.1.68', 'Irodov Solutions (Mechanics) Problem 1.68 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 420, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 40)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('p6b1tJq6V18', 'Irodov Q.1.69', 'Irodov Solutions (Mechanics) Problem 1.69 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 264, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 41)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at)
  values ('B42N9wz5rRM', 'Irodov Q.1.70', 'Irodov Solutions (Mechanics) Problem 1.70 | #jeeadvanced  #jeemains #physics', v_channel_id, 1, 1, 365, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  insert into public.playlist_videos (playlist_id, video_id, position) values (13, v_video_id, v_next_position + 42)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

end $$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION — aborts the entire transaction (rolling back every
-- insert above) unless the final state matches exactly what this file
-- intends. A half-applied catalogue import is worse than an unapplied one.
-- ---------------------------------------------------------------------
do $$
declare
  v_new_courses int;
  v_new_course_lessons int;
  v_course13_total int;
  v_course13_max_pos int;
  v_course13_gaps int;
  v_jee_wallah_channel bigint;
  v_bad text;
begin
  select id into v_jee_wallah_channel from public.institutes_channels
   where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_jee_wallah_channel is null then
    raise exception 'JEE Wallah channel was not created';
  end if;

  -- Every one of the 20 intended new courses must exist, by exact title.
  select string_agg(t.title, '; ') into v_bad
    from (values
      ('Oscillations — RAFTAAR'),
      ('Kinetic Theory of Gases — RAFTAAR'),
      ('Thermodynamics — RAFTAAR'),
      ('Thermal Properties Of Matter — RAFTAAR'),
      ('Mechanical Properties Of Fluids — RAFTAAR'),
      ('Mechanical Properties Of Solids — RAFTAAR'),
      ('Gravitation — RAFTAAR'),
      ('System of Particles — RAFTAAR'),
      ('Center Of Mass — RAFTAAR'),
      ('Circular Motion — RAFTAAR'),
      ('Work, Energy And Power — RAFTAAR'),
      ('Laws Of Motion — RAFTAAR'),
      ('Motion In A Plane — RAFTAAR'),
      ('Motion In A Straight Line — RAFTAAR'),
      ('Mathematical Tools — RAFTAAR'),
      ('JEE Advanced Physics PYQs — Additional Topics'),
      ('Atomic Structure | Class XI Chemistry'),
      ('Chemical Bonding | Class XI Chemistry'),
      ('Coordination Compounds | Class XII Chemistry'),
      ('Mole Concept | Class XI Chemistry')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected new course(s) missing: %', v_bad;
  end if;

  select count(*) into v_new_courses from public.playlists
   where title in (
      'Oscillations — RAFTAAR', 'Kinetic Theory of Gases — RAFTAAR', 'Thermodynamics — RAFTAAR',
      'Thermal Properties Of Matter — RAFTAAR', 'Mechanical Properties Of Fluids — RAFTAAR',
      'Mechanical Properties Of Solids — RAFTAAR', 'Gravitation — RAFTAAR', 'System of Particles — RAFTAAR',
      'Center Of Mass — RAFTAAR', 'Circular Motion — RAFTAAR', 'Work, Energy And Power — RAFTAAR',
      'Laws Of Motion — RAFTAAR', 'Motion In A Plane — RAFTAAR', 'Motion In A Straight Line — RAFTAAR',
      'Mathematical Tools — RAFTAAR', 'JEE Advanced Physics PYQs — Additional Topics',
      'Atomic Structure | Class XI Chemistry', 'Chemical Bonding | Class XI Chemistry',
      'Coordination Compounds | Class XII Chemistry', 'Mole Concept | Class XI Chemistry'
    );
  if v_new_courses <> 20 then
    raise exception 'expected exactly 20 new courses, found %', v_new_courses;
  end if;

  select count(*) into v_new_course_lessons
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in (
      'Oscillations — RAFTAAR', 'Kinetic Theory of Gases — RAFTAAR', 'Thermodynamics — RAFTAAR',
      'Thermal Properties Of Matter — RAFTAAR', 'Mechanical Properties Of Fluids — RAFTAAR',
      'Mechanical Properties Of Solids — RAFTAAR', 'Gravitation — RAFTAAR', 'System of Particles — RAFTAAR',
      'Center Of Mass — RAFTAAR', 'Circular Motion — RAFTAAR', 'Work, Energy And Power — RAFTAAR',
      'Laws Of Motion — RAFTAAR', 'Motion In A Plane — RAFTAAR', 'Motion In A Straight Line — RAFTAAR',
      'Mathematical Tools — RAFTAAR', 'JEE Advanced Physics PYQs — Additional Topics',
      'Atomic Structure | Class XI Chemistry', 'Chemical Bonding | Class XI Chemistry',
      'Coordination Compounds | Class XII Chemistry', 'Mole Concept | Class XI Chemistry'
    );
  if v_new_course_lessons <> 159 then
    raise exception 'expected 159 lessons across the new courses, found %', v_new_course_lessons;
  end if;

  -- Every new course must carry BOTH a learning-goal and a class-level link
  -- (rule: a course with neither is invisible to Explore's guided cascade).
  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in (
      'Oscillations — RAFTAAR', 'Kinetic Theory of Gases — RAFTAAR', 'Thermodynamics — RAFTAAR',
      'Thermal Properties Of Matter — RAFTAAR', 'Mechanical Properties Of Fluids — RAFTAAR',
      'Mechanical Properties Of Solids — RAFTAAR', 'Gravitation — RAFTAAR', 'System of Particles — RAFTAAR',
      'Center Of Mass — RAFTAAR', 'Circular Motion — RAFTAAR', 'Work, Energy And Power — RAFTAAR',
      'Laws Of Motion — RAFTAAR', 'Motion In A Plane — RAFTAAR', 'Motion In A Straight Line — RAFTAAR',
      'Mathematical Tools — RAFTAAR', 'JEE Advanced Physics PYQs — Additional Topics',
      'Atomic Structure | Class XI Chemistry', 'Chemical Bonding | Class XI Chemistry',
      'Coordination Compounds | Class XII Chemistry', 'Mole Concept | Class XI Chemistry'
    )
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'new course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  -- Course 13 (Kinematics| Irodov solutions) must now have exactly
  -- 24 (original) + 43 (appended) = 67 lessons, positions 1..67 with no
  -- gaps and no duplicates -- a broken position sequence would silently
  -- reorder the whole course on the watch page.
  select count(*), max(position) into v_course13_total, v_course13_max_pos
    from public.playlist_videos where playlist_id = 13;
  if v_course13_total <> 67 then
    raise exception 'course 13 should have exactly 67 lessons (24 original + 43 new), found %', v_course13_total;
  end if;
  select count(*) into v_course13_gaps
    from generate_series(1, v_course13_max_pos) gs(pos)
   where not exists (
     select 1 from public.playlist_videos pv where pv.playlist_id = 13 and pv.position = gs.pos
   );
  if v_course13_max_pos <> 67 or v_course13_gaps <> 0 then
    raise exception 'course 13 position sequence is broken: max_position=%, gaps=%', v_course13_max_pos, v_course13_gaps;
  end if;

  -- No lesson anywhere in this batch may reference a chapter_id that does
  -- not exist.
  if exists (
    select 1 from public.videos v
     where v.id in (
       select video_id from public.playlist_videos pv
        where pv.playlist_id in (
          select id from public.playlists where title in (
            'Oscillations — RAFTAAR', 'Kinetic Theory of Gases — RAFTAAR', 'Thermodynamics — RAFTAAR',
            'Thermal Properties Of Matter — RAFTAAR', 'Mechanical Properties Of Fluids — RAFTAAR',
            'Mechanical Properties Of Solids — RAFTAAR', 'Gravitation — RAFTAAR', 'System of Particles — RAFTAAR',
            'Center Of Mass — RAFTAAR', 'Circular Motion — RAFTAAR', 'Work, Energy And Power — RAFTAAR',
            'Laws Of Motion — RAFTAAR', 'Motion In A Plane — RAFTAAR', 'Motion In A Straight Line — RAFTAAR',
            'Mathematical Tools — RAFTAAR', 'JEE Advanced Physics PYQs — Additional Topics',
            'Atomic Structure | Class XI Chemistry', 'Chemical Bonding | Class XI Chemistry',
            'Coordination Compounds | Class XII Chemistry', 'Mole Concept | Class XI Chemistry'
          )
        ) or pv.playlist_id = 13
     )
       and v.chapter_id is not null
       and not exists (select 1 from public.chapters c where c.id = v.chapter_id)
  ) then
    raise exception 'a newly-inserted video references a chapter_id that does not exist';
  end if;

  raise notice 'SELF-TEST PASSED: % new courses, % new lessons, course 13 extended to % lessons (positions 1..%, no gaps).',
    v_new_courses, v_new_course_lessons, v_course13_total, v_course13_max_pos;
end
$$;

commit;
