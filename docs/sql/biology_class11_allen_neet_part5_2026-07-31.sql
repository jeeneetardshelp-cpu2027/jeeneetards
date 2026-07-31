-- biology_class11_allen_neet_part5_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: ALLEN NEET (part 5 of 5).
-- 2 courses, 16 lessons. Every video ID/title/duration in this file
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

-- Course: Zoology - NEET PowerPlus Online Course (8 lessons, source playlist PLru9htpOg_gfAdGhba4vW2FY2MveLWauj)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Zoology - NEET PowerPlus Online Course', NULL, v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('N7HPzKphgD8', 'Body Fluids and Circulation Part 2', 'NEET PowerPlus Online Course — zoology | Body Fluids & Circulation - Part 2 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3870, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'N7HPzKphgD8';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XMmr5w_3Q6Y', 'Body Fluids and Circulation Part 3', 'NEET PowerPlus Online Course — zoology | Body Fluids & Circulation - Part 3 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3915, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'XMmr5w_3Q6Y';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IUjyJNJQ6JE', 'Body Fluids and Circulation Part 4', 'NEET PowerPlus Online Course — Zoology | Body Fluids & Circulation - Part 4 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3626, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'IUjyJNJQ6JE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('RwcdGZXtJww', 'Body Fluids and Circulation Part 5', 'NEET PowerPlus Online Course — Zoology | Body Fluids & Circulation - Part 5 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 4300, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'RwcdGZXtJww';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qisd0mByqyc', 'Body Fluids and Circulation Part 6', 'NEET PowerPlus Online Course — Zoology | Body Fluids & Circulation - Part 6 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 3695, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'qisd0mByqyc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yhaOyEh1awU', 'Body Fluids and Circulation Part 7', 'NEET PowerPlus Online Course — Zoology | Body Fluids & Circulation - Part 7 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 4055, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'yhaOyEh1awU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('pfs0YWxLFek', 'Body Fluids and Circulation Part 8', 'NEET PowerPlus Online Course — Zoology | Body Fluids & Circulation - Part 8 | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation'), 2, 4201, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'pfs0YWxLFek';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LmYKivS7EEA', 'Excretory Products and Their Elimination Part 1', 'NEET PowerPlus Online Course — Zoology | Excretory Products & their Elimination - Part 1 | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination'), 2, 4190, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'LmYKivS7EEA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Comeback Series for NEET 2026 Aspirants - Biology (8 lessons, source playlist PLru9htpOg_geXJfgb0sMtHTcIpB1CzFbs)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCySvBtI4jMLXp0BT9osvASw'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Comeback Series for NEET 2026 Aspirants - Biology', NULL, v_channel_id, 4, 'revision', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('xJ5RDBU64Dk', 'Photosynthesis in Higher Plants Part 2', 'PHOTOSYNTHESIS IN HIGHER PLANTS (PART-2) - BOTANY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 3761, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'xJ5RDBU64Dk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XhgysyAS76s', 'Locomotion and Movement: Muscles', 'LOCOMOTION & MOVEMENT- MUSCLES SCLES : ZOOLOGY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3515, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'XhgysyAS76s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IcbyN7rUF5M', 'Photosynthesis in Higher Plants Part 1', 'PHOTOSYNTHESIS IN HIGHER PLANTS (PART-1) - BOTANY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 3716, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'IcbyN7rUF5M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('QvjCyt_ZESQ', 'Breathing and Exchange of Gases', 'Breathing and Exchange of Gases - Zoology | Come Back Series for NEET 2026 Aspirants | ALLEN Online', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases'), 2, 3000, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'QvjCyt_ZESQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('hXvnUZP3j18', 'Locomotion and Movement: Skeletal System', 'LOCOMOTION & MOVEMENT- SKELETAL SYSTEM : ZOOLOGY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement'), 2, 3416, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'hXvnUZP3j18';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('6ll9kxkTkSA', 'Photosynthesis in Higher Plants Part 3', 'PHOTOSYNTHESIS IN HIGHER PLANTS (PART-3) - BOTANY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 4786, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', '6ll9kxkTkSA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('xXWw65KWLaE', 'Neural Control and Coordination', 'NEURAL CONTROL AND COORDINATION: ZOOLOGY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'neural-control-and-coordination'), 2, 2921, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'neural-control-and-coordination', 'xXWw65KWLaE';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('dU8hwQ1ZIsw', 'Photosynthesis in Higher Plants Part 4', 'PHOTOSYNTHESIS IN HIGHER PLANTS (PART-4) - BOTANY | Comeback Series for NEET 2026 Aspirants | ALLEN', v_channel_id, 4, (select id from public.chapters where slug = 'photosynthesis-in-higher-plants'), 2, 5440, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'photosynthesis-in-higher-plants', 'dU8hwQ1ZIsw';
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
      ('Zoology - NEET PowerPlus Online Course'),
      ('Comeback Series for NEET 2026 Aspirants - Biology')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Zoology - NEET PowerPlus Online Course', 'Comeback Series for NEET 2026 Aspirants - Biology');
  if v_course_count <> 2 then
    raise exception 'expected exactly 2 courses for ALLEN NEET part 5, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Zoology - NEET PowerPlus Online Course', 'Comeback Series for NEET 2026 Aspirants - Biology');
  if v_lesson_count <> 16 then
    raise exception 'expected exactly 16 lessons across ALLEN NEET part 5, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Zoology - NEET PowerPlus Online Course', 'Comeback Series for NEET 2026 Aspirants - Biology')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in ALLEN NEET part 5 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Zoology - NEET PowerPlus Online Course', 'Comeback Series for NEET 2026 Aspirants - Biology')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'ALLEN NEET part 5: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: ALLEN NEET part 5 -- % courses, % lessons, all correctly chaptered and linked.', 2, 16;
end
$$;

commit;
