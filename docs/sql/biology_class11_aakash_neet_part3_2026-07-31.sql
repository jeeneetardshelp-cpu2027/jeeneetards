-- biology_class11_aakash_neet_part3_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: Aakash NEET (part 3 of 5).
-- 5 courses, 52 lessons. Every video ID/title/duration in this file
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

-- Course: Human Reproduction — Mission MBBS (Aakash NEET) (17 lessons, source playlist PL7AAT-ai0VD5RAQBd3toPnnmm2MzrbbCO)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Human Reproduction — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('NzGj3eEXzCQ', 'Male Reproductive System Class 12 Biology - Human Reproduction Concepts (L 1)', 'Male Reproductive System Class 12 Biology - Human Reproduction Concepts (L 1) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3285, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'NzGj3eEXzCQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wdARwcQhEIQ', 'Human Reproduction Class 12 Biology Concepts (L 2)', 'Human Reproduction Class 12 Biology Concepts (L 2) | NEET Zoology 2023 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3252, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'wdARwcQhEIQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pRv7Jq8CpA4', 'Accessory Ducts and Glands Class 12 Biology Concepts - Human Reproduction (L 3)', 'Accessory Ducts and Glands Class 12 Biology Concepts - Human Reproduction (L 3) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3266, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'pRv7Jq8CpA4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('JZvj5IvqqUg', 'Female Reproductive System Class 12 Biology - Human Reproduction Concepts (L 4)', 'Female Reproductive System Class 12 Biology - Human Reproduction Concepts (L 4) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3187, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'JZvj5IvqqUg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('QHgiVN4e8qQ', 'Oogenesis Class 12 Biology - Human Reproduction Concepts (L 5)', 'Oogenesis Class 12 Biology - Human Reproduction Concepts (L 5) | NEET Zoology 2023 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3431, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'QHgiVN4e8qQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1yKj4npbjfA', 'Human Reproduction Class 12 Biology Concepts (L 6)', 'Human Reproduction Class 12 Biology Concepts (L 6) | NEET Zoology | NEET 2023 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3306, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', '1yKj4npbjfA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('oYbnKtx2vYc', 'Fertilisation Class 12 Biology NEET - Human Reproduction Concepts (L 7)', 'Fertilisation Class 12 Biology NEET - Human Reproduction Concepts (L 7) | NEET Zoology 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3384, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'oYbnKtx2vYc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('uWQI0X9NeW4', 'NEET 2023 - Human Reproduction Class 12 Biology Concepts (L 8)', 'NEET 2023 - Human Reproduction Class 12 Biology Concepts (L 8) | NEET Zoology 2023 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3275, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'uWQI0X9NeW4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dhWzA9JnbCo', 'Pregnancy and Embryonic Development Class 12 Biology Concepts - Human Reproduction (L9)', 'Pregnancy and Embryonic Development Class 12 Biology Concepts - Human Reproduction (L9) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 2870, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'dhWzA9JnbCo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('v_yR7xEcpqI', 'Parturition Class 12 Biology (Childbirth) - Human Reproduction Concepts (L10)', 'Parturition Class 12 Biology (Childbirth) - Human Reproduction Concepts (L10) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3153, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'v_yR7xEcpqI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('OPkzhU6PsIk', 'How Twins are Formed - Human Reproduction Class 12 Biology Concepts (L 11)', 'How Twins are Formed - Human Reproduction Class 12 Biology Concepts (L 11) | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 2804, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'OPkzhU6PsIk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LQW-FzpKPMk', 'Fetal Circulation and Afterbirth Modifications - Human Reproduction Concepts', 'Fetal Circulation and Afterbirth Modifications - Human Reproduction Class 12 Biology Concepts (L12)', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3135, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'LQW-FzpKPMk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tNckVc91A7c', 'Lactation - Human Reproduction Class 12 Biology Concepts (L13)', 'Lactation - Human Reproduction Class 12 Biology Concepts (L13) | NEET 2022 Zoology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3120, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'tNckVc91A7c';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('5UdseWXiqtk', 'Menstrual Cycle Class 12 Biology - Human Reproduction Concepts (L14)', 'Menstrual Cycle Class 12 Biology - Human Reproduction Concepts (L14) | NEET 2023 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3574, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', '5UdseWXiqtk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 14)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Wic9jiEl8zk', 'Top 10 Important Questions from Human Reproduction Class 12 Biology (Botany)', 'Top 10 Important Questions from Human Reproduction Class 12 Biology (Botany) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 2746, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'Wic9jiEl8zk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('X8q9Z2G-Kfs', 'Top 10 Important Questions from Human Reproduction Class 12 Biology', 'Top 10 Important Questions from Human Reproduction Class 12 Biology | NEET 2023 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3298, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', 'X8q9Z2G-Kfs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 16)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4sRkjeV36gY', 'Human Reproduction Menstrual Cycle and Fertilization NEET 2024', 'Human Reproduction Menstrual Cycle and Fertilization NEET 2024 | Sachin Sir #neet #neet2023', v_channel_id, 4, (select id from public.chapters where slug = 'human-reproduction'), 2, 3952, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-reproduction', '4sRkjeV36gY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 17)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Reproductive Health — Mission MBBS (Aakash NEET) (8 lessons, source playlist PL7AAT-ai0VD6N8iJ2FoBVoM_cvciJ1Rl-)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Reproductive Health — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rSdSidoUY2s', 'Introduction to Reproductive Health Class 12 Biology (Zoology) Chapter Explained', 'Introduction to Reproductive Health Class 12 Biology (Zoology) Chapter Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 3230, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'rSdSidoUY2s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('EsjNViQ4DIU', 'Contraceptive Methods - Reproductive Health Class 12 Biology (Zoology) Concepts', 'Contraceptive Methods - Reproductive Health Class 12 Biology (Zoology) Concepts | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 3268, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'EsjNViQ4DIU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('H1d9HUHrZoQ', 'Hormonal Contraceptives - Reproductive Health Class 12 Biology Concepts (L3)', 'Hormonal Contraceptives - Reproductive Health Class 12 Biology Concepts (L3) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 3392, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'H1d9HUHrZoQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('PnqrSl1Jkhk', 'MTP and STD''s - Reproductive Health Class 12 Biology Concept Explained (L4)', 'MTP and STD''s - Reproductive Health Class 12 Biology Concept Explained (L4) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 2944, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'PnqrSl1Jkhk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('-YCDaTW6LOM', 'Acquired Immune Deficiency Syndrome (AIDS) Class 12 Biology - Reproductive Health (L5)', 'Acquired Immune Deficiency Syndrome (AIDS) Class 12 Biology - Reproductive Health (L5) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 3700, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', '-YCDaTW6LOM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('rjbXpM0QS30', 'Infertility & Assisted Reproductive Technologies (ART) Class 12 Biology Concepts (L6)', 'Infertility & Assisted Reproductive Technologies (ART) Class 12 Biology Concepts (L6) | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 2987, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'rjbXpM0QS30';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ShsNGuFMGwo', 'Reproductive Health Class 12 Biology MCQs & Questions Solved L7 (Chapter 4)', 'Reproductive Health Class 12 Biology MCQs & Questions Solved L7 (Chapter 4) | NEET 2023 Biology', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 2986, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'ShsNGuFMGwo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IjgtsM59f6M', '10 Most Important Questions from Reproductive Health Class 12 Biology', '10 Most Important Questions from Reproductive Health Class 12 Biology | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'reproductive-health'), 2, 2863, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'reproductive-health', 'IjgtsM59f6M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Principles of Inheritance and Variation — Mission MBBS (Aakash NEET) (13 lessons, source playlist PL7AAT-ai0VD5GhA0CmphZzoHQA10vQEtt)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nw6DgUpFq7M', 'Introduction to Genetics - Principles of Inheritance & Variation Concept Explained', 'Introduction to Genetics Class 12 Biology - Principles of Inheritance & Variation Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2839, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'nw6DgUpFq7M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XYCwzz_K_9k', 'Mendel''s Experiments - Principles of Inheritance and Variations Class 12 Biology', 'Mendel''s Experiments - Principles of Inheritance and Variations Class 12  Biology | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2887, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'XYCwzz_K_9k';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fi-ELUV_MF4', 'Monohybrid and Dihybrid Cross - Principles of Inheritance and Variations Class 12 Biology', 'Monohybrid and Dihybrid Cross - Principles of Inheritance and Variations Class 12 Biology (L3)', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2702, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'fi-ELUV_MF4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1JlUfDovez8', 'Laws of Inheritance - Principles of Inheritance and Variation Class 12 Biology Concepts', 'Laws of Inheritance - Principles of Inheritance and Variation Class 12 Biology Concepts | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3437, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', '1JlUfDovez8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('wmg-h2XTiyQ', 'Incomplete Dominance & Codominance - Principles of Inheritance & Variation Concept', 'Incomplete Dominance & Codominance - Principles of Inheritance & Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3195, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'wmg-h2XTiyQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XRGtE4YzwSc', 'Multiple Alleles & Lethal Genes - Principles of Inheritance and Variation Concept', 'Multiple Alleles & Lethal Genes - Principles of Inheritance and Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3539, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'XRGtE4YzwSc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('oqLamGHrdjw', 'Pleiotropy & Polygenic Inheritance - Principles of Inheritance & Variation Concept', 'Pleiotropy & Polygenic Inheritance - Principles of Inheritance & Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2775, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'oqLamGHrdjw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pR_tDI1U64M', 'Sex Determination in Humans - Principles of Inheritance & Variation Concept', 'Sex Determination in Humans - Principles of Inheritance & Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3643, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'pR_tDI1U64M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hN3vFaVrA2g', 'Sex Determination in Animals - Principles of Inheritance & Variation Concept', 'Sex Determination in Animals - Principles of Inheritance & Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2188, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'hN3vFaVrA2g';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('vl5z8rHwAfM', 'Chromosomal Theory of Inheritance - Principles of Inheritance & Variation Concept', 'Chromosomal Theory of Inheritance - Principles of Inheritance & Variation Class 12 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3059, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'vl5z8rHwAfM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('q6q1NcUUZCo', 'Human Genetic Disorders (Chromosomal Disorders) - Principles of Inheritance & Variation', 'Human Genetic Disorders (Chromosomal Disorders) - Principles of Inheritance & Variation Class 12', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2697, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'q6q1NcUUZCo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 11)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('c433WWv2haA', 'Human Genetic Disorders -I (Mendelian) - Principles of Inheritance & Variation Class 12', 'Human Genetic Disorders -I (Mendelian) - Principles of Inheritance & Variation Class 12 | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 3429, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'c433WWv2haA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 12)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zNbUG_FH_t8', 'Human Genetic Disorders II (Mendelian) - Principles of Inheritance & Variation Class 12', 'Human Genetic Disorders II (Mendelian) - Principles of Inheritance & Variation Class 12 | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'principles-of-inheritance-and-variation'), 2, 2681, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'principles-of-inheritance-and-variation', 'zNbUG_FH_t8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 13)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Molecular Basis of Inheritance — Mission MBBS (Aakash NEET) (10 lessons, source playlist PL7AAT-ai0VD4hKlaktk0pBEeN8mJL-HmY)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('zIUvu7wlkPo', 'Introduction to Molecular Basis of Inheritance Class 12 Biology Chapter Explained', 'Introduction to Molecular Basis of Inheritance Class 12 Biology Chapter Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3388, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'zIUvu7wlkPo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('jzy_3q6Pl0k', 'Search for Genetic Material - Molecular Basis of Inheritance Class 12 Biology Chapter', 'Search for Genetic Material - Molecular Basis of Inheritance Class 12 Biology Chapter | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 2903, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'jzy_3q6Pl0k';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('3934GfdSnEY', 'DNA Replication - Molecular Basis of Inheritance Class 12 Biology (P-1) (Zoology)', 'DNA Replication - Molecular Basis of Inheritance Class 12 Biology (P-1) (Zoology)  | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 2610, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', '3934GfdSnEY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('3C_aXKLCnQE', 'DNA Replication - Molecular Basis of Inheritance Class 12 Biology (P-2) (Zoology)', 'DNA Replication - Molecular Basis of Inheritance Class 12 Biology (P-2) (Zoology) | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 2387, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', '3C_aXKLCnQE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nGPjWzPHz_U', 'Transcription (mRNA Synthesis) - Molecular Basis of Inheritance Class 12 Biology Concept', 'Transcription (mRNA Synthesis) - Molecular Basis of Inheritance Class 12 Biology Concept | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3285, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'nGPjWzPHz_U';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cHJyP0jDTQc', 'Transcription (mRNA Synthesis-II) - Molecular Basis of Inheritance Concepts', 'Transcription (mRNA Synthesis-II) - Molecular Basis of Inheritance Class 12 Biology Concepts', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 2632, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'cHJyP0jDTQc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gXFIfDGfYB4', 'Translation (Pt 1) - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept', 'Translation (Pt 1) - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 2928, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'gXFIfDGfYB4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RH6wwdkdy9s', 'Translation (Pt 2) - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept', 'Translation (Pt 2) - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept | NEET 2023', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3164, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'RH6wwdkdy9s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('MpcpcNi-6QA', 'Lac Operon - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept', 'Lac Operon - Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3269, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'MpcpcNi-6QA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 9)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('VhaDC_qXMEs', 'Top MCQs from Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept', 'Top MCQs from Molecular Basis of Inheritance Class 12 Biology (Zoology) Concept | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'molecular-basis-of-inheritance'), 2, 3096, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'molecular-basis-of-inheritance', 'VhaDC_qXMEs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 10)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Evolution — Mission MBBS (Aakash NEET) (4 lessons, source playlist PL7AAT-ai0VD7fcmojA-1x3zDR2oVlUi05)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Evolution — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('baX3xvXore8', 'Origin of Life - Evolution Class 12 Biology (Zoology) Concept Explained', 'Origin of Life - Evolution Class 12 Biology (Zoology) Concept Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 3027, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'baX3xvXore8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('EnkTHBAdY5A', 'Evidences in Favour of Evolution - Evolution Class 12 Biology Concept Explained', 'Evidences in Favour of Evolution - Evolution Class 12 Biology Concept Explained | NEET 2023 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 2787, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'EnkTHBAdY5A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('DXTVcW55VRY', 'Evolution Class 12 Biology: Evidences in Favour of Evolution (Pt 2) Concept', 'Evolution Class 12 Biology: Evidences in Favour of Evolution (Pt 2) Concept | NEET | Dr Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 3158, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'DXTVcW55VRY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('NQwLJnctVAk', 'Evolution Class 12 Biology Concept Explained - Lamarckism', 'Evolution Class 12 Biology Concept Explained - Lamarckism | NEET 2023 Exam | Dr. sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'evolution'), 2, 3392, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'evolution', 'NQwLJnctVAk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
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
      ('Human Reproduction — Mission MBBS (Aakash NEET)'),
      ('Reproductive Health — Mission MBBS (Aakash NEET)'),
      ('Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)'),
      ('Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)'),
      ('Evolution — Mission MBBS (Aakash NEET)')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Human Reproduction — Mission MBBS (Aakash NEET)', 'Reproductive Health — Mission MBBS (Aakash NEET)', 'Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)', 'Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)', 'Evolution — Mission MBBS (Aakash NEET)');
  if v_course_count <> 5 then
    raise exception 'expected exactly 5 courses for Aakash NEET part 3, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Human Reproduction — Mission MBBS (Aakash NEET)', 'Reproductive Health — Mission MBBS (Aakash NEET)', 'Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)', 'Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)', 'Evolution — Mission MBBS (Aakash NEET)');
  if v_lesson_count <> 52 then
    raise exception 'expected exactly 52 lessons across Aakash NEET part 3, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Human Reproduction — Mission MBBS (Aakash NEET)', 'Reproductive Health — Mission MBBS (Aakash NEET)', 'Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)', 'Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)', 'Evolution — Mission MBBS (Aakash NEET)')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in Aakash NEET part 3 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Human Reproduction — Mission MBBS (Aakash NEET)', 'Reproductive Health — Mission MBBS (Aakash NEET)', 'Principles of Inheritance and Variation — Mission MBBS (Aakash NEET)', 'Molecular Basis of Inheritance — Mission MBBS (Aakash NEET)', 'Evolution — Mission MBBS (Aakash NEET)')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'Aakash NEET part 3: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: Aakash NEET part 3 -- % courses, % lessons, all correctly chaptered and linked.', 5, 52;
end
$$;

commit;
