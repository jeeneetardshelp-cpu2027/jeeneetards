-- biology_class11_aakash_neet_part5_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: Aakash NEET (part 5 of 5).
-- 2 courses, 9 lessons. Every video ID/title/duration in this file
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

-- Course: Boost Your Biology — Important Questions (Aakash NEET) (6 lessons, source playlist PL7AAT-ai0VD7j6dPnMLeaPve-peqN-kQs)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Boost Your Biology — Important Questions (Aakash NEET)', NULL, v_channel_id, 4, 'revision', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('e0VBikbOTek', 'Chemical Coordination and Integration Class 11 Biology Chapter 22', 'Chemical Coordination and Integration Class 11 Biology Chapter 22 | NEET 2022 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'chemical-coordination-and-integration' and subject_id = 4), 2, 3084, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'chemical-coordination-and-integration', 'e0VBikbOTek';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gU22h1fl1gQ', 'Neural Control and Coordination Class 11 Biology', 'Neural Control and Coordination Class 11 Biology | NEET Biology Important Chapters | NEET 2022', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination' and subject_id = 4), 2, 2872, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'gU22h1fl1gQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('b3ZzNfmoz0g', 'Plant Growth and Development Class 11 Biology Important Questions (Ep 20)', 'Plant Growth and Development Class 11 Biology Important Questions (Ep 20) | NEET 2022 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'plant-growth-and-development' and subject_id = 4), 2, 3176, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'plant-growth-and-development', 'b3ZzNfmoz0g';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('Hm60vL7W53Q', 'Human Health and Disease Class 12 Biology Most Important Questions (Ep 29)', 'Human Health and Disease Class 12 Biology Most Important Questions (Ep 29) | NEET Zoology 2022', v_channel_id, 4, (select id from public.chapters where slug = 'human-health-and-disease' and subject_id = 4), 2, 3226, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'human-health-and-disease', 'Hm60vL7W53Q';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('m9S8ufni-Vs', 'Biotechnology - Principles and Processes Class 12 Biology Important Question Ch 11 Ep 38', 'Biotechnology - Principles and Processes Class 12 Biology Important Question Ch 11 Ep 38 | NEET 2022', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-principles-and-processes' and subject_id = 4), 2, 2704, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-principles-and-processes', 'm9S8ufni-Vs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2N6zobmYFIg', 'Biotechnology and it''s Application Class 12 Biology Important Questions (Ep 40)', 'Biotechnology and it''s Application Class 12 Biology Important Questions (Ep 40) | NEET 2022 Strategy', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-and-its-applications' and subject_id = 4), 2, 2740, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-and-its-applications', '2N6zobmYFIg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: NEET 2025 Live Crash Course (Aakash NEET) (3 lessons, source playlist PL7AAT-ai0VD5Y0uwNNCycuOMYq5bIk1de)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('NEET 2025 Live Crash Course (Aakash NEET)', NULL, v_channel_id, 4, 'revision', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KD_-WYK-oqo', 'Biotechnology & Its Applications', 'NEET 2025  Crash Course | Biotechnology & Its Applications | Zoology Class 3', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-and-its-applications' and subject_id = 4), 2, 7125, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-and-its-applications', 'KD_-WYK-oqo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BIe-lU-XL0A', 'Biotechnology: Principles & Processes', 'NEET 2025 Crash Course | Biotechnology: Principles & Processes | NEET Preparation by Aakash', v_channel_id, 4, (select id from public.chapters where slug = 'biotechnology-principles-and-processes' and subject_id = 4), 2, 10785, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biotechnology-principles-and-processes', 'BIe-lU-XL0A';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('a9VrBD1AErM', 'Photosynthesis in Higher Plants', 'NEET 2025 Crash Course | Photosynthesis in Higher Plants | Botany Class 03', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants' and subject_id = 4), 2, 8585, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'a9VrBD1AErM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
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
      ('Boost Your Biology — Important Questions (Aakash NEET)'),
      ('NEET 2025 Live Crash Course (Aakash NEET)')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Boost Your Biology — Important Questions (Aakash NEET)', 'NEET 2025 Live Crash Course (Aakash NEET)');
  if v_course_count <> 2 then
    raise exception 'expected exactly 2 courses for Aakash NEET part 5, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Boost Your Biology — Important Questions (Aakash NEET)', 'NEET 2025 Live Crash Course (Aakash NEET)');
  if v_lesson_count <> 9 then
    raise exception 'expected exactly 9 lessons across Aakash NEET part 5, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Boost Your Biology — Important Questions (Aakash NEET)', 'NEET 2025 Live Crash Course (Aakash NEET)')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in Aakash NEET part 5 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Boost Your Biology — Important Questions (Aakash NEET)', 'NEET 2025 Live Crash Course (Aakash NEET)')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'Aakash NEET part 5: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: Aakash NEET part 5 -- % courses, % lessons, all correctly chaptered and linked.', 2, 9;
end
$$;

commit;
