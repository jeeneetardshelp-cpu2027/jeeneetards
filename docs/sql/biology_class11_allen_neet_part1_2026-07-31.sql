-- biology_class11_allen_neet_part1_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: ALLEN NEET (part 1 of 5).
-- 2 courses, 58 lessons. Every video ID/title/duration in this file
-- was independently re-verified against the live YouTube Data API (videos.list) after extraction
-- -- 100% match on channel, title, duration and embeddability, 0 flagged.
--
-- Run this file FIRST for ALLEN NEET -- it creates the channel row every other
-- part for this channel depends on.
--
-- Idempotent: channel insert is on-conflict-safe; video inserts are
-- on-conflict-safe (youtube_video_id unique); course (playlist) inserts are
-- plain inserts -- safe to re-run ONLY if the courses from this exact file
-- were never successfully created before (the self-verification step below
-- would catch a partial/duplicate re-run by course title).

begin;

insert into public.institutes_channels (name, youtube_channel_id)
values ('ALLEN NEET', 'UCySvBtI4jMLXp0BT9osvASw')
on conflict (youtube_channel_id) do nothing;

-- Course: NCERT Diagrams Masterclass (26 lessons, source playlist PLru9htpOg_gcr_etQN5hMo_q2ET-BZn9U)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('NCERT Diagrams Masterclass', NULL, v_channel_id, 4, 'revision', 'hinglish', 'beginner')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('UrVcnGGO19k', 'Biological Classification Part 1', 'Botany: Biological Classification (Part-1) | NEET NCERT Diagrams Masterclass | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2705, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'UrVcnGGO19k';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('OxBFK-NMnRk', 'Biological Classification Part 2', 'Botany: Biological Classification (Part-2) | NEET NCERT Diagrams Masterclass | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2545, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'OxBFK-NMnRk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JQid3nSLGhY', 'Plant Kingdom Part 1', 'Botany: PLANT KINGDOM Part-1 | NEET 2026 | NCERT Diagrams Masterclass | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 2796, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'JQid3nSLGhY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tA_oP2BP3aI', 'Animal Kingdom Part 1', 'Zoology: ANIMAL KINGDOM Part-1 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 2756, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'tA_oP2BP3aI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AHXWFMre32Q', 'Animal Kingdom Part 2', 'Zoology: ANIMAL KINGDOM Part-2 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 2981, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'AHXWFMre32Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wf8S_5zX9Ec', 'Morphology of Flowering Plants Part 1', 'Botany: MORPHOLOGY OF FLOWERING PLANTS Part-1 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 2781, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'wf8S_5zX9Ec';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IFN7dSfUZAA', 'Morphology of Flowering Plants Part 2', 'Botany: MORPHOLOGY OF FLOWERING PLANTS Part-2 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 2657, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'IFN7dSfUZAA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dMu4EkMhAaM', 'Structural Organisation in Animals Part 1', 'Zoology: STRUCTURAL ORGANISATION IN ANIMALS Part-1 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals'), 2, 2375, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'dMu4EkMhAaM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('5UJApSPOjjw', 'Structural Organisation in Animals Part 2', 'Zoology: STRUCTURAL ORGANISATION IN ANIMALS Part-2 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals'), 2, 2185, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', '5UJApSPOjjw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('lwlyuEPqD8c', 'Anatomy of Flowering Plants Part 1', 'Botany: ANATOMY OF FLOWERING PLANTS Part-1 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 2691, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'lwlyuEPqD8c';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pKH29kV0yNo', 'Anatomy of Flowering Plants Part 2', 'Botany: ANATOMY OF FLOWERING PLANTS Part-2 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 2650, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'pKH29kV0yNo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Q-GpUlmiXaM', 'Biomolecules Part 1', 'Botany: BIOMOLECULES Part-1 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 2585, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'Q-GpUlmiXaM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JerjJtXEjbQ', 'Biomolecules Part 2', 'Botany: BIOMOLECULES Part-2 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 2581, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'JerjJtXEjbQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('OLsHO5iiswM', 'Cell: The Unit of Life Part 1', 'Botany | CELL: THE UNIT OF LIFE Part-1 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 2550, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'OLsHO5iiswM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('0C0HPf8Ip3Q', 'Cell: The Unit of Life Part 2', 'Botany | CELL: THE UNIT OF LIFE Part-2 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 2670, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', '0C0HPf8Ip3Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KxXUvu7QCxY', 'Cell Cycle and Cell Division', 'Botany | CELL CYCLE & CELL DIVISION | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 2625, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'KxXUvu7QCxY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZR0DgxDxAr0', 'Breathing and Exchange of Gases', 'Zoology: BREATHING & EXCHANGE OF GASES | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 2916, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'ZR0DgxDxAr0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8QB5hN7eQsM', 'Body Fluids and Circulation', 'Zoology: BODY FLUIDS & CIRCULATION | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 2600, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '8QB5hN7eQsM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7yXVMS9unk8', 'Excretory Products and Their Elimination Part 1', 'Zoology: EXCRETORY PRODUCTS & THEIR ELIMINATION Part-1 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 2846, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', '7yXVMS9unk8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wcA-6GLe2t8', 'Locomotion and Movement', 'Zoology: LOCOMOTION & MOVEMENT | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 2775, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'wcA-6GLe2t8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Yt1hKXF_PXQ', 'Chemical Coordination and Integration', 'Zoology: CHEMICAL COORDINATION & INTEGRATION | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 2821, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'Yt1hKXF_PXQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('l5-AZOPFGvA', 'Photosynthesis in Higher Plants Part 1', 'Botany | Photosynthesis in Higher Plants (Part-1) | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 2685, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'l5-AZOPFGvA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4HzIYfoaYt4', 'Photosynthesis in Higher Plants Part 2', 'Botany | Photosynthesis in Higher Plants (Part-2) | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 2720, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', '4HzIYfoaYt4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('GETeooFF6yg', 'Respiration in Plants Part 1', 'Botany | RESPIRATION IN PLANTS Part-1 | NEET 2026 |  NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 2780, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'GETeooFF6yg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('9Gt6HCbOmeM', 'Respiration in Plants Part 2', 'Botany | RESPIRATION IN PLANTS Part-2 | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 2716, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', '9Gt6HCbOmeM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8NdG9TRdgDA', 'Plant Growth and Development', 'Botany | PLANT GROWTH AND DEVELOPMENT | NEET 2026 | NCERT Diagrams Masterclass', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development'), 2, 2751, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', '8NdG9TRdgDA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Ace NEET Biology with the ALLEN Free Bridge Course (32 lessons, source playlist PLru9htpOg_gd5Zyh6w6z_uSRsCsYhW3GZ)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Ace NEET Biology with the ALLEN Free Bridge Course', NULL, v_channel_id, 4, 'full-course', 'hinglish', 'beginner')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ObA4c6i1lG0', 'Animal Kingdom Part 4', 'Animal Kingdom Part-4 | Free Bridge Course for NEET 2025 Aspirants | Biology 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 2645, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'ObA4c6i1lG0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('27OVvzKSIMI', 'Animal Kingdom Part 3', 'Animal Kingdom Part-3 | Free Bridge Course for NEET 2025 Aspirants | Biology 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 2716, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '27OVvzKSIMI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JVNKI7I-WEE', 'Animal Kingdom Part 2', 'Animal Kingdom Part-2 | Free Bridge Course for NEET 2025 Aspirants | Biology 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 3090, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'JVNKI7I-WEE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zyV6lPwW3Lc', 'Animal Kingdom Part 1', 'Animal Kingdom | Free Bridge Course for NEET 2025 Aspirants | Biology 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 2221, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'zyV6lPwW3Lc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IIBoY2ZFzUg', 'Chemical Coordination and Integration Part 3', 'Chemical Coordination and Integration Part-3 | Biology - Free Bridge Course for NEET 2025 Aspirants', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 2301, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'IIBoY2ZFzUg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sCKqDnNFoFw', 'Chemical Coordination and Integration Part 2', 'Chemical Coordination and Integration Part-2 | Biology - Free Bridge Course for NEET 2025 Aspirants', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 2575, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'sCKqDnNFoFw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nAuFPLeVNgU', 'Chemical Coordination and Integration Part 1', 'Chemical Coordination and Integration | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 2675, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'nAuFPLeVNgU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('FBiHYtFUZBw', 'Neural Control and Coordination Part 2', 'Neural Control & Coordination Part-2 | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 2615, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'FBiHYtFUZBw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wygf61n5tCU', 'Neural Control and Coordination Part 1', 'Neural Control And Coordination | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 2125, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'wygf61n5tCU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DkhDjLleUcM', 'Locomotion and Movement Part 2', 'Locomotion and Movement Part-2 | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3600, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'DkhDjLleUcM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2hU7Da3gyfk', 'Locomotion and Movement Part 1', 'Locomotion and Movement | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3105, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', '2hU7Da3gyfk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dXO5Woj3jSA', 'Excretory Products and Their Elimination Part 2', 'Excretory Products and their Elimination Part-2 | Biology - Free Bridge Course for NEET 2025', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 3620, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'dXO5Woj3jSA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wiEH5OKYHiM', 'Excretory Products and Their Elimination Part 1', 'Excretory Products and their Elimination | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 3120, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'wiEH5OKYHiM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BdPv9wIJy_8', 'Body Fluids and Circulation Part 2', 'Body Fluids and Circulation (Part-2) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3206, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'BdPv9wIJy_8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('A8OhDFpiPBI', 'Body Fluids and Circulation Part 1', 'Body Fluids and Circulation (Part-1) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 2810, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'A8OhDFpiPBI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('t_UQ5pp81tE', 'Breathing and Exchange of Gases Part 2', 'Breathing and Exchange of Gases (Part-2) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 2831, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 't_UQ5pp81tE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('xbaSWxAA4P8', 'Breathing and Exchange of Gases Part 1', 'Breathing and Exchange of Gases (Part-1) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 3275, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'xbaSWxAA4P8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ctS8PgXDvBA', 'Photosynthesis in Higher Plants Part 3', 'Photosynthesis in Higher plants (Part-3) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 2500, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'ctS8PgXDvBA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wge64DhSCmU', 'Photosynthesis in Higher Plants Part 2', 'Photosynthesis in Higher plants (Part-2) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 2381, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'wge64DhSCmU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('irVeizDloWE', 'Photosynthesis in Higher Plants Part 1', 'Photosynthesis in Higher plants (Part-1) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 2671, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'irVeizDloWE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('FshxLcr0BT4', 'Cell Cycle and Cell Division Part 2', 'Cell Cycle and Cell Division (Part-2) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 2621, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'FshxLcr0BT4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qHUeajS7aYY', 'Cell Cycle and Cell Division Part 1', 'Cell Cycle and Cell Division (Part-1) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 2730, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'qHUeajS7aYY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('6WbTu-uurnU', 'Biomolecules Part 3', 'Biomolecules (Part-3) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 2590, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '6WbTu-uurnU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2MnwmvF90GY', 'Biomolecules Part 2', 'Biomolecules (Part-2) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 2730, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '2MnwmvF90GY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('VR1wo5BOyQA', 'Biomolecules Part 1', 'Biomolecules | Biology - Free Bridge Course for NEET 2025 Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 2736, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'VR1wo5BOyQA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Po0n8VluSiM', 'Plant Kingdom Part 3', 'Plant Kingdom (Part-3) | Biology - Free Bridge Course for NEET 2025 Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 3030, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'Po0n8VluSiM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fwxwjX65cgQ', 'Plant Kingdom Part 2', 'Plant Kingdom (Part-2) | Biology - Free Bridge Course for NEET Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 2631, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'fwxwjX65cgQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 27)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nV_pPbZXtRc', 'Plant Kingdom Part 1', 'Plant Kingdom | Biology - Free Bridge Course for NEET Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 3101, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'nV_pPbZXtRc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 28)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('elwZ-sO-2Ck', 'Biological Classification Part 4', 'Biological Classification Part-4 | Biology - Free Bridge Course for NEET Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2536, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'elwZ-sO-2Ck';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 29)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fzeKk6GSucI', 'Biological Classification Part 3', 'Biological Classification Part-3 | Biology - Free Bridge Course for NEET Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2861, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'fzeKk6GSucI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 30)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('9cOjbV4FBeg', 'Biological Classification Part 2', 'Biological Classification Part-2 | Biology - Free Bridge Course for NEET Aspirants 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2641, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', '9cOjbV4FBeg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 31)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tOei9lXr7oo', 'Biological Classification Part 1', 'Biological Classification | Biology - Free Bridge Course for NEET Aspirants 📚 @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2771, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'tOei9lXr7oo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 32)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  v_bad text;
  v_course_count int;
  v_lesson_count int;
  v_null_chapter_count int;
begin
  select string_agg(t.title, '; ') into v_bad
    from (values
      ('NCERT Diagrams Masterclass'),
      ('Ace NEET Biology with the ALLEN Free Bridge Course')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('NCERT Diagrams Masterclass', 'Ace NEET Biology with the ALLEN Free Bridge Course');
  if v_course_count <> 2 then
    raise exception 'expected exactly 2 courses for ALLEN NEET part 1, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('NCERT Diagrams Masterclass', 'Ace NEET Biology with the ALLEN Free Bridge Course');
  if v_lesson_count <> 58 then
    raise exception 'expected exactly 58 lessons across ALLEN NEET part 1, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('NCERT Diagrams Masterclass', 'Ace NEET Biology with the ALLEN Free Bridge Course')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in ALLEN NEET part 1 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('NCERT Diagrams Masterclass', 'Ace NEET Biology with the ALLEN Free Bridge Course')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'ALLEN NEET part 1: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: ALLEN NEET part 1 -- % courses, % lessons, all correctly chaptered and linked.', 2, 58;
end
$$;

commit;
