-- biology_class11_aakash_neet_part1_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: Aakash NEET (part 1 of 5).
-- 7 courses, 59 lessons. Every video ID/title/duration in this file
-- was independently re-verified against the live YouTube Data API (videos.list) after extraction
-- -- 100% match on channel, title, duration and embeddability, 0 flagged.
--
-- Run this file FIRST for Aakash NEET -- it creates the channel row every other
-- part for this channel depends on.
--
-- Idempotent: channel insert is on-conflict-safe; video inserts are
-- on-conflict-safe (youtube_video_id unique); course (playlist) inserts are
-- plain inserts -- safe to re-run ONLY if the courses from this exact file
-- were never successfully created before (the self-verification step below
-- would catch a partial/duplicate re-run by course title).

begin;

insert into public.institutes_channels (name, youtube_channel_id)
values ('Aakash NEET', 'UCAPDuc6Kfpe1mKjMX367qmA')
on conflict (youtube_channel_id) do nothing;

-- Course: The Living World — Mission MBBS (Aakash NEET) (4 lessons, source playlist PL7AAT-ai0VD6WKEGexkwjGlXrgLNkoHNq)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('The Living World — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ijbmw7JhKG0', 'The Living World Class 11 Biology NEET Concepts (L 1)', 'The Living World Class 11 Biology NEET Concepts (L 1) | Class 11 Botany | NEET 2023 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world' and subject_id = 4), 2, 4445, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'ijbmw7JhKG0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('e62RYW5XNZI', 'Taxonomy and Binomial Nomenclature Class 11 Biology - The Living World Concepts (L 2)', 'Taxonomy and Binomial Nomenclature Class 11 Biology - The Living World Concepts (L 2) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world' and subject_id = 4), 2, 4805, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'e62RYW5XNZI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vYdT5v7REZ8', 'Taxonomic Hierarchy and Taxonomic Aids Class 11 Biology - The Living World Concepts (L3)', 'Taxonomic Hierarchy and Taxonomic Aids Class 11 Biology - The Living World Concepts (L3) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world' and subject_id = 4), 2, 4070, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'vYdT5v7REZ8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hF0E5JNM64I', 'The Living World Class 11 Biology Complete Chapter', 'The Living World Class 11 Biology Complete Chapter | Living World - Key Take Away | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world' and subject_id = 4), 2, 3594, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'hF0E5JNM64I';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Biological Classification — Mission MBBS (Aakash NEET) (10 lessons, source playlist PL7AAT-ai0VD7fbvy1GaMMV_5T7NP5geIU)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Biological Classification — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Bd8O2PZ1ZnM', 'Biological Classification Class 11 Biology Concepts (Botany)', 'Biological Classification Class 11 Biology Concepts (Botany) | NEET 2024 Exam Prep | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3817, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'Bd8O2PZ1ZnM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DBSuyTD-Kco', 'Biological Classification Class 11 Biology Concepts NEET (L 2) (Botany)', 'Biological Classification Class 11 Biology Concepts NEET (L 2) (Botany) | NEET 2024 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3474, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'DBSuyTD-Kco';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('bZ_oz7J0bnc', 'Kingdom Monera-II Class 11 Biology - Biological Classification Concepts (L 3)', 'Kingdom Monera-II Class 11 Biology - Biological Classification Concepts (L 3) | NEET 2024 Prep.', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3397, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'bZ_oz7J0bnc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_x9NMFYyhyM', 'Kingdom Protista Class 11 Biology - Biological Classification Concepts (L4)', 'Kingdom Protista Class 11 Biology - Biological Classification Concepts (L4) | NEET 2024 Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3409, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', '_x9NMFYyhyM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AUllwKzcc9M', 'Kingdom Protista II Class 11 Biology - Biological Classification Concepts (L 5)', 'Kingdom Protista II Class 11 Biology - Biological Classification Concepts (L 5) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3270, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'AUllwKzcc9M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rKgA_C3S2cc', 'Kingdom Fungi Class 11 Biology - Biological Classification Concepts Explained (L 6)', 'Kingdom Fungi Class 11 Biology - Biological Classification Concepts Explained (L 6) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3380, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'rKgA_C3S2cc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cvVOoP7sTtE', 'Kingdom Fungi - II Class 11 Biology (Concepts) - Biological Classification (L7)', 'Kingdom Fungi - II Class 11 Biology (Concepts) - Biological Classification (L7) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3160, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'cvVOoP7sTtE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IXEc57JZqaA', 'Kingdom Plantae and Animalia - Biological Classification Class 11 Biology Concepts (L8)', 'Kingdom Plantae and Animalia - Biological Classification Class 11 Biology Concepts (L8) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 3271, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'IXEc57JZqaA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Nflc5-ZfzMA', 'Viruses, Viroids and Prions - Biological Classification Class 11 Biology Concepts (L9)', 'Viruses, Viroids and Prions - Biological Classification Class 11 Biology Concepts (L9) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 2492, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'Nflc5-ZfzMA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('bd9hXJTdncw', 'Biological Classification Class 11 Biology Most Important Questions & Solutions (L10)', 'Biological Classification Class 11 Biology Most Important Questions & Solutions (L10) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 2585, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'bd9hXJTdncw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Plant Kingdom — Mission MBBS (Aakash NEET) (10 lessons, source playlist PL7AAT-ai0VD7Lynh3WMGAFvxGxqdOx4ge)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Plant Kingdom — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('b2szozixtyc', 'General Characters of Algae - Introduction to Plant Kingdom Class 11 Biology Concepts', 'General Characters of Algae - Introduction to Plant Kingdom Class 11 Biology Concepts | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3221, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'b2szozixtyc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4wHBMJwe6F4', 'Chlorophycae - Plant Kingdom Class 11 Biology Concept Explained', 'Chlorophycae - Plant Kingdom Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3633, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', '4wHBMJwe6F4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('i0mdT0tDctc', 'Phaeophyceae - Plant Kingdom Class 11 Biology Concept Explained', 'Phaeophyceae - Plant Kingdom Class 11 Biology Concept Explained | Class 11 Botany | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3321, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'i0mdT0tDctc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('PlfjUM4DU5w', 'Rhodophyceae - Plant Kingdom Class 11 Biology Concept Explained', 'Rhodophyceae - Plant Kingdom Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3321, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'PlfjUM4DU5w';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('neFulpAXHko', 'Bryophytes - Plant Kingdom Class 11 Biology Concept Explained', 'Bryophytes - Plant Kingdom Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3616, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'neFulpAXHko';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('abrRVp_ixRU', 'Pteridophytes - Plant Kingdom Class 11 Biology (Chapter 3) Concept Explained', 'Pteridophytes - Plant Kingdom Class 11 Biology (Chapter 3) Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3101, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'abrRVp_ixRU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('lpN4JPq1W6E', 'Gymnosperms and Angiosperms - Plant Kingdom Class 11 Biology Concept Explained', 'Gymnosperms and Angiosperms - Plant Kingdom Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3395, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'lpN4JPq1W6E';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nb407Ain7G8', 'Gymnosperms and Angiosperms - Plant Kingdom Class 11 Biology Concept Explained (Part 2)', 'Gymnosperms and Angiosperms - Plant Kingdom Class 11 Biology Concept Explained (Part 2) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 3301, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'nb407Ain7G8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XRjZoP7OOgM', '10 Important Questions from Plant Kingdom Class 11 Biology (Botany)', '10 Important Questions from Plant Kingdom Class 11 Biology (Botany) | NEET 2023 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom' and subject_id = 4), 2, 1837, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'XRjZoP7OOgM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('WnplzGEb1Cg', 'Biological Classification: Kingdom Monera', 'Biological Classification | Kingdom Monera |NEET 2024 |Aakash Byju''s| Pankhuri Ma''am #neet #neet2023', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification' and subject_id = 4), 2, 4352, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'WnplzGEb1Cg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Animal Kingdom — Mission MBBS (Aakash NEET) (11 lessons, source playlist PL7AAT-ai0VD7sxjI4A1v-BRbV-S2tSi0G)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Animal Kingdom — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('unCgfAG5BTw', 'Basis of Classifications & Phylum Porifera - Animal Kingdom Class 11 Concepts (L1)', 'Basis of Classifications & Phylum Porifera - Animal Kingdom Class 11 Concepts (L1)  | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 4210, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'unCgfAG5BTw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('65MU6M1nV6A', 'Phylum Coelenterata, Ctenophora & Platyhelmenthes - Animal Kingdom Class 11 Biology (L2)', 'Phylum Coelenterata, Ctenophora & Platyhelmenthes - Animal Kingdom Class 11 Biology (L2) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 3799, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '65MU6M1nV6A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('96n7tDRl9O0', 'Phylum Platyhelminthes and Aschelminthes - Animal Kingdom Class 11 Biology (L3)', 'Phylum Platyhelminthes and Aschelminthes - Animal Kingdom Class 11 Biology (L3) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 3400, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '96n7tDRl9O0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AKfIFHJ1N6o', 'Phylum Annelida and Arthropoda - Animal Kingdom Class 11 Biology (L4)', 'Phylum Annelida and Arthropoda - Animal Kingdom Class 11 Biology (L4) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 3633, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'AKfIFHJ1N6o';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LV1BExAQRjI', 'Phylum Mollusca and Echinodermata - Animal Kingdom Class 11 Biology (L5)', 'Phylum Mollusca and Echinodermata - Animal Kingdom Class 11 Biology (L5) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 3650, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'LV1BExAQRjI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Ok4gyjwbSXY', 'Phylum Hemichordata and Chordata - Animal Kingdom Class 11 Biology Concept (L6)', 'Phylum Hemichordata and Chordata - Animal Kingdom Class 11 Biology Concept (L6) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2398, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'Ok4gyjwbSXY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('R45yOsoBttg', 'Super Class Pisces - Animal Kingdom Class 11 Biology Concept (L7)', 'Super Class Pisces - Animal Kingdom Class 11 Biology Concept (L7) | NEET 2024 Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2724, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'R45yOsoBttg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('-JmO3PVgcLw', 'Difference between Amphibia and Reptilia - Animal Kingdom Class 11 Biology Concept (L8)', 'Difference between Amphibia and Reptilia - Animal Kingdom Class 11 Biology Concept (L8) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2583, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '-JmO3PVgcLw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_e1SQq2eY7I', 'Difference between Aves and Mammalia - Animal Kingdom Class 11 Biology Concept', 'Difference between Aves and Mammalia - Animal Kingdom Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2149, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '_e1SQq2eY7I';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('INOnuGEm1xs', 'Mammalia Characteristics and Examples - Animal Kingdom Class 11 Biology Concept', 'Mammalia Characteristics and Examples - Animal Kingdom Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2342, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'INOnuGEm1xs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Mtp9oZnv--k', 'Top 10 Important Questions from Animal Kingdom Class 11 Biology', 'Top 10 Important Questions from Animal Kingdom Class 11 Biology | NEET 2023 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom' and subject_id = 4), 2, 2039, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'Mtp9oZnv--k';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Morphology of Flowering Plants — Mission MBBS (Aakash NEET) (9 lessons, source playlist PL7AAT-ai0VD7vToaDNPSlu8Mefq4PF81V)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Morphology of Flowering Plants — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('GOMKLZiaJIo', 'Root Zones & Modification - Morphology of Flowering Plants Concept Explained', 'Root Zones & Modification - Morphology of Flowering Plants Class 11 Biology Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 3352, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'GOMKLZiaJIo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('80r3BbCyv1U', 'Stem & its Modifications - Morphology of Flowering Plants Class 11 Biology Concept', 'Stem & its Modifications - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 3556, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', '80r3BbCyv1U';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('9b4DyPQneec', 'Leaf Structure & Modifications - Morphology of Flowering Plants Class 11 Biology Concept', 'Leaf Structure & Modifications - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 2962, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', '9b4DyPQneec';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2DciF62BFfs', 'Inflorescence and its Types - Morphology of Flowering Plants Class 11 Biology Concept', 'Inflorescence and its Types - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 3546, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', '2DciF62BFfs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BZyXVNxHQsM', 'Androecium and Gynoecium - Morphology of Flowering Plants Class 11 Biology Concept', 'Androecium and Gynoecium - Morphology of Flowering Plants Class 11 Biology (Botany) Concept | NEET', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 3481, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'BZyXVNxHQsM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qX1NkOjBf1M', 'Dicot and Monocot Seeds - Morphology of Flowering Plants Class 11 Biology Concept', 'Dicot and Monocot Seeds - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 3646, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'qX1NkOjBf1M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1FcLTy3tw4E', 'Floral Diagram Symbols - Morphology of Flowering Plants Class 11 Biology Concept', 'Floral Diagram Symbols - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 1187, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', '1FcLTy3tw4E';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('itAkM4t7oK0', 'Families of Flowering Plants - Morphology of Flowering Plants Class 11 Biology Concept', 'Families of Flowering Plants - Morphology of Flowering Plants Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 2811, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'itAkM4t7oK0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('oDfi9kb8Ys8', 'Most Important Previous Year Questions from Morphology of Flowering Plants', 'Most Important Previous Year Questions from Morphology of Flowering Plants Class 11 Biology (Botany)', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants' and subject_id = 4), 2, 1784, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'oDfi9kb8Ys8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Anatomy of Flowering Plants — Mission MBBS (Aakash NEET) (9 lessons, source playlist PL7AAT-ai0VD7R_DHV4CLcaTHSm8jkF3qo)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Md2r7mHP60Q', 'Meristematic Tissue - Anatomy of Flowering Plants Class 11 Biology Concepts (Pt 1)', 'Meristematic Tissue - Anatomy of Flowering Plants Class 11 Biology Concepts (Pt 1) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 1992, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'Md2r7mHP60Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('myLcOKf7SGM', 'Simple Permanent Tissues - Anatomy of Flowering Plants Class 11 Biology Concepts', 'Simple Permanent Tissues - Anatomy of Flowering Plants Class 11 Biology Concepts | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 1815, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'myLcOKf7SGM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wMyq4ZYmtH8', 'Complex Permanent Tissue - Anatomy of Flowering Plants Class 11 Biology Concepts', 'Complex Permanent Tissue - Anatomy of Flowering Plants Class 11 Biology Concepts | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 3275, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'wMyq4ZYmtH8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cir9yzNB6zo', 'Tissue System (Epidermal & Ground)- Anatomy of Flowering Plants Class 11 Biology Concept', 'Tissue System (Epidermal & Ground)- Anatomy of Flowering Plants Class 11 Biology Concept | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 2591, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'cir9yzNB6zo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('QslRP0i301M', 'Anatomy of Dicot and Monocot Root - Anatomy of Flowering Plants Class 11 Biology Concept', 'Anatomy of Dicot and Monocot Root - Anatomy of Flowering Plants Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 2930, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'QslRP0i301M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yz9-E7j3pms', 'Anatomy of Monocot & Dicot Stem - Anatomy of Flowering Plants Class 11 Biology Concept', 'Anatomy of Monocot & Dicot Stem  - Anatomy of Flowering Plants Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 2831, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'yz9-E7j3pms';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('39d0xmHLurw', 'Vascular Cambium : Secondary Growth - Anatomy of Flowering Plants Concept Explained', 'Vascular Cambium : Secondary Growth - Anatomy of Flowering Plants Class 11 Biology Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 3215, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', '39d0xmHLurw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_mqaAYubSiI', 'Vascular Cambium : Secondary Growth in Roots - Anatomy of Flowering Plants Concept', 'Vascular Cambium : Secondary Growth in Roots - Anatomy of Flowering Plants Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 3258, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', '_mqaAYubSiI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('mVJgF3O12qU', 'Cork Cambium: Secondary Growth in Roots - Anatomy of Flowering Plants Concept', 'Cork Cambium: Secondary Growth in Roots - Anatomy of Flowering Plants Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants' and subject_id = 4), 2, 3043, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'mVJgF3O12qU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Structural Organisation in Animals — Mission MBBS (Aakash NEET) (6 lessons, source playlist PL7AAT-ai0VD4Kyay5dw3mkQYpQ1dyQkl7)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Structural Organisation in Animals — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vsjRpzhX-Rk', 'Levels of Organization in Organisms - Structural Organisation in Animals Concepts', 'Levels of Organization in Organisms - Structural Organisation in Animals Class 11 Biology Concepts', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 3676, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'vsjRpzhX-Rk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1kRuoXWpA7k', 'Compound Epithelium Tissue - Structural Organisation in Animals Concept Explained', 'Compound Epithelium Tissue - Structural Organisation in Animals Class 11 Biology Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 2695, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', '1kRuoXWpA7k';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('c1p2ZHpKekE', 'Connective Tissue & its Types - Structural Organisation in Animals Concept', 'Connective Tissue & its Types - Structural Organisation in Animals Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 2936, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'c1p2ZHpKekE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sLQQtond6E0', 'Earthworm - Structural Organisation in Animals Class 11 Biology Concepts', 'Earthworm - Structural Organisation in Animals Class 11 Biology Concepts', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 2961, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'sLQQtond6E0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('biWZUuVCL68', 'Morphology and Anatomy of Cockroach - Structural Organisation in Animals Concepts', 'Morphology and Anatomy of Cockroach - Structural Organisation in Animals Class 11 Biology Concepts', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 2845, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'biWZUuVCL68';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('N3VPOGyt-Dw', 'Morphology and Anatomy of Frog - Structural Organisation in Animals (Part 2)', 'Morphology and Anatomy of Frog - Structural Organisation in Animals Class 11 Biology (Part 2)', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals' and subject_id = 4), 2, 3410, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'N3VPOGyt-Dw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
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
      ('The Living World — Mission MBBS (Aakash NEET)'),
      ('Biological Classification — Mission MBBS (Aakash NEET)'),
      ('Plant Kingdom — Mission MBBS (Aakash NEET)'),
      ('Animal Kingdom — Mission MBBS (Aakash NEET)'),
      ('Morphology of Flowering Plants — Mission MBBS (Aakash NEET)'),
      ('Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)'),
      ('Structural Organisation in Animals — Mission MBBS (Aakash NEET)')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('The Living World — Mission MBBS (Aakash NEET)', 'Biological Classification — Mission MBBS (Aakash NEET)', 'Plant Kingdom — Mission MBBS (Aakash NEET)', 'Animal Kingdom — Mission MBBS (Aakash NEET)', 'Morphology of Flowering Plants — Mission MBBS (Aakash NEET)', 'Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)', 'Structural Organisation in Animals — Mission MBBS (Aakash NEET)');
  if v_course_count <> 7 then
    raise exception 'expected exactly 7 courses for Aakash NEET part 1, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('The Living World — Mission MBBS (Aakash NEET)', 'Biological Classification — Mission MBBS (Aakash NEET)', 'Plant Kingdom — Mission MBBS (Aakash NEET)', 'Animal Kingdom — Mission MBBS (Aakash NEET)', 'Morphology of Flowering Plants — Mission MBBS (Aakash NEET)', 'Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)', 'Structural Organisation in Animals — Mission MBBS (Aakash NEET)');
  if v_lesson_count <> 59 then
    raise exception 'expected exactly 59 lessons across Aakash NEET part 1, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('The Living World — Mission MBBS (Aakash NEET)', 'Biological Classification — Mission MBBS (Aakash NEET)', 'Plant Kingdom — Mission MBBS (Aakash NEET)', 'Animal Kingdom — Mission MBBS (Aakash NEET)', 'Morphology of Flowering Plants — Mission MBBS (Aakash NEET)', 'Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)', 'Structural Organisation in Animals — Mission MBBS (Aakash NEET)')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in Aakash NEET part 1 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('The Living World — Mission MBBS (Aakash NEET)', 'Biological Classification — Mission MBBS (Aakash NEET)', 'Plant Kingdom — Mission MBBS (Aakash NEET)', 'Animal Kingdom — Mission MBBS (Aakash NEET)', 'Morphology of Flowering Plants — Mission MBBS (Aakash NEET)', 'Anatomy of Flowering Plants — Mission MBBS (Aakash NEET)', 'Structural Organisation in Animals — Mission MBBS (Aakash NEET)')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'Aakash NEET part 1: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: Aakash NEET part 1 -- % courses, % lessons, all correctly chaptered and linked.', 7, 59;
end
$$;

commit;
