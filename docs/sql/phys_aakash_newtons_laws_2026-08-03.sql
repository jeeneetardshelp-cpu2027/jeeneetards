-- CREATE-ONLY import: Aakash NEET Physics.
--
-- WHY: Physics had 8 of 33 chapters taught by a single INSTITUTE, and the only
-- two coaching families already in the catalogue are Competishun (channels
-- 1/81/77) and Physics Wallah (5/89/76). Aakash NEET is independent of both,
-- so these lessons are a genuine second opinion rather than the same institute
-- on a different channel.
--
-- Source     : https://www.youtube.com/playlist?list=PL7AAT-ai0VD6l9oLrmnTQ9U_E81rEKghS
-- Lessons    : 6
-- Chapters   : 1 (Newton's Laws of Motion (NLM))
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Aakash NEET", and none was already
--              in the catalogue.
-- Teacher    : left null -- more than one faculty member teaches this series,
--              and naming a single one would be false.
--
-- Each lesson carries its own chapter_id, decided from its own title, and the
-- migration refuses at runtime to file a lesson under a non-Physics chapter.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id
  from public.institutes_channels where youtube_channel_id = 'UCAPDuc6Kfpe1mKjMX367qmA';
  select id into strict v_goal_id from public.learning_goals where slug = 'neet';

  if exists (select 1 from public.playlists where title = 'Newton''s Laws of Motion — Class 11 Physics') then
    raise exception 'course "%" already exists - this file has already been run', 'Newton''s Laws of Motion — Class 11 Physics';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'VSd72g_BGGg', 'CfbyQfhnxjY', '9E_j1-UQqX8', 'WUkUU-fyuUY', 'rc7nmf_2-DI', 'mibFiZTHn2s'
    ])
  ) then
    raise exception 'at least one of these 6 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Newton''s Laws of Motion — Class 11 Physics', 'Newton''s Laws of Motion — Class 11 Physics', 'Newton''s laws of motion taught in sequence, from the official Aakash NEET channel.',
    null, v_channel_id, 2, 1, 'full-course', 'hinglish', 'intermediate'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'VSd72g_BGGg', 'Introduction to Newton''s Laws of Motion (Part 1)', 'Introduction to Newton''s Laws of Motion Class 11 Physics Concept Explained (L1) | NEET 2024 Exam', 2874, 6),
      (2, 'CfbyQfhnxjY', 'Newton''s Second Law of Motion (Part 2)', 'Newton''s Second Law of Motion Class 11 Physics Concept Explained (L2) | NEET 2024 Exam Preparation', 3755, 6),
      (3, '9E_j1-UQqX8', 'Pulley Problem - Newton''s Laws of Motion', 'Pulley Problem - Newton''s Laws of Motion Class 11 Physics Concepts | NEET 2024 Preparation', 3492, 6),
      (4, 'WUkUU-fyuUY', 'Constraint Motion - Newton''s Laws of Motion', 'Constraint Motion - Newton''s Laws of Motion Class 11 Physics Concept | NEET 2024 Physics Exam', 3631, 6),
      (5, 'rc7nmf_2-DI', 'What is Pseudo Force - Newton''s Laws of Motion', 'What is Pseudo Force - Newton''s Laws of Motion Class 11 Physics Concept | NEET 2024 Physics Exam', 2856, 6),
      (6, 'mibFiZTHn2s', 'Practice Session : Newton''s Laws of Motion', 'Practice Session : Newton''s Laws of Motion Class 11 Physics Experiment | NEET 2024 Exam', 3644, 6)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 1) then
      raise exception 'chapter % is not a Physics chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 2,
      1, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    -- Class levels follow the lesson's own chapter: display_order 1-16 is the
    -- Class 11 half of the Physics syllabus, 17+ the Class 12 half.
    for v_level in
      select cl.id from public.class_levels cl
      join public.chapters ch on ch.id = v_row.chapter_id
      where cl.slug = 'dropper'
         or (cl.slug = 'class-11' and ch.display_order <= 16)
         or (cl.slug = 'class-12' and ch.display_order >= 17)
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 6 then
    raise exception 'expected 6 lessons for "%", inserted %', 'Newton''s Laws of Motion — Class 11 Physics', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Newton''s Laws of Motion — Class 11 Physics';
  end if;
end $$;
