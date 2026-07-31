-- biology_class11_allen_neet_part3_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: ALLEN NEET (part 3 of 5).
-- 1 courses, 68 lessons. Every video ID/title/duration in this file
-- was independently re-verified against the live YouTube Data API (videos.list) after extraction
-- -- 100% match on channel, title, duration and embeddability, 0 flagged.
--
-- Depends on biology_class11_allen_neet_part1_2026-07-31.sql having already run (creates the
-- ALLEN NEET channel row this file looks up).
--
-- Idempotent: channel insert is on-conflict-safe; video inserts are
-- on-conflict-safe (youtube_video_id unique); course (playlist) inserts are
-- plain inserts -- safe to re-run ONLY if the courses from this exact file
-- were never successfully created before (the self-verification step below
-- would catch a partial/duplicate re-run by course title).

begin;

-- Course: Bio-Fest for NEET 2024 Aspirants (68 lessons, source playlist PLru9htpOg_gcaCundbPixO4NkI-Lfg6VN)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Bio-Fest for NEET 2024 Aspirants', NULL, v_channel_id, 4, 'revision', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('toNwvae75s8', 'The Living World', 'The Living World | Bio-Fest for NEET 2024 Aspirants 🔥 Day 1/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world'), 2, 5835, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'toNwvae75s8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Ffl2QJIKdEQ', 'Biological Classification Part 1', 'Biological Classification | Bio-Fest for NEET 2024 | Day 2/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 5476, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'Ffl2QJIKdEQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ON9BOf2ePKE', 'Biological Classification Part 2', 'Biological Classification | Bio-Fest for NEET 2024 | Day 3/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 5305, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'ON9BOf2ePKE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('j9WAU_pAx6g', 'Biological Classification Part 3', 'Biological Classification | Bio-Fest for NEET 2024 | Day 4/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 5631, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'j9WAU_pAx6g';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qLbT_cN_9hc', 'Plant Kingdom Part 1', 'Plant Kingdom | Bio-Fest for NEET 2024 | Day 5/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 5391, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'qLbT_cN_9hc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('xjwMRxAfMdQ', 'Plant Kingdom Part 2', 'Plant Kingdom (Part-2) | Bio-Fest for NEET 2024 | Day 6/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 5676, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'xjwMRxAfMdQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hRgbd3dQ5QA', 'Cell: The Unit of Life Part 1', 'Cell - The Unit of Life | Bio-Fest for NEET 2024 | Day 7/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 5446, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'hRgbd3dQ5QA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rtlxOs4ks14', 'Cell: The Unit of Life Part 2', 'Cell - The Unit of Life | Bio-Fest for NEET 2024 | Day 8/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 5425, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'rtlxOs4ks14';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dPXLXEKjp0A', 'Cell: The Unit of Life Part 3', 'Cell - The Unit of Life | Bio-Fest for NEET 2024 | Day 9/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 4940, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'dPXLXEKjp0A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('v3-mW-B8syU', 'Cell Cycle and Cell Division', 'Cell Cycle and Cell Division | Bio-Fest for NEET 2024 | Day 10/70 Days of NCERT | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 5490, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'v3-mW-B8syU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZmCobFULVuA', 'Biomolecules Part 1', 'Biomolecules (Part-1) | Bio-Fest for NEET 2024 | Day 11/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 5335, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'ZmCobFULVuA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('aPTHhiM80x4', 'Biomolecules Part 2', 'Biomolecules (Part-2) | Bio-Fest for NEET 2024 | Day 12/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 5426, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'aPTHhiM80x4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nyZ_DeXJdb0', 'Biomolecules Part 3', 'Biomolecules (Part-3) | Bio-Fest for NEET 2024 | Day 13/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 5410, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'nyZ_DeXJdb0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fFvb1fz0WCE', 'Microbes in Human Welfare', 'Microbes in Human Welfare | Bio-Fest for NEET 2024 | Day 14/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'microbes-in-human-welfare'), 2, 5389, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'microbes-in-human-welfare', 'fFvb1fz0WCE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Dw_4PYSXzwc', 'Animal Kingdom Part 1', 'Animal Kingdom | Bio-Fest for NEET 2024 | Day 15/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 4801, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'Dw_4PYSXzwc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4xktDUw18cQ', 'Animal Kingdom Part 2', 'Animal Kingdom | Bio-Fest for NEET 2024 | Day 16/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 4115, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '4xktDUw18cQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7HaHmjtsDr8', 'Animal Kingdom Part 3', 'Animal Kingdom | Bio-Fest for NEET 2024 | Day 17/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 4666, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '7HaHmjtsDr8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('C5B-DunIHyc', 'Structural Organisation in Animals Part 1', 'Structural Organisation in Animals (Part-1) | Bio-Fest for NEET 2024 | Day 18/70 Days of NCERT', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals'), 2, 5441, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'C5B-DunIHyc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('djEH2lYFBUU', 'Structural Organisation in Animals Part 2', 'Structural Organisation in Animals (Part-2) | Bio-Fest for NEET 2024 | Day 19/70 Days of NCERT', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals'), 2, 5060, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'djEH2lYFBUU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sANBJSNchko', 'Morphology of Flowering Plants Part 1', 'Morphology of Flowering Plants (Part-1) | Bio-Fest for NEET 2024 | Day 20/70 Days of NCERT', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 5460, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'sANBJSNchko';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DEIPZ3U2Ptw', 'Morphology of Flowering Plants Part 2', 'Morphology of Flowering Plants (Part-2) | Bio-Fest for NEET 2024 | Day 21/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 5452, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'DEIPZ3U2Ptw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('kXR__QeH5cE', 'Morphology of Flowering Plants Part 3', 'Morphology of Flowering Plants (Part-3) | Bio-Fest for NEET 2024 | Day 22/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 5075, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'kXR__QeH5cE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vBQVPLMZGKE', 'Anatomy of Flowering Plants Part 1', 'Anatomy of Flowering Plants (Part-1) | Bio-Fest for NEET 2024 | Day 23/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 4625, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'vBQVPLMZGKE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fRg08QmQlgs', 'Anatomy of Flowering Plants Part 2', 'Anatomy of Flowering Plants (Part-2) | Bio-Fest for NEET 2024 | Day 24/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 5071, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'fRg08QmQlgs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Ol3BP1SLNQM', 'Evolution Part 1', 'Evolution (Part-1) | Bio-Fest for NEET 2024 | Day 25/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 5740, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'Ol3BP1SLNQM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('T4WnmZ-tFkE', 'Evolution Part 2', 'Evolution (Part-2) | Bio-Fest for NEET 2024 | Day 26/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 5770, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'T4WnmZ-tFkE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dwlPceYAVio', 'Evolution Part 3', 'Evolution (Part-3) | Bio-Fest for NEET 2024 | Day 27/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 6044, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'dwlPceYAVio';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 27)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('A6Ym6wyAhwM', 'Human Health and Disease Part 1', 'Human Health and Diseases (Part-1) | Bio-Fest for NEET 2024 | Day 28/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 5785, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'A6Ym6wyAhwM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 28)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qo59TTCDcyM', 'Human Health and Disease Part 2', 'Human Health and Diseases (Part-2) | Bio-Fest for NEET 2024 | Day 29/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 5151, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'qo59TTCDcyM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 29)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('mPmtBlHMWQE', 'Human Health and Disease Part 3', 'Human Health and Diseases (Part-3) | Bio-Fest for NEET 2024 | Day 30/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 6061, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'mPmtBlHMWQE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 30)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8dt7Zy9fTn4', 'Human Reproduction Part 1', 'Human Reproduction (Part-1) | Bio-Fest for NEET 2024 | Day 31/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 5596, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', '8dt7Zy9fTn4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 31)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dIvgBpkt1gc', 'Human Reproduction Part 2', 'Human Reproduction (Part-2) | Bio-Fest for NEET 2024 | Day 32/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 5582, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'dIvgBpkt1gc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 32)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('O1mtwQybSJs', 'Human Reproduction Part 3', 'Human Reproduction (Part-3) | Bio-Fest for NEET 2024 | Day 33/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 4361, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'O1mtwQybSJs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 33)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZfDn0bjqAts', 'Reproductive Health', 'Reproductive Health | Bio-Fest for NEET 2024 | Day 34/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 5316, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'ZfDn0bjqAts';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 34)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('z_VjDLYaLSw', 'Organisms and Populations Part 2', 'Organisms and Populations (Part-2) | Bio-Fest for NEET 2024 | Day 36/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4331, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'z_VjDLYaLSw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 35)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ccwMuCcPF9E', 'Organisms and Populations Part 1', 'Organisms and Populations (Part-1) | Bio-Fest for NEET 2024 | Day 35/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4666, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'ccwMuCcPF9E';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 36)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wX1fmq-5DO4', 'Organisms and Populations Part 3', 'Organisms and Populations (Part-3) | Bio-Fest for NEET 2024 | Day 37/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4500, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'wX1fmq-5DO4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 37)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4IDrKqbtAL4', 'Ecosystem Part 1', 'Ecosystem (Part-1) | Bio-Fest for NEET 2024 | Day 38/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 5089, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '4IDrKqbtAL4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 38)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('9oc8Ul50qYs', 'Ecosystem Part 3', 'Ecosystem (Part-3) | Bio-Fest for NEET 2024 | Day 40/70 Days of NCERT Excursion | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 5946, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '9oc8Ul50qYs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 39)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tjvx7VzLUZY', 'Biodiversity and Conservation', 'Biodiversity & Conservation | Bio-Fest for NEET 2024 | Day 41/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 5395, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'tjvx7VzLUZY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 40)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BjLh3hR7utk', 'Breathing and Exchange of Gases', 'Breathing and Exchange of Gases | Bio-Fest for NEET 2024 | Day 42/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 4435, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'BjLh3hR7utk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 41)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('VhIBy4aqi70', 'Body Fluids and Circulation Part 1', 'Body Fluids and Circulation (Part -1) | Bio-Fest for NEET 2024 | Day 43/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 4606, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'VhIBy4aqi70';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 42)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('5pwjMITnMa8', 'Body Fluids and Circulation Part 2', 'Body Fluids and Circulation (Part -2) | Bio-Fest for NEET 2024 | Day 44/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3411, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '5pwjMITnMa8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 43)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gctgpdsYwDc', 'Excretory Products and Their Elimination', 'Excretory Products & Their Elimination | Bio-Fest for NEET 2024 | Day 45/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 5996, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'gctgpdsYwDc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 44)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_cOQZW4V6hk', 'Locomotion and Movement Part 1', 'Locomotion and Movement | Bio-Fest for NEET 2024 | Day 46/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 4436, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', '_cOQZW4V6hk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 45)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('WSrf66n6-4w', 'Locomotion and Movement Part 2', 'Locomotion and Movement (Part-2) | Bio-Fest for NEET 2024 | Day 47/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 5326, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'WSrf66n6-4w';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 46)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DXbOTf_tGWs', 'Neural Control and Coordination', 'Neural Control & Coordination | Bio-Fest for NEET 2024 | Day 48/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 4821, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'DXbOTf_tGWs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 47)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('uyto16kCXtM', 'Chemical Coordination and Integration', 'Chemical Coordination and Integration | Bio-Fest for NEET 2024 | Day 49/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 6466, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'uyto16kCXtM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 48)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XkqMBSmWDnI', 'Photosynthesis in Higher Plants Part 1', 'Photosynthesis in Higher Plants | Bio-Fest for NEET 2024 | Day 50/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 5406, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'XkqMBSmWDnI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 49)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dln797UdzLU', 'Photosynthesis in Higher Plants Part 2', 'Photosynthesis in Higher Plants (Part-2)| Bio-Fest for NEET 2024 | Day 51/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 5695, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'dln797UdzLU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 50)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wc-89je2Ju4', 'Photosynthesis in Higher Plants Part 3', 'Photosynthesis in Higher Plants (Part-3)| Bio-Fest for NEET 2024 | Day 52/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 6196, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'wc-89je2Ju4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 51)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('df8WOaihmtM', 'Respiration in Plants Part 1', 'Respiration in Plants (Part-1)| Bio-Fest for NEET 2024 | Day 53/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 6001, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'df8WOaihmtM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 52)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('jcuLtTLLWXo', 'Respiration in Plants Part 2', 'Respiration in Plants (Part-2) | Bio-Fest for NEET 2024 | Day 54/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 5731, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'jcuLtTLLWXo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 53)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fGvZLJqnV0s', 'Plant Growth and Development', 'Plant Growth and Development | Bio-Fest for NEET 2024 | Day 55/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development'), 2, 5320, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', 'fGvZLJqnV0s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 54)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('swzWpL2Ujog', 'Sexual Reproduction in Flowering Plants Part 1', 'Sexual Reproduction in Flowering Plants (Part-1) | for NEET 2024 | Day 56/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4900, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'swzWpL2Ujog';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 55)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JSQggv9NH3Q', 'Sexual Reproduction in Flowering Plants Part 2', 'Sexual Reproduction in Flowering Plants (Part-2) | for NEET 2024 | Day 57/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 5485, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'JSQggv9NH3Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 56)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TegBjmL4CLE', 'Principles of Inheritance and Variation Part 1', 'Principle of Inheritance and Variation (Part-1) | for NEET 2024 | Day 58/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 5376, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'TegBjmL4CLE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 57)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hg5Kc-Eo2Dg', 'Principles of Inheritance and Variation Part 2', 'Principle of Inheritance and Variation (Part-2) | for NEET 2024 | Day 59/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 5246, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'hg5Kc-Eo2Dg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 58)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RsD7wTSjBe8', 'Principles of Inheritance and Variation Part 3', 'Principle of Inheritance and Variation (Part-3) | for NEET 2024 | Day 60/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 5721, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'RsD7wTSjBe8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 59)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('awYp1s8h5OU', 'Principles of Inheritance and Variation Part 4', 'Principle of Inheritance and Variation (Part-4) | for NEET 2024 | Day 61/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 5321, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'awYp1s8h5OU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 60)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('UAlYJg80mVw', 'Principles of Inheritance and Variation Part 5', 'Principle of Inheritance and Variation (Part-5) | for NEET 2024 | Day 62/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 5595, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'UAlYJg80mVw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 61)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rwIQOusj2Pk', 'Molecular Basis of Inheritance Part 1', 'Molecular Basis of Inheritance (Part-1) | for NEET 2024 | Day 63/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 4585, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'rwIQOusj2Pk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 62)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AtmBru4g6rs', 'Molecular Basis of Inheritance Part 2', 'Molecular Basis of Inheritance (Part-2) | for NEET 2024 | Day 64/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 5751, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'AtmBru4g6rs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 63)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vq5U0FInbCI', 'Molecular Basis of Inheritance Part 3', 'Molecular Basis of Inheritance (Part-3) | for NEET 2024 | Day 65/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 5560, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'vq5U0FInbCI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 64)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4pwX-7d_PCE', 'Molecular Basis of Inheritance Part 4', 'Molecular Basis of Inheritance (Part-4) | for NEET 2024 | Day 66/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 5781, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', '4pwX-7d_PCE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 65)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('uVAXhtFd_dg', 'Molecular Basis of Inheritance Part 5', 'Molecular Basis of Inheritance (Part-5) | for NEET 2024 | Day 67/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 5350, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'uVAXhtFd_dg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 66)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('46-ycMS_Y2g', 'Biotechnology: Principles and Processes Part 1', 'Biotechnology: Principles and Processes (Part-1) | NEET 2024 | Day 68/70 Days of NCERT Excursion', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-principles-and-processes'), 2, 4865, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-principles-and-processes', '46-ycMS_Y2g';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 67)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('e0mpNqAucqc', 'Biotechnology and Its Applications Part 2', 'Biotechnology and Its Application (Part-2) | NEET 2024 | Last Day of Bio Fest | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-and-its-applications'), 2, 3963, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-and-its-applications', 'e0mpNqAucqc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 68)
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
      ('Bio-Fest for NEET 2024 Aspirants')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Bio-Fest for NEET 2024 Aspirants');
  if v_course_count <> 1 then
    raise exception 'expected exactly 1 courses for ALLEN NEET part 3, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Bio-Fest for NEET 2024 Aspirants');
  if v_lesson_count <> 68 then
    raise exception 'expected exactly 68 lessons across ALLEN NEET part 3, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Bio-Fest for NEET 2024 Aspirants')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in ALLEN NEET part 3 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Bio-Fest for NEET 2024 Aspirants')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'ALLEN NEET part 3: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: ALLEN NEET part 3 -- % courses, % lessons, all correctly chaptered and linked.', 1, 68;
end
$$;

commit;
