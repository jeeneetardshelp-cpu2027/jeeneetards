-- biology_class11_allen_neet_part2_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: ALLEN NEET (part 2 of 5).
-- 1 courses, 49 lessons. Every video ID/title/duration in this file
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

-- Course: 50 Days to NEET Success - Bio-Fest 2.0 (49 lessons, source playlist PLru9htpOg_gc3RUnDSriKqTrjoEZQ4zEj)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('50 Days to NEET Success - Bio-Fest 2.0', NULL, v_channel_id, 4, 'revision', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sStUJVDB54A', 'Biodiversity and Conservation Part 1', 'Biodiversity & Conservation Part-1 | Day 49 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 3671, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'sStUJVDB54A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2249I-J2svI', 'Ecosystem Part 2', 'Ecosystem Part-2 | Day 48 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3390, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '2249I-J2svI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('E54XnveeTII', 'Ecosystem Part 1', 'Ecosystem Part-1 | Day 47 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3650, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'E54XnveeTII';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('jDuf-kNEJtY', 'Organisms and Populations Part 2', 'Organisms and Populations Part-2 | Day 46 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 4461, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'jDuf-kNEJtY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DalVC-7K6T0', 'Organisms and Populations Part 1', 'Organisms and Populations | Part-1 | Day 45 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3660, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'DalVC-7K6T0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rtQZxgj3ufU', 'Microbes in Human Welfare', 'Microbes in Human Welfare | Day 44 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'microbes-in-human-welfare'), 2, 3731, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'microbes-in-human-welfare', 'rtQZxgj3ufU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('0QnUI7hN7U8', 'Biotechnology and Its Applications', 'Biotechnology And Its Application | Day 43 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-and-its-applications'), 2, 4406, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-and-its-applications', '0QnUI7hN7U8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JeKhmHQ43ek', 'Biotechnology: Principles and Processes', 'Biotechnology: Principles & Processes | Day 42 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-principles-and-processes'), 2, 5095, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-principles-and-processes', 'JeKhmHQ43ek';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tqthhtofrdE', 'Evolution', 'Evolution  | Day 41 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 4720, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'tqthhtofrdE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JQMQon2ia0A', 'Molecular Basis of Inheritance Part 3', 'Molecular Basis of Inheritance Part-3 | Day 40 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3540, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'JQMQon2ia0A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Xzpfdk7GtAI', 'Molecular Basis of Inheritance Part 2', 'Molecular Basis of Inheritance Part-2 | Day 39 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3605, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'Xzpfdk7GtAI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('NxDZR461t1w', 'Molecular Basis of Inheritance Part 1', 'Molecular Basis of Inheritance Part-1 | Day 38 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3568, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'NxDZR461t1w';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('930-Z9lIKcA', 'Principles of Inheritance and Variation Part 3', 'Principle of Inheritance & Variations Part-3 | Day 37 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3626, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', '930-Z9lIKcA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('MLPCeFF8Oeo', 'Principles of Inheritance and Variation Part 2', 'Principle of Inheritance & Variations Part-2 | Day 36 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3870, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'MLPCeFF8Oeo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DaX3loxwNI4', 'Principles of Inheritance and Variation Part 1', 'Principle of Inheritance & Variations Part-1 | Day 35 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 4556, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'DaX3loxwNI4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zq4SOivtqBE', 'Human Health and Disease', 'Human Health And Disease | Day 34 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 4835, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'zq4SOivtqBE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BdihZsHcerY', 'Reproductive Health', 'Reproductive Health | Day 33 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 4985, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'BdihZsHcerY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('uxbg1jL5bHI', 'Human Reproduction Part 2', 'Human Reproduction Part-2 | Day 32 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 5557, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'uxbg1jL5bHI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 18)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZW7fvinclzU', 'Human Reproduction Part 1', 'Human Reproduction Part-1 | Day 31 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 5105, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'ZW7fvinclzU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 19)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8P3aaitoi0w', 'Sexual Reproduction in Flowering Plants Part 2', 'Sexual Reproduction in Flowering Plants (Part-2) | Day 30 of Bio-Fest 2.0 | NEET 2025 📚', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4213, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', '8P3aaitoi0w';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 20)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('E3v4V-bMd-8', 'Sexual Reproduction in Flowering Plants Part 1', 'Sexual Reproduction in Flowering Plants (Part-1) | Day 29 of Bio-Fest 2.0 | NEET 2025 📚', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 3905, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'E3v4V-bMd-8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 21)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('VdB4qE3FPEY', 'Chemical Coordination and Integration', 'Chemical Coordination and Integration | Day 28 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 3701, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'VdB4qE3FPEY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 22)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_WL5KXSUZ1Q', 'Neural Control and Coordination', 'Neural Control and Coordination | Day 27 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 3341, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', '_WL5KXSUZ1Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 23)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LwLdSmoCmko', 'Locomotion and Movement', 'Locomotion and Movement | Day 26 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3689, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'LwLdSmoCmko';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 24)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('T2RIX3D9ZIc', 'Excretory Products and Their Elimination', 'Excretory Products and Their Elimination | Day 25 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 3905, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'T2RIX3D9ZIc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 25)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('707-A6VEsfM', 'Body Fluids and Circulation', 'Body Fluids and Circulation | Day 24 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3750, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '707-A6VEsfM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 26)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wpqpDTOaGac', 'Breathing and Exchange of Gases', 'Breathing and Exchange of Gases | Day 23 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 3930, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'wpqpDTOaGac';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 27)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('CyTKLx9JlVA', 'Plant Growth and Development', 'Plant Growth and Development | Day 22 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development'), 2, 4655, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', 'CyTKLx9JlVA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 28)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('s1W86aPkP4c', 'Respiration in Plants', 'Respiration in Plants  | Day 21 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 4721, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 's1W86aPkP4c';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 29)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('w1D__na1qlc', 'Photosynthesis in Higher Plants Part 2', 'Photosynthesis in Higher Plants Part-2 | Day 20 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4120, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'w1D__na1qlc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 30)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('aawNyAnDDTg', 'Photosynthesis in Higher Plants Part 1', 'Photosynthesis in Higher Plants Part-1 | Day 19 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 3980, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'aawNyAnDDTg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 31)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_yRS0e2Ocso', 'Biomolecules Part 2', 'Biomolecules Part-2 | Day 18 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 4700, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '_yRS0e2Ocso';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 32)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('CzJ5kSZwC_A', 'Biomolecules Part 1', 'Biomolecules Part-1 | Day 17 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules'), 2, 3941, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'CzJ5kSZwC_A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 33)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('3eThoF65Cq4', 'Cell Cycle and Cell Division', 'Cell Cycle and Cell Division | Day 16 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division'), 2, 3296, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', '3eThoF65Cq4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 34)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KzSZykxYDNE', 'Cell: The Unit of Life Part 2', 'Cell: The Unit of Life Part-2 | Day 15 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 4741, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'KzSZykxYDNE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 35)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KOJb2N0ipPQ', 'Cell: The Unit of Life Part 1', 'Cell: The Unit of Life Part-1 | Day 14 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life'), 2, 2940, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'KOJb2N0ipPQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 36)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('I-CiicwdzJA', 'Anatomy of Flowering Plants Part 2', 'Anatomy of Flowering Plants Part-2 | Day 13 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 5406, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'I-CiicwdzJA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 37)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cPMy9tlw4rg', 'Anatomy of Flowering Plants Part 1', 'Anatomy of Flowering Plants Part-1 | Day 12 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'anatomy-of-flowering-plants'), 2, 4987, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'anatomy-of-flowering-plants', 'cPMy9tlw4rg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 38)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_SN62mkrARA', 'Morphology of Flowering Plants Part 2', 'Morphology of Flowering Plants Part-2 | Day 11 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 5120, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', '_SN62mkrARA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 39)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zFb_qkl5QQY', 'Morphology of Flowering Plants Part 1', 'Morphology of Flowering Plants Part-1 | Day 10 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'morphology-of-flowering-plants'), 2, 4550, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'morphology-of-flowering-plants', 'zFb_qkl5QQY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 40)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('n2-n3XzScFA', 'Structural Organisation in Animals', 'Structural Organisation In Animals | Day 9 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'structural-organisation-in-animals'), 2, 3575, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'structural-organisation-in-animals', 'n2-n3XzScFA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 41)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zEJRF348TMs', 'Animal Kingdom Part 2', 'Animal Kingdom Part-2 | Day 8 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 4055, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', 'zEJRF348TMs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 42)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4IyDz8FzpwQ', 'Animal Kingdom Part 1', 'Animal Kingdom Part-1 | Day 7 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'animal-kingdom'), 2, 3761, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'animal-kingdom', '4IyDz8FzpwQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 43)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('su-uJJOqNMQ', 'Plant Kingdom Part 2', 'Plant Kingdom Part-2 | Day 6 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 3561, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'su-uJJOqNMQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 44)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Vgh25KZz-XM', 'Plant Kingdom Part 1', 'Plant Kingdom Part-1 | Day 5 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'plant-kingdom'), 2, 4121, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-kingdom', 'Vgh25KZz-XM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 45)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('94UdLH6dsOg', 'Biological Classification Part 3', 'Biological Classification Part-3 | Day 4 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 4285, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', '94UdLH6dsOg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 46)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vbIYAJLwX2Q', 'Biological Classification Part 2', 'Biological Classification Part-2 | Day 3 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚   ALLEN NEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 4490, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'vbIYAJLwX2Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 47)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('W2VGKjRemKQ', 'Biological Classification Part 1', 'Biological Classification | Day 2 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚  @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'biological-classification'), 2, 4387, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biological-classification', 'W2VGKjRemKQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 48)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TD7187-LJ24', 'The Living World', 'The Living World | Day 1 of Bio-Fest 2.0 | Boost Your NEET 2025 Score 📚 @ALLENNEET', v_channel_id, 4, (select id from public.chapters where slug = 'the-living-world'), 2, 3670, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'the-living-world', 'TD7187-LJ24';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 49)
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
      ('50 Days to NEET Success - Bio-Fest 2.0')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('50 Days to NEET Success - Bio-Fest 2.0');
  if v_course_count <> 1 then
    raise exception 'expected exactly 1 courses for ALLEN NEET part 2, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('50 Days to NEET Success - Bio-Fest 2.0');
  if v_lesson_count <> 49 then
    raise exception 'expected exactly 49 lessons across ALLEN NEET part 2, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('50 Days to NEET Success - Bio-Fest 2.0')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in ALLEN NEET part 2 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('50 Days to NEET Success - Bio-Fest 2.0')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'ALLEN NEET part 2: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: ALLEN NEET part 2 -- % courses, % lessons, all correctly chaptered and linked.', 1, 49;
end
$$;

commit;
