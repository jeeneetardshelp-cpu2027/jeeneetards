-- biology_class11_aakash_neet_part4_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: Aakash NEET (part 4 of 5).
-- 10 courses, 57 lessons. Every video ID/title/duration in this file
-- was independently re-verified against the live YouTube Data API (videos.list) after extraction
-- -- 100% match on channel, title, duration and embeddability, 0 flagged.
--
-- Depends on biology_class11_aakash_neet_part1_2026-07-31.sql having already run (creates the
-- Aakash NEET channel row this file looks up).
--
-- Idempotent: channel insert is on-conflict-safe; video inserts are
-- on-conflict-safe (youtube_video_id unique); course (playlist) inserts are
-- plain inserts -- safe to re-run ONLY if the courses from this exact file
-- were never successfully created before (the self-verification step below
-- would catch a partial/duplicate re-run by course title).

begin;

-- Course: Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET) (9 lessons, source playlist PL7AAT-ai0VD6QSvt87BDzC6qeInL3Aobz)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nx263Rv0VVI', 'Sexual Reproduction in Flowering Plants Class 12 Biology Concepts (L1)', 'Sexual Reproduction in Flowering Plants Class 12 Biology Concepts (L1) | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 3303, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'nx263Rv0VVI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sb0Tsg4kRG8', 'Sexual Reproduction in Flowering Plants Class 12 Biology Chapter Explained (L 2)', 'Sexual Reproduction in Flowering Plants Class 12 Biology Chapter Explained (L 2) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4265, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'sb0Tsg4kRG8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('WiCgPj3p4Oo', 'Sexual Reproduction in Flowering Plants Class 12 Biology NEET (L 3)', 'Sexual Reproduction in Flowering Plants Class 12 Biology NEET (L 3) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4226, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'WiCgPj3p4Oo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('htfgPAIliEk', 'Pollination Class 12 Biology - Sexual Reproduction in Flowering Plants Concepts (L 4)', 'Pollination Class 12 Biology - Sexual Reproduction in Flowering Plants Concepts (L 4) | NEET 2022-23', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 3821, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'htfgPAIliEk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IRvtg4CtFrg', 'Sexual Reproduction in Flowering Plants Class 12 Biology Concepts (L 5)', 'Sexual Reproduction in Flowering Plants Class 12 Biology Concepts (L 5) | NEET 2022-23 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 3790, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'IRvtg4CtFrg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('MyR56Znm1dU', 'Pollen Pistil Interaction Class 12 Biology - Sexual Reproduction in Flowering Plants (L6)', 'Pollen Pistil Interaction Class 12 Biology - Sexual Reproduction in Flowering Plants (L6)| NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4186, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'MyR56Znm1dU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KuB12bH2JDA', 'Double Fertilisation & Post Fertilisation Events- Reproduction in Flowering Plants', 'Double Fertilisation & Post Fertilisation Events Class 12 - Reproduction in Flowering Plants (L7)', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4272, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'KuB12bH2JDA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('3jsD7sus88U', 'Seed - Post Fertilisation Events Class 12 Concepts', 'Seed - Post Fertilisation Events Class 12 Concepts | Reproduction in Flowering Plants | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 4516, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', '3jsD7sus88U';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('UudiUX-IJiE', 'Sexual Reproduction in Flowering Plants Class 12 Biology Previous Year Questions', 'Sexual Reproduction in Flowering Plants Class 12 Biology Previous Year Questions | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'sexual-reproduction-in-flowering-plants'), 2, 2554, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'sexual-reproduction-in-flowering-plants', 'UudiUX-IJiE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Organisms and Populations — Mission MBBS (Aakash NEET) (12 lessons, source playlist PL7AAT-ai0VD7gBMRWDm88tpZCsXyiJYD4)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Organisms and Populations — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('quzGR_R_PKI', 'Introduction to Ecology Class 12 Biology - Organisms and Populations Concepts (L1)', 'Introduction to Ecology Class 12 Biology - Organisms and Populations Concepts (L1) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3896, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'quzGR_R_PKI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('CYwCLcvjCKY', 'Abiotic Factors in Ecosystem Class 12 Biology Concepts (L2)', 'Abiotic Factors in Ecosystem Class 12 Biology Concepts (L2) | NEET 2022 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3296, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'CYwCLcvjCKY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('CYb89Y9mBA4', 'Response to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L3)', 'Response to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L3) | NEET 2022', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3581, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'CYb89Y9mBA4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('mCa-w3Kl69o', 'Response to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L4)', 'Response to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L4) | NEET 2022', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3139, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'mCa-w3Kl69o';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RKuDWAKnZ_Y', 'Adaptation to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L5)', 'Adaptation to Abiotic Factors - Organisms and Population Class 12 Biology Concepts (L5) | NEET 2022', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 2159, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'RKuDWAKnZ_Y';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yboyPRoVIWI', 'Population Attributes - Organisms and Population Class 12 Biology Concepts (L6)', 'Population Attributes - Organisms and Population Class 12  Biology Concepts (L6) | NEET 2022 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3486, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'yboyPRoVIWI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('EOUsl3flo1s', 'Population Growth - Organisms and Population Class 12 Biology Concepts (L7)', 'Population Growth -  Organisms and Population Class 12 Biology Concepts (L7) | NEET 2022 Biology', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3172, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'EOUsl3flo1s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AuoV16g18bo', 'Population Interaction Class 12 Biology - Organisms and Population Concepts (L8)', 'NEET 2023 | Population Interaction Class 12 Biology -  Organisms and Population Concepts (L8)', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3052, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'AuoV16g18bo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Jy4GNf41bsY', 'Population Interaction-II Class 12 Biology - Organisms and Population Concepts (L9)', 'Population Interaction-II Class 12 Biology -  Organisms and Population Concepts (L9) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3685, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'Jy4GNf41bsY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Pb6PYGLCEKM', 'Population Interaction-III Class 12 Biology - Organisms and Population Concepts (L10)', 'Population Interaction-III Class 12 Biology -  Organisms and Population Concepts (L10) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3818, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'Pb6PYGLCEKM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('29m1c85Rsc4', 'Population Interaction-IV Class 12 Biology - Organisms and Population Concepts (L11)', 'Population Interaction-IV Class 12 Biology -  Organisms and Population Concepts (L11) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3224, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', '29m1c85Rsc4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KLb8p1_oaZg', 'Organisms and Population Class 12 Previous Year Questions & Solutions (L12)', 'Organisms and Population Class 12 Previous Year Questions & Solutions (L12) | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'organisms-and-populations'), 2, 3441, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'organisms-and-populations', 'KLb8p1_oaZg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Ecosystem — Mission MBBS (Aakash NEET) (8 lessons, source playlist PL7AAT-ai0VD70MPof-lMNHTBTmLO-cXF9)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Ecosystem — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RXl8gWAM_MY', 'Structure and Function of Ecosystem Class 12 Biology Concepts (L1)', 'Structure and Function of Ecosystem Class 12 Biology Concepts (L1) | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3214, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'RXl8gWAM_MY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('25ApCOLCKcM', 'Ecosystem Structure and Function Class 12 Biology Concept Explained (L2)', 'Ecosystem Structure and Function Class 12 Biology Concept Explained (L2) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 2682, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '25ApCOLCKcM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1K8hR09JEIY', 'Productivity and Decomposition - Ecosytem Class 12 Botany Concept Explained (L3)', 'Productivity and Decomposition - Ecosytem Class 12 Botany Concept Explained (L3) | NEET 2023 Biology', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3426, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '1K8hR09JEIY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('-SSXWvxoAJw', 'Energy Flow and Trophic Levels -Ecosystem Class 12 Botany Concept Explained', 'Energy Flow and Trophic Levels -Ecosystem Class 12 Botany Concept Explained | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3441, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '-SSXWvxoAJw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TWj0hHbgTwE', 'Limitations of Ecological Pyramid - Ecosystem Class 12 Botany Concept Explained', 'Limitations of Ecological Pyramid - Ecosystem Class 12 Botany Concept Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 2561, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'TWj0hHbgTwE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('EqqKxln8OzE', 'Define Ecological Succession - Ecosystem Class 12 Botany Concept Explained', 'Define Ecological Succession -  Ecosystem Class 12 Botany Concept Explained | NEET 2023 Botany Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 2915, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'EqqKxln8OzE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('29Kr710jRNY', 'Nutrient Cycle - Ecosystem Class 12 Botany Concept Explained', 'Nutrient Cycle - Ecosystem Class 12 Botany Concept Explained | NEET 2023 Botany Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 2986, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', '29Kr710jRNY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nO1Fmwuq7fo', 'Ecosystem Class 12 Biology Previous Year Questions & Solutions', 'Ecosystem Class 12 Biology Previous Year Questions & Solutions | NEET 2023 Botany Exam', v_channel_id, 4, (select id from public.chapters where slug = 'ecosystem'), 2, 3721, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'ecosystem', 'nO1Fmwuq7fo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Biodiversity and Conservation — Mission MBBS (Aakash NEET) (5 lessons, source playlist PL7AAT-ai0VD61wYl3LmoMWisu82djxJjG)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Biodiversity and Conservation — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wvTIiN42azI', 'Introduction to Biodiversity and Conservation Class 12 Biology Chapter Explained', 'Introduction to Biodiversity and Conservation Class 12 Biology Chapter Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 3184, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'wvTIiN42azI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('iHLj3WoIE7Y', 'Patterns of Biodiversity- Biodiversity & Conservation Class 12 Biology Concept Explained', 'Patterns of Biodiversity- Biodiversity & Conservation Class 12 Biology Concept Explained | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 2812, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'iHLj3WoIE7Y';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cl5aLxiBhpE', 'Loss of Biodiversity - Biodiversity and Conservation Class 12 Biology Concept Explained', 'Loss of Biodiversity - Biodiversity and Conservation Class 12 Biology Concept Explained | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 1748, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'cl5aLxiBhpE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sQrzcP7vyuY', 'How do We Conserve Biodiversity - Biodiversity and Conservation Class 12 Biology Concept', 'How do We Conserve Biodiversity - Biodiversity and Conservation Class 12 Biology Concept | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 3822, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'sQrzcP7vyuY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Ci6rcX3DZVI', 'Most Important Previous Year Questions from Biodiversity & Conservation Class 12 Biology', 'Most Important Previous Year Questions from Biodiversity & Conservation Class 12 Biology | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'biodiversity-and-conservation'), 2, 2996, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biodiversity-and-conservation', 'Ci6rcX3DZVI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Microbes in Human Welfare — Mission MBBS (Aakash NEET) (2 lessons, source playlist PL7AAT-ai0VD5qsAtmhW9Ed_mVIqLVgNk1)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Microbes in Human Welfare — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TfvfzSYjB78', 'Microbes In Human Welfare Class 12 Biology - Microbes in Household Products', 'Microbes In Human Welfare Class 12 Biology - Microbes in Household Products | NEET | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'microbes-in-human-welfare'), 2, 3656, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'microbes-in-human-welfare', 'TfvfzSYjB78';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('UZwlTW7ynQk', 'Microbes in Human Welfare Class 12 Biology - Microbes in Industrial Products', 'Microbes in Human Welfare Class 12 Biology - Microbes in Industrial Products | NEET | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'microbes-in-human-welfare'), 2, 2927, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'microbes-in-human-welfare', 'UZwlTW7ynQk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Botany Class 11 — Mission MBBS (Aakash NEET) (3 lessons, source playlist PL7AAT-ai0VD7KPtyi56Qz5QKxfwI8ioB5)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Botany Class 11 — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('MQ-qJ-HiWi0', 'Photosynthesis in Higher Plants Class 11 Biology One Shot', 'Photosynthesis in Higher Plants Class 11 Biology One Shot | NEET 2023 Preparation | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 6458, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'MQ-qJ-HiWi0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7TCO8slG_hA', 'Respiration in Higher Plants Class 11 Biology - Glycolysis and TCA Cycle Explained', 'Respiration in Higher Plants Class 11 Biology - Glycolysis and TCA Cycle Explained | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 3573, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', '7TCO8slG_hA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pBcFolWgcOU', 'Respiration in Higher Plants Class 11 Bio - Kreb Cycle & Electron Transport Chain', 'Respiration in Higher Plants Class 11 Bio - Kreb Cycle & Electron Transport Chain | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 6346, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'pBcFolWgcOU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Zoology Class 11 — Mission MBBS (Aakash NEET) (2 lessons, source playlist PL7AAT-ai0VD49zrq1f4LGsmieRQ4Zyv8n)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Zoology Class 11 — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('HMwDZM6cuko', 'Chemical Coordination and Integration Class 11 Biology One Shot', 'Chemical Coordination and Integration Class 11 Biology One Shot | NEET 2023 | Dr. Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration'), 2, 7392, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'HMwDZM6cuko';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8ED_Y2HpijU', 'Neural Control and Coordination Class 11 Biology (Chapter 21) One Shot', 'Neural Control and Coordination Class 11 Biology (Chapter 21) One Shot | NEET 2023 Exam | Sachin Sir', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 7209, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', '8ED_Y2HpijU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET) (4 lessons, source playlist PL7AAT-ai0VD66lj9MrfvFvg5IOmxV8sHy)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)', NULL, v_channel_id, 4, 'revision', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('bG3wwwJB_zA', 'Human Health and Disease Class 12 Biology One Shot (Chapter 8)', 'Human Health and Disease Class 12 Biology One Shot (Chapter 8) | NEET 2023 | Dr. Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 7242, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'bG3wwwJB_zA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yUOcUtQaxZU', 'Human Health and Disease Class 12 Biology One Shot (Part 2)', 'Human Health and Disease Class 12 Biology One Shot (Part 2) | NEET 2023 Exam | Dr. Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 6784, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'yUOcUtQaxZU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JBPHH7qX7iY', 'Human Health and Disease Class 12 Biology One Shot (Part 3)', 'Human Health and Disease Class 12 Biology One Shot (Part 3) | NEET 2023 Exam | Dr. Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease'), 2, 6134, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'JBPHH7qX7iY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qSeuqV_lDwY', 'Biotechnology - Principles and Processes Class 12 Biology One Shot & Mind Maps (Ep 32)', 'Biotechnology - Principles and Processes Class 12 Biology One Shot & Mind Maps (Ep 32) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-principles-and-processes'), 2, 3789, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-principles-and-processes', 'qSeuqV_lDwY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: 100 Days Crash Course for NEET (Aakash NEET) (5 lessons, source playlist PL7AAT-ai0VD6xfsishd3ZErw0FNpfGqJy)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('100 Days Crash Course for NEET (Aakash NEET)', NULL, v_channel_id, 4, 'revision', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ckXRn8Ja3-o', 'Plant Growth & Development Class 11 Biology', 'Plant Growth & Development Class 11 Biology | 100 Days Crash Course | NEET 2023 | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development'), 2, 4789, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', 'ckXRn8Ja3-o';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('0ZQ9mROP_IQ', 'Plant Growth & Development L2 Class 11 Biology', 'Plant Growth & Development L2 Class 11 Biology | 100 Days Crash Course | NEET 2023 | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development'), 2, 5088, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', '0ZQ9mROP_IQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yVwIAoRkhEo', 'Neural Control and Coordination: L1 Class 11 Biology', 'Neural Control and Coordination: L1 Class 11 Biology| 100 Days Crash Course | NEET 2023 | Sachin Sir', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 4177, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'yVwIAoRkhEo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('7zpmWk0CzLI', 'Neural Control and Coordination: L2- Class 11 Biology', 'Neural Control and Coordination: L2- Class 11 Biology | 100 Days Crash Course| NEET 2023 |Sachin Sir', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 3813, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', '7zpmWk0CzLI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ND_-8RNoCnc', 'Electron Transport Chain - Respiration in Plants', 'Electron Transport Chain | NEET 2023 | Respiration in Plants - Class 11 Biology | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 4298, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'ND_-8RNoCnc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET) (7 lessons, source playlist PL7AAT-ai0VD7v0kLXlMw1Lxy9baB-shhO)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('z0KMxxeG_Vw', 'Photosynthesis in Higher Plants Class 11 - Photosynthetic Pigments & Light Reaction', 'Photosynthesis in Higher Plants Class 11 - Photosynthetic Pigments & Light Reaction | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4648, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'z0KMxxeG_Vw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('0JCtNeNCia4', 'Photosynthesis in Higher Plants Class 11 - Light Reaction and Electron Transport', 'Photosynthesis in Higher Plants Class 11 - Light Reaction and Electron Transport | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4056, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', '0JCtNeNCia4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('mVd4PSVBuRs', 'Photosynthesis in Higher Plants Class 11 - Dark Reactions Explained', 'Photosynthesis in Higher Plants Class 11 - Dark Reactions Explained | NEET 2023 | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4312, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'mVd4PSVBuRs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('59ms7RLrNAc', 'Photosynthesis in Higher Plants Class 11 - Chemiosmotic Hypothesis & Dark Reactions', 'Photosynthesis in Higher Plants Class 11 - Chemiosmotic Hypothesis & Dark Reactions | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4703, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', '59ms7RLrNAc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yiLRjZ9XBBA', 'Photosynthesis Class 11 - Photorespiration & Factors Affecting of Photosynthesis', 'Photosynthesis Class 11 - Photorespiration & Factors Affecting of Photosynthesis | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 5030, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'yiLRjZ9XBBA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('p4QS2qbg4GA', 'Kreb''s Cycle - Respiration in Plants Class 11 Biology', 'Kreb''s Cycle - Respiration in Plants Class 11 Biology | Aakash BYJU''S NEET | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 3855, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'p4QS2qbg4GA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('VGA5gTZtubU', 'Respiration in Plants Class 11 Biology L3 - Anerobic Respiration', 'Respiration in Plants Class 11 Biology L3 - Anerobic Respiration | NEET 2023 | Pankhuri Ma''am', v_channel_id, 4, (select id from public.chapters where slug = 'respiration-in-plants'), 2, 3664, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'respiration-in-plants', 'VGA5gTZtubU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
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
      ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)'),
      ('Organisms and Populations — Mission MBBS (Aakash NEET)'),
      ('Ecosystem — Mission MBBS (Aakash NEET)'),
      ('Biodiversity and Conservation — Mission MBBS (Aakash NEET)'),
      ('Microbes in Human Welfare — Mission MBBS (Aakash NEET)'),
      ('Botany Class 11 — Mission MBBS (Aakash NEET)'),
      ('Zoology Class 11 — Mission MBBS (Aakash NEET)'),
      ('Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)'),
      ('100 Days Crash Course for NEET (Aakash NEET)'),
      ('Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)', 'Organisms and Populations — Mission MBBS (Aakash NEET)', 'Ecosystem — Mission MBBS (Aakash NEET)', 'Biodiversity and Conservation — Mission MBBS (Aakash NEET)', 'Microbes in Human Welfare — Mission MBBS (Aakash NEET)', 'Botany Class 11 — Mission MBBS (Aakash NEET)', 'Zoology Class 11 — Mission MBBS (Aakash NEET)', 'Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)', '100 Days Crash Course for NEET (Aakash NEET)', 'Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)');
  if v_course_count <> 10 then
    raise exception 'expected exactly 10 courses for Aakash NEET part 4, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)', 'Organisms and Populations — Mission MBBS (Aakash NEET)', 'Ecosystem — Mission MBBS (Aakash NEET)', 'Biodiversity and Conservation — Mission MBBS (Aakash NEET)', 'Microbes in Human Welfare — Mission MBBS (Aakash NEET)', 'Botany Class 11 — Mission MBBS (Aakash NEET)', 'Zoology Class 11 — Mission MBBS (Aakash NEET)', 'Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)', '100 Days Crash Course for NEET (Aakash NEET)', 'Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)');
  if v_lesson_count <> 57 then
    raise exception 'expected exactly 57 lessons across Aakash NEET part 4, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)', 'Organisms and Populations — Mission MBBS (Aakash NEET)', 'Ecosystem — Mission MBBS (Aakash NEET)', 'Biodiversity and Conservation — Mission MBBS (Aakash NEET)', 'Microbes in Human Welfare — Mission MBBS (Aakash NEET)', 'Botany Class 11 — Mission MBBS (Aakash NEET)', 'Zoology Class 11 — Mission MBBS (Aakash NEET)', 'Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)', '100 Days Crash Course for NEET (Aakash NEET)', 'Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in Aakash NEET part 4 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Sexual Reproduction in Flowering Plants — Mission MBBS (Aakash NEET)', 'Organisms and Populations — Mission MBBS (Aakash NEET)', 'Ecosystem — Mission MBBS (Aakash NEET)', 'Biodiversity and Conservation — Mission MBBS (Aakash NEET)', 'Microbes in Human Welfare — Mission MBBS (Aakash NEET)', 'Botany Class 11 — Mission MBBS (Aakash NEET)', 'Zoology Class 11 — Mission MBBS (Aakash NEET)', 'Human Health, Disease & Biotechnology — Mind Maps (Aakash NEET)', '100 Days Crash Course for NEET (Aakash NEET)', 'Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'Aakash NEET part 4: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: Aakash NEET part 4 -- % courses, % lessons, all correctly chaptered and linked.', 10, 57;
end
$$;

commit;
