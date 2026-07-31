-- biology_class11_aakash_neet_part2_2026-07-31.sql
--
-- Biology Class 11 catalogue-diversity import: Aakash NEET (part 2 of 5).
-- 7 courses, 45 lessons. Every video ID/title/duration in this file
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

-- Course: Cell: The Unit of Life — Mission MBBS (Aakash NEET) (8 lessons, source playlist PL7AAT-ai0VD4rb-eJsA8BwUm-WP8kvgT8)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('61mP31_GECI', 'Eukaryotic Cell (Nucleus) Class 11 Biology - Cell The Unit Of Life Concepts (L1)', 'Eukaryotic Cell (Nucleus) Class 11 Biology - Cell The Unit Of Life Concepts (L1) | NEET 2024 Biology', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3086, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', '61mP31_GECI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('6YYqeCoJ70s', 'Endomembrane System Class 11 Biology - Cell The Unit of Life Concepts (L2)', 'Endomembrane System Class 11 Biology - Cell The Unit of Life Concepts (L2) | NEET 2024 Exam Prep', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3069, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', '6YYqeCoJ70s';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BgMrH1j2STY', 'Endomembrane System - Cell The Unit of Life Concepts Explained (L3)', 'Endomembrane System -  Cell The Unit of Life Concepts Explained (L3) | NEET 2024 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3323, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'BgMrH1j2STY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yxU2SSEbnkM', 'Lysosomes and Vacuoles - Cell The Unit of Life Concepts (L4)', 'Lysosomes and Vacuoles  -  Cell The Unit of Life Concepts (L4) | NEET 2024 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3211, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'yxU2SSEbnkM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('lgQlZ9buYyM', 'Ribosomes, Plastids, Microbodies', 'Ribosomes, Plastids, Microbodies | L5 | Class 11 Biology Chapter Explained | NEET 2024 Biology Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3807, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'lgQlZ9buYyM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('tdoS1Iglj38', 'Nucleus, Nucleolus & Centrioles - Cell The Unit of Life Class 11 Biology Concepts (L6)', 'Nucleus, Nucleolus & Centrioles - Cell The Unit of Life Class 11 Biology Concepts (L6) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3551, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'tdoS1Iglj38';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('jVy4co3LhWs', 'Differences between Plant and Animal Cells Class 11 Biology Concept Explained (L7)', 'Differences between Plant and Animal Cells Class 11 Biology Concept Explained (L7) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 3170, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'jVy4co3LhWs';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('D8c3YrMxyQA', 'Cell The Unit of Life Class 11 Biology Previous Year Questions and Answers (L8)', 'Cell The Unit of Life Class 11 Biology Previous Year Questions and Answers (L8) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-the-unit-of-life' and subject_id = 4), 2, 2715, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-the-unit-of-life', 'D8c3YrMxyQA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Biomolecules — Mission MBBS (Aakash NEET) (8 lessons, source playlist PL7AAT-ai0VD64DYfNZf9yUMsZYFnCA9Se)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Biomolecules — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('qmZ8HGNnq5w', 'Biomolecule Class 11 Biology Concepts Explained (L 1)', 'Biomolecule Class 11 Biology Concepts Explained (L 1) | Class 11 Zoology | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 4681, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'qmZ8HGNnq5w';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('ZcDIetuGKEk', 'Biomolecule Class 11 Biology Concepts Explained (L 2)', 'Biomolecule Class 11 Biology Concepts Explained (L 2) | Class 11 Zoology | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 4469, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'ZcDIetuGKEk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('8VgJ_yKGjyY', 'Lipids Class 11 Biology - Biomolecules Concepts (L3)', 'Lipids Class 11 Biology - Biomolecules Concepts (L3) | NEET 2024 Biology Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 3291, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '8VgJ_yKGjyY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('mBKgumcqkBM', 'Nucleic Acids Biomolecule Class 11 Biology Concepts Explained (L4)', 'Nucleic Acids Biomolecule Class 11 Biology Concepts Explained (L4) | NEET 2024 Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 4842, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'mBKgumcqkBM';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('De_AXFOH7WI', 'Proteins Class 11 Biology - Biomolecules Concepts (L5)', 'Proteins Class 11 Biology - Biomolecules Concepts (L5) | NEET 2024 Biology Exam Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 3166, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'De_AXFOH7WI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('970wn4_q-Oo', 'Enzymes Class 11 Biology (Zoology) Concepts - Biomolecules (L6)', 'Enzymes Class 11 Biology (Zoology) Concepts - Biomolecules (L6) | NEET 2024 Biology Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 2638, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '970wn4_q-Oo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('owzQje-exic', 'Enzymes II Class 11 Biology (Zoology) Concepts - Biomolecules (L7)', 'Enzymes II Class 11 Biology (Zoology) Concepts - Biomolecules (L7) | NEET 2024 Biology Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 2544, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', 'owzQje-exic';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_4VfjrGe9Jg', 'Biomolecules Class 11 Biology Complete Chapter in Nutshell - Key Takeaway', 'Biomolecules Class 11 Biology Complete Chapter in Nutshell - Key Takeaway | NEET 2024 Preparation', v_channel_id, 4, (select id from public.chapters where slug = 'biomolecules' and subject_id = 4), 2, 3956, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'biomolecules', '_4VfjrGe9Jg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 8)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Cell Cycle and Cell Division — Mission MBBS (Aakash NEET) (6 lessons, source playlist PL7AAT-ai0VD7uUM11BX3HRxboTRgibjSQ)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)', 'Dr. Pankhuri Miglani', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('1tJpqYfXMPU', 'Interphase and Prophase - Cell Cycle and Cell Division Class 11 Biology (L1)', 'Interphase and Prophase -  Cell Cycle and Cell Division Class 11 Biology (L1) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 3526, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', '1tJpqYfXMPU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('IEZKBC35U2M', 'Metaphase, Anaphase and Telophase - Cell Cycle and Cell Division Class 11 Biology (L2)', 'Metaphase, Anaphase and Telophase - Cell Cycle and Cell Division Class 11 Biology (L2) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 2831, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'IEZKBC35U2M';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('nCM5dvUdX20', 'Meiosis: Prophase I - Cell Cycle and Cell Division Class 11 Biology (L3)', 'Meiosis: Prophase I - Cell Cycle and Cell Division Class 11 Biology (L3) | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 2662, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'nCM5dvUdX20';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('D79X5tfxOKQ', 'Meiosis 2, Metaphase 1, Anaphase 1 - Cell Cycle and Cell Division Class 11 Biology (L4)', 'Meiosis 2, Metaphase 1, Anaphase 1  - Cell Cycle and Cell Division Class 11 Biology (L4) | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 1895, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'D79X5tfxOKQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('l3gxKLfRkTY', 'Cell Cycle Arrest Significance - Cell Cycle and Cell Division Class 11 Biology Concept', 'Cell Cycle Arrest Significance - Cell Cycle and Cell Division Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 1134, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'l3gxKLfRkTY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TE3KVk3_eLY', 'Cell Cycle and Cell division Class 11 Biology Previous Year Questions & Answers', 'Cell Cycle and Cell division Class 11 Biology Previous Year Questions & Answers | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'cell-cycle-and-cell-division' and subject_id = 4), 2, 3230, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'cell-cycle-and-cell-division', 'TE3KVk3_eLY';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Breathing and Exchange of Gases — Mission MBBS (Aakash NEET) (7 lessons, source playlist PL7AAT-ai0VD66Ai28kyXfO31y-CbG2oUZ)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('P-N0XIRSqX4', 'Respiratory System of Animals - Breathing and Exchange of Gases Class 11 Biology Concept', 'Respiratory System of Animals - Breathing and Exchange of Gases Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 2998, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'P-N0XIRSqX4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('FX1xzU9gB-E', 'Human Respiratory System - Breathing and Exchange of Gases Class 11 Biology Concept', 'Human Respiratory System - Breathing and Exchange of Gases Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 2727, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'FX1xzU9gB-E';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('B6kdUqeAaEk', 'Mechanism of Breathing - Breathing and Exchange of Gases Class 11 Biology Concept', 'Mechanism of Breathing - Breathing and Exchange of Gases Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 3379, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'B6kdUqeAaEk';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('KoxldOH8ARg', 'Transportation of Gases : Oxygen - Breathing & Exchange of Gases Concept Explained', 'Transportation of Gases : Oxygen - Breathing & Exchange of Gases Class 11 Biology Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 3188, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'KoxldOH8ARg';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LTlmyRqWDuQ', 'Transportation of Gases: Carbon Dioxide - Breathing & Exchange of Gases Concept', 'Transportation of Gases: Carbon Dioxide - Breathing & Exchange of Gases Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 3351, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'LTlmyRqWDuQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('sIPzqzVtyiA', 'Regulation of Respiration - Breathing & Exchange of Gases Class 11 Biology Concept', 'Regulation of Respiration - Breathing & Exchange of Gases Class 11 Biology Concept | Dr Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 3046, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'sIPzqzVtyiA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 6)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LPI6yzwOu1U', 'Respiratory Disorders- Breathing & Exchange of Gases Class 11 Biology', 'Respiratory Disorders- Breathing & Exchange of Gases Class 11 Biology | NEET 2024 | Dr. Sachin Kapur', v_channel_id, 4, (select id from public.chapters where slug = 'breathing-and-exchange-of-gases' and subject_id = 4), 2, 3456, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'breathing-and-exchange-of-gases', 'LPI6yzwOu1U';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 7)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Body Fluids and Circulation — Mission MBBS (Aakash NEET) (5 lessons, source playlist PL7AAT-ai0VD7xJilL2EvuSEVbHzGc9dMy)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Body Fluids and Circulation — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('cEOiMyKWxEo', 'Introduction to Circulatory System - Body Fluids and Circulation Concept Explained', 'Introduction to Circulatory System - Body Fluids and Circulation Class 11 Biology Concept Explained', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation' and subject_id = 4), 2, 3829, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'cEOiMyKWxEo';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('LTqlIKVrJrc', 'Formation of Clot - Body Fluids and Circulation Class 11 Biology Concept Explained', 'Formation of Clot - Body Fluids and Circulation Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation' and subject_id = 4), 2, 3759, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'LTqlIKVrJrc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gie4tKVdIEU', 'Human Circulatory System & Structure of Heart - Body Fluids and Circulation Concept', 'Human Circulatory System & Structure of Heart - Body Fluids and Circulation Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation' and subject_id = 4), 2, 2261, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'gie4tKVdIEU';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('yomLXf3dT7g', 'Double Circulation and Coronary Circulation - Body Fluids and Circulation Concept', 'Double Circulation and Coronary Circulation - Body Fluids and Circulation Class 11 Biology Concept', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation' and subject_id = 4), 2, 2752, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', 'yomLXf3dT7g';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('9FomjSeIkXA', 'Cardiac Disorders and Diseases - Body Fluids and Circulation Class 11 Biology Concept', 'Cardiac Disorders and Diseases - Body Fluids and Circulation Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'body-fluids-and-circulation' and subject_id = 4), 2, 2830, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'body-fluids-and-circulation', '9FomjSeIkXA';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Excretory Products and Their Elimination — Mission MBBS (Aakash NEET) (5 lessons, source playlist PL7AAT-ai0VD6cLXNd0zUfTeO3XdJziAKW)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('BmS2wpUp-Qc', 'Osmoregulation & Excretory Structure - Excretory Products and their Elimination', 'Osmoregulation & Excretory Structure - Excretory Products and their Elimination Class 11 Biology', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination' and subject_id = 4), 2, 2602, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'BmS2wpUp-Qc';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('P3Xsa7oUOso', 'Formation of Urine - Excretory Products and their Elimination Class 11 Biology Concept', 'Formation of Urine - Excretory Products and their Elimination Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination' and subject_id = 4), 2, 3041, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'P3Xsa7oUOso';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XWXBxEzc8RI', 'Human Excretory System - Excretory Products & their Elimination Class 11 Biology Concept', 'Human Excretory System - Excretory Products & their Elimination Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination' and subject_id = 4), 2, 4062, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'XWXBxEzc8RI';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('_gBuOJUgNok', 'Kidney Functions and Role of other Organs in Excretion Class 11 Biology Concept', 'Kidney Functions and Role of other Organs in Excretion Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination' and subject_id = 4), 2, 3174, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', '_gBuOJUgNok';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('TVuQyRK0WH4', 'Disorders of the Excretory System - Excretory Products & their Elimination Concepts', 'Disorders of the Excretory System - Excretory Products & their Elimination Class 11 Biology Concepts', v_channel_id, 4, (select id from public.chapters where slug = 'excretory-products-and-their-elimination' and subject_id = 4), 2, 2323, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'excretory-products-and-their-elimination', 'TVuQyRK0WH4';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- Course: Locomotion and Movement — Mission MBBS (Aakash NEET) (6 lessons, source playlist PL7AAT-ai0VD4rBxx-CpJqlM4_vXVHmFw_)
do $$
declare
  v_channel_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  if v_channel_id is null then raise exception 'channel not found: %', 'UCAPDuc6Kfpe1mKjMX367qmA'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Locomotion and Movement — Mission MBBS (Aakash NEET)', 'Dr. Sachin Kapur & Pushpendu Sir', v_channel_id, 4, 'full-course', 'hinglish', 'intermediate')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-11';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fHtiY3aVNYw', 'Types of Movement & Muscles - Locomotion and Movement Class 11 Biology Concepts', 'Types of Movement & Muscles - Locomotion and Movement Class 11 Biology Concepts | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 3119, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'fHtiY3aVNYw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('4PB80Pzlkb0', 'Mechanism of Muscle Contraction - Locomotion and Movement Class 11 Biology Concept', 'Mechanism of Muscle Contraction - Locomotion and Movement Class 11 Biology Concept | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 1736, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', '4PB80Pzlkb0';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 2)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('AbvwBsJmaCQ', 'Mechanism of Muscle Contraction (Pt 2)- Locomotion and Movement Class 11 Biology Concept', 'Mechanism of Muscle Contraction (Pt 2)- Locomotion and Movement Class 11 Biology Concept | NEET 2024', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 1489, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'AbvwBsJmaCQ';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 3)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('XXxakueEvEw', 'Skeletal System (Pt 1) - Locomotion and Movement Class 11 Biology Concept Explained', 'Skeletal System (Pt 1) - Locomotion and Movement Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 1378, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'XXxakueEvEw';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 4)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('gTpqsCdZt4U', 'Skeletal System (Pt 1) - Locomotion and Movement Class 11 Biology Concept Explained', 'Skeletal System (Pt 1) - Locomotion and Movement Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 3024, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'gTpqsCdZt4U';
  end if;
  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 5)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('udPhvVnXO74', 'Skeletal System (Pt 2) - Locomotion and Movement Class 11 Biology Concept Explained', 'Skeletal System (Pt 2) - Locomotion and Movement Class 11 Biology Concept Explained | NEET 2024 Exam', v_channel_id, 4, (select id from public.chapters where slug = 'locomotion-and-movement' and subject_id = 4), 2, 2555, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;
  if (select chapter_id from public.videos where id = v_video_id) is null then
    raise exception 'chapter slug % did not resolve for video %', 'locomotion-and-movement', 'udPhvVnXO74';
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
      ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)'),
      ('Biomolecules — Mission MBBS (Aakash NEET)'),
      ('Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)'),
      ('Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)'),
      ('Body Fluids and Circulation — Mission MBBS (Aakash NEET)'),
      ('Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)'),
      ('Locomotion and Movement — Mission MBBS (Aakash NEET)')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)', 'Biomolecules — Mission MBBS (Aakash NEET)', 'Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)', 'Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)', 'Body Fluids and Circulation — Mission MBBS (Aakash NEET)', 'Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)', 'Locomotion and Movement — Mission MBBS (Aakash NEET)');
  if v_course_count <> 7 then
    raise exception 'expected exactly 7 courses for Aakash NEET part 2, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)', 'Biomolecules — Mission MBBS (Aakash NEET)', 'Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)', 'Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)', 'Body Fluids and Circulation — Mission MBBS (Aakash NEET)', 'Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)', 'Locomotion and Movement — Mission MBBS (Aakash NEET)');
  if v_lesson_count <> 45 then
    raise exception 'expected exactly 45 lessons across Aakash NEET part 2, found %', v_lesson_count;
  end if;

  select count(*) into v_null_chapter_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
    join public.videos v on v.id = pv.video_id
   where p.title in ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)', 'Biomolecules — Mission MBBS (Aakash NEET)', 'Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)', 'Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)', 'Body Fluids and Circulation — Mission MBBS (Aakash NEET)', 'Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)', 'Locomotion and Movement — Mission MBBS (Aakash NEET)')
     and v.chapter_id is null;
  if v_null_chapter_count <> 0 then
    raise exception '% lesson(s) in Aakash NEET part 2 have a null chapter_id', v_null_chapter_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Cell: The Unit of Life — Mission MBBS (Aakash NEET)', 'Biomolecules — Mission MBBS (Aakash NEET)', 'Cell Cycle and Cell Division — Mission MBBS (Aakash NEET)', 'Breathing and Exchange of Gases — Mission MBBS (Aakash NEET)', 'Body Fluids and Circulation — Mission MBBS (Aakash NEET)', 'Excretory Products and Their Elimination — Mission MBBS (Aakash NEET)', 'Locomotion and Movement — Mission MBBS (Aakash NEET)')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'Aakash NEET part 2: course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: Aakash NEET part 2 -- % courses, % lessons, all correctly chaptered and linked.', 7, 45;
end
$$;

commit;
