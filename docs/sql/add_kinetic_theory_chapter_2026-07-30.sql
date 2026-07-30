-- add_kinetic_theory_chapter_2026-07-30.sql
--
-- Adds the "Kinetic Theory of Gases" chapter that was missing from the
-- Physics taxonomy, and brings back the 1 lesson dropped from
-- catalogue_depth_2026-07-30.sql for exactly that reason (it had no correct
-- chapter to belong to -- it was being mis-tagged under Thermodynamics's
-- chapter_id before that was caught and fixed).
--
-- Kinetic Theory is a real, standard NCERT/JEE Class 11 Physics chapter,
-- positioned right after Thermodynamics and before Oscillations and Waves
-- in the syllabus -- confirmed against the live 30-chapter Physics list
-- (display_order 1..30, contiguous, NCERT/coaching order). This inserts it
-- at display_order 15 (Thermodynamics is 14, Oscillations and Waves was 15)
-- and shifts every chapter from Oscillations and Waves onward up by one.
--
-- Idempotent: if the chapter already exists (by slug), the insert and the
-- display_order shift are both skipped -- re-running this is a safe no-op
-- on the taxonomy side. The video/playlist inserts are on-conflict-safe as
-- elsewhere in this repo. Self-verifying: aborts unless the final state
-- matches exactly what this file intends.

do $$
declare
  v_physics_subject_id bigint;
  v_channel_id bigint;
  v_chapter_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_thermo_order int;
begin
  select id into v_physics_subject_id from public.subjects where slug = 'physics';
  if v_physics_subject_id is null then raise exception 'physics subject not found'; end if;

  select id into v_chapter_id from public.chapters
   where subject_id = v_physics_subject_id and slug = 'kinetic-theory-of-gases';

  if v_chapter_id is null then
    select display_order into v_thermo_order from public.chapters
     where subject_id = v_physics_subject_id and slug = 'thermodynamics';
    if v_thermo_order is null then raise exception 'thermodynamics chapter not found -- cannot position Kinetic Theory of Gases'; end if;

    update public.chapters
       set display_order = display_order + 1
     where subject_id = v_physics_subject_id
       and display_order > v_thermo_order;

    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_physics_subject_id, 'Kinetic Theory of Gases', 'kinetic-theory-of-gases', v_thermo_order + 1)
    returning id into v_chapter_id;
  end if;

  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel not found'; end if;

  select id into v_playlist_id from public.playlists where title = 'Kinetic Theory of Gases — RAFTAAR';
  if v_playlist_id is null then
    insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
    values ('Kinetic Theory of Gases — RAFTAAR', null, v_channel_id, v_physics_subject_id, 'full-course', 'hinglish', 'advanced')
    returning id into v_playlist_id;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';

    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';
  end if;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Sby5zGJ_Dnw', 'Equation of Pressure & Degree of Freedom', 'Kinetic Theory of Gases 01 - Equation of Pressure | Degree of Freedom | Class 11/JEE', v_channel_id, v_physics_subject_id, v_chapter_id, 1, 8168, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now(), chapter_id = excluded.chapter_id
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  v_physics_subject_id bigint;
  v_chapter_count int;
  v_gap_count int;
  v_thermo_order int;
  v_ktg_order int;
  v_osc_order int;
  v_lesson_count int;
begin
  select id into v_physics_subject_id from public.subjects where slug = 'physics';

  select count(*) into v_chapter_count from public.chapters where subject_id = v_physics_subject_id;
  if v_chapter_count <> 31 then
    raise exception 'expected 31 physics chapters after adding Kinetic Theory of Gases, found %', v_chapter_count;
  end if;

  select count(*) into v_gap_count
    from generate_series(1, 31) gs(pos)
   where not exists (
     select 1 from public.chapters where subject_id = v_physics_subject_id and display_order = gs.pos
   );
  if v_gap_count <> 0 then
    raise exception 'physics chapter display_order sequence has % gap(s) after the shift', v_gap_count;
  end if;

  select display_order into v_thermo_order from public.chapters where subject_id = v_physics_subject_id and slug = 'thermodynamics';
  select display_order into v_ktg_order from public.chapters where subject_id = v_physics_subject_id and slug = 'kinetic-theory-of-gases';
  select display_order into v_osc_order from public.chapters where subject_id = v_physics_subject_id and slug = 'oscillations-and-waves';
  if v_ktg_order is distinct from v_thermo_order + 1 or v_osc_order is distinct from v_ktg_order + 1 then
    raise exception 'Kinetic Theory of Gases is not correctly positioned between Thermodynamics (order %) and Oscillations and Waves (order %) -- got order %',
      v_thermo_order, v_osc_order, v_ktg_order;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title = 'Kinetic Theory of Gases — RAFTAAR'
     and v.chapter_id = (select id from public.chapters where subject_id = v_physics_subject_id and slug = 'kinetic-theory-of-gases');
  if v_lesson_count <> 1 then
    raise exception 'expected exactly 1 correctly-tagged lesson in the Kinetic Theory of Gases course, found %', v_lesson_count;
  end if;

  if not exists (
    select 1 from public.playlists p
     where p.title = 'Kinetic Theory of Gases — RAFTAAR'
       and exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       and exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id)
  ) then
    raise exception 'Kinetic Theory of Gases course is missing a learning-goal or class-level link';
  end if;

  raise notice 'SELF-TEST PASSED: Kinetic Theory of Gases added as chapter %, 31 physics chapters total, course live with 1 correctly-tagged lesson.', v_ktg_order;
end
$$;
