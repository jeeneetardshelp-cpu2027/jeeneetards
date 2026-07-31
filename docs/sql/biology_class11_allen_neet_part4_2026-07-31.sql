-- biology_class11_allen_neet_part4_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: ALLEN NEET (part 4 of 5).
-- 4 courses, 53 lessons. Every video ID/title/duration in this file
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

-- Course: NCERT Decode Series - Biology (28 lessons, source playlist PLru9htpOg_gdr9-IHWDT0WgPRVffcVoVA)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('NCERT Decode Series - Biology', NULL, v_channel_id, 4, 'revision', 'hinglish', 'beginner')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JbsKB4HzucM', 'Morphology of Flowering Plants Part 2', 'Morphology Of Flowering Plants (Part-2) | Important for NEET 2024 Exam 📚Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 3946, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'JbsKB4HzucM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('iRjrfwumgI8', 'Morphology of Flowering Plants Part 1', 'Morphology Of Flowering Plants (Part-1) | Important for NEET 2024 Exam 📚Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 4036, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'iRjrfwumgI8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('x7U6sYorvJ0', 'Biodiversity and Conservation Part 2', 'Biodiversity and Conservation (Part-2) | Important for NEET 2024 Exam 📚Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 1726, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'x7U6sYorvJ0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('OvcwdkeQ0Qo', 'Biodiversity and Conservation Part 1', 'Biodiversity and Conservation (Part-1) | Important for NEET 2024 Exam 📚Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 1951, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'OvcwdkeQ0Qo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nL9mGZ9riGM', 'Locomotion and Movement Part 2', 'Locomotion and Movement (Part-2) | Important for NEET 2024 Exam 📚| Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 2571, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'nL9mGZ9riGM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('THCCq5TFHGc', 'Locomotion and Movement Part 1', 'Locomotion and Movement (Part-1) | Important for NEET 2024 Exam 📚Biology NCERT Decode| @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3900, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'THCCq5TFHGc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('eu6kMsjeY08', 'Ecosystem Part 2', 'Ecosystem (Part-2) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3778, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'eu6kMsjeY08';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('3grXzPnfJak', 'Ecosystem Part 1', 'Ecosystem (Part-1) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3290, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '3grXzPnfJak';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7Dx_DePXopA', 'Body Fluids and Circulation Part 2', 'Body Fluids & Circulation (part-2) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3750, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '7Dx_DePXopA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JmCGXXBczRM', 'Human Health and Disease Part 2', 'Human Health & Disease (Part-2) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 3855, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'JmCGXXBczRM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_PVXBM3Q3Pk', 'Body Fluids and Circulation Part 1', 'Body Fluids & Circulation | Important for NEET 2024 Exam 📚 | Biology NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 4071, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '_PVXBM3Q3Pk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nCPLqt6-oR0', 'Human Health and Disease Part 1', 'Human Health And Disease | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 3865, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'nCPLqt6-oR0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('FLXknE0Hne8', 'Molecular Basis of Inheritance Part 2', 'Molecular Basis of Inheritance (Part-2) | Important for NEET 2024 Exam | Biology | NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3101, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'FLXknE0Hne8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('W03YDjHi-Os', 'Evolution Part 2', 'Evolution (Part-2) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 3830, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'W03YDjHi-Os';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Q_hStXKbqlk', 'Molecular Basis of Inheritance Part 1', 'Molecular Basis of Inheritance (Part-1) | Important for NEET 2024 Exam | Biology | NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3041, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'Q_hStXKbqlk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rpumcvJmhqs', 'Evolution Part 1', 'Evolution (Part-1) | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 3634, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'rpumcvJmhqs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('PD8-xFPjPaw', 'Principles of Inheritance and Variation Part 2', 'Principles of Inheritance and Variations (Part-2) | Important for NEET 2024 Exam | NCERT Decode', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2305, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'PD8-xFPjPaw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RXE0r4FY3PM', 'Principles of Inheritance and Variation Part 1', 'Principles of Inheritance and Variations (Part-1) | Important for NEET 2024 Exam | Biology NCERT', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2486, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'RXE0r4FY3PM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LS97M-LEdt0', 'Cell Cycle and Cell Division', 'Cell Cycle and Cell Division | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 3925, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'LS97M-LEdt0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('R8OWKtDjgrQ', 'Cell: The Unit of Life', '➡️ Cell : The Unit of Life | Important for NEET 2024 Exam 📚 | Biology NCERT Decode |   @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 3980, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'R8OWKtDjgrQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7xFrHDFGuRQ', 'Organisms and Populations Part 2', 'Organisms and Populations (Part-2) | Important for NEET 2024 Exam 📚| Biology NCERT Decode @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 1825, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', '7xFrHDFGuRQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BwdtZYXQB5M', 'Breathing and Exchange of Gases', 'Breathing and Exchange of Gases | Important for NEET 2024 Exam 📚| Biology NCERT Decode |  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 2720, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'BwdtZYXQB5M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LzWWkxDrCJk', 'Organisms and Populations Part 1', '➡️ Organisms and Populations | Important for NEET 2024 Exam 📚 | Biology NCERT Decode | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 2230, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'LzWWkxDrCJk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LS9fVsYEBzQ', 'Sexual Reproduction in Flowering Plants', '📌NCERT Decode Series | Sexual Reproduction in Flowering Plants | Easy way to Crack NEET 2024 Exam📚​', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 2915, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'LS9fVsYEBzQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('c3jBZNbQlqQ', 'Human Reproduction', '📌NCERT Decode Series | Human Reproduction | Biology | Easy way to Crack NEET 2024 Exam 📚| @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 2341, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'c3jBZNbQlqQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1B0YesEh8e4', 'Biological Classification', 'NCERT Decode Series | Biological Classification | Biology | Important for NEET 2024 Exam📚@ALLENNEET​', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 2802, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', '1B0YesEh8e4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('owpcpZm3gbY', 'Animal Kingdom', '📌NCERT Decode Series | Animal Kingdom | Biology | Easy way to Crack NEET 2024 Exam 📚 | @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 1986, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'owpcpZm3gbY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 27)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('bLR3eXJ4Iqs', 'Plant Kingdom', '📌NCERT Decode Series | Plant Kingdom | Biology | Easy way to Crack NEET 2024 Exam 📚 @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 2515, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'bLR3eXJ4Iqs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 28)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava (11 lessons, source playlist PLru9htpOg_gcPpPoXH9Hv57lvzjyBpbhj)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava', 'Dr. Sudhanshu Srivastava', v_channel_id, 4, 'revision', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('uArzAQXcU34', 'Midbrain', 'Midbrain | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 155, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'uArzAQXcU34';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('x8a2UlgSrAM', 'Forebrain', 'Forebrain | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 211, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'x8a2UlgSrAM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Xauzn-tMrbM', 'Excitable Cell Neuron', 'Excitable Cell Neuron | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 227, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'Xauzn-tMrbM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('bC2sopfm6ns', 'Cerebellum Explained', 'Cerebellum Explained | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 170, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'bC2sopfm6ns';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DbYFb9FlroM', 'Brain Meninges Explained', 'Brain Meninges Explained | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 169, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'DbYFb9FlroM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Evb1dY25lTk', 'Master Neural Control and Coordination', 'Master Neural Control & Coordination | NEET Biology | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 2040, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'Evb1dY25lTk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Po9jgPx5xoo', 'Polarisation', 'Polarisation | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 229, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'Po9jgPx5xoo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('h7YfFUYeycs', 'Repolarisation', 'Repolarisation | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 176, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'h7YfFUYeycs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('SnXC7axBjMk', 'Saltatory Conduction', 'Saltatory Conduction | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 135, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'SnXC7axBjMk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fNLFCsSHvJ4', 'Thalamus and Hypothalamus', 'Thalamus & Hypothalamus | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 234, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'fNLFCsSHvJ4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TbH3K2Tu8F0', 'Types of Neuron', 'Types of Neuron | Important Biology Concept for NEET | ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 154, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'TbH3K2Tu8F0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: NCERT to NEET (6 lessons, source playlist PLru9htpOg_gcqjb1hw6T-2e3lSjcNEsdu)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('NCERT to NEET', NULL, v_channel_id, 4, 'revision', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('oGNsXEri9pc', 'Locomotion and Movement Complete Chapter', 'Locomotion and Movement Complete Chapter | NCERT to NEET | Munish Dhull Sir', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 11838, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'oGNsXEri9pc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('UgBFh1cXeKs', 'Sexual Reproduction in Flowering Plants One Shot', 'Sexual Reproduction in Flowering Plants | NCERT to NEET One Shot | Aman Parashar Sir', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 11260, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'UgBFh1cXeKs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('kwXH2FmP6UY', 'Cell: The Unit of Life Complete Preparation', 'Cell – The Unit of Life | Complete NCERT to NEET Preparation | Aman Parashar Sir', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 11751, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'kwXH2FmP6UY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('WrqfMaiaZqw', 'Animal Kingdom Complete Chapter', 'Animal Kingdom Complete Chapter 🔥 NCERT to NEET | Munish Dhull Sir', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 15041, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'WrqfMaiaZqw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TAeKGtiwcNw', 'Ecosystem Complete Chapter', 'NCERT to NEET 🔥 Ecosystem Complete Chapter | Aman Parashar Sir', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 7896, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'TAeKGtiwcNw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('43xsHexRtkQ', 'Neural Control and Coordination Full Chapter', 'Neural Control & Coordination Full Chapter | NCERT to NEET Biology | Munish Dhull Sir', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 10784, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', '43xsHexRtkQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Botany - NEET PowerPlus Online Course (8 lessons, source playlist PLru9htpOg_ge4YTfWAhHhnLMY6AsZS8yh)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Botany - NEET PowerPlus Online Course', NULL, v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zKcWU2DL1bo', 'Ecosystem Part 3', 'NEET PowerPlus Online Course — Botany | Ecosystem - Part 3 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 4245, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'zKcWU2DL1bo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('WoEpRAgqtxQ', 'Ecosystem Part 2', 'NEET PowerPlus Online Course — Botany | Ecosystem - Part 2 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 4420, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'WoEpRAgqtxQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cPsLWWB0vDI', 'Ecosystem Part 1', 'NEET PowerPlus Online Course — Botany | Ecosystem - Part 1 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 4315, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'cPsLWWB0vDI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gGtcM5dSadU', 'Organisms and Populations Part 11', 'NEET PowerPlus Online Course — Botany | Organisms & Populations - Part 11 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4405, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'gGtcM5dSadU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hfN9-wRjzIM', 'Organisms and Populations Part 10', 'NEET PowerPlus Online Course — Botany | Organisms & Populations - Part 10 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4475, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'hfN9-wRjzIM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AP8LOqpfztk', 'Organisms and Populations Part 9', 'NEET PowerPlus Online Course — Botany | Organisms & Populations - Part 9 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4040, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'AP8LOqpfztk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pY9ZRbYOxgk', 'Organisms and Populations Part 8', 'NEET PowerPlus Online Course — Botany | Organisms & Populations - Part 8 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3971, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'pY9ZRbYOxgk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('V92OGUYN6tE', 'Organisms and Populations Part 7', 'NEET PowerPlus Online Course — Botany | Organisms & Populations - Part 7 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3885, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'V92OGUYN6tE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
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
      ('NCERT Decode Series - Biology'),
      ('Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava'),
      ('NCERT to NEET'),
      ('Botany - NEET PowerPlus Online Course')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('NCERT Decode Series - Biology', 'Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava', 'NCERT to NEET', 'Botany - NEET PowerPlus Online Course');
  if v_course_count <> 4 then
    raise exception 'expected exactly 4 courses for ALLEN NEET part 4, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('NCERT Decode Series - Biology', 'Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava', 'NCERT to NEET', 'Botany - NEET PowerPlus Online Course');
  if v_lesson_count <> 53 then
    raise exception 'expected exactly 53 lessons across ALLEN NEET part 4, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('NCERT Decode Series - Biology', 'Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava', 'NCERT to NEET', 'Botany - NEET PowerPlus Online Course')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in ALLEN NEET part 4 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('NCERT Decode Series - Biology', 'Important Biology Concepts for NEET with Dr. Sudhanshu Srivastava', 'NCERT to NEET', 'Botany - NEET PowerPlus Online Course')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'ALLEN NEET part 4: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: ALLEN NEET part 4 -- % courses, % lessons, all correctly chaptered and linked.', 4, 53;
end
$$;

commit;
