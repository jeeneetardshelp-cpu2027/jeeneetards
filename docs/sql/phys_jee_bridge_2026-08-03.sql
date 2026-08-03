-- CREATE-ONLY import: ALLEN JEE Physics for JEE.
--
-- WHY: measured through the exam-goal filter a student actually browses with,
-- JEE Physics had only 10 of 31 chapters carrying more than one institute --
-- Competishun and Physics Wallah between them. The Aakash NEET and ALLEN NEET
-- Physics imported earlier today is NEET-tagged and invisible to a JEE student,
-- and re-tagging it as JEE would assert a syllabus fit that is not true.
-- These four files take the JEE view to 17 of 31.
--
-- Source     : ALLEN JEE — https://www.youtube.com/playlist?list=
-- Lessons    : 15
-- Chapters   : 6
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API with author_name "ALLEN JEE", and none was already in the
--              catalogue.
--
-- CHANNEL ATTRIBUTION: ALLEN runs both an "ALLEN JEE" and an "ALLEN Career
-- Institute" channel, and its One Shot playlist mixes videos hosted on both.
-- videos.channel_id must equal the course's channel_id -- the institute guard in
-- the database enforces it -- so lessons were grouped by the channel that
-- actually hosts them, not by the playlist they were found in. That is why this
-- import is split into more courses than there are source playlists.
--
-- Lessons pairing several chapters ("Complete JEE Mechanics", "EMI & AC",
-- "NLM & Friction", "Unit & Dimension and Kinematics") were excluded: there is
-- no single correct chapter_id for them.
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCkUI45drrKTWLxy3q3voJRw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('ALLEN JEE', 'UCkUI45drrKTWLxy3q3voJRw') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Physics Bridge Course — JEE') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics Bridge Course — JEE';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'NqgYpKjTPVo', 'LXDYv0nW_94', 'RxS78ypCwcg', 'rfG7Yv6iagk', 'eq3yJOvkrlc', 'llHIs7Az3Qg',
      'EPH9WHAog4w', '7v4ObzgG118', 'w6NKg7hVH1g', '3NbwS6tX5S8', '7INrZd3CqcY', 'kKQyh0eFv70',
      'QjTou0JC4gU', 'Do2sZ71H7zI', 'T2D7sodPDcw'
    ])
  ) then
    raise exception 'at least one of these 15 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics Bridge Course — JEE', 'Physics Bridge Course — JEE', 'The free JEE Physics bridge course from the official ALLEN JEE channel.',
    null, v_channel_id, 1, 1, 'full-course', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'NqgYpKjTPVo', 'Fluids (Part 3)', 'Fluids (Part-3) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6821, 26),
      (2, 'LXDYv0nW_94', 'Fluids (Part 2)', 'Fluids (Part-2) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6941, 26),
      (3, 'RxS78ypCwcg', 'Fluids (Part 1)', 'Fluids (Part-1) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6462, 26),
      (4, 'rfG7Yv6iagk', 'Simple Harmonic Motion (SHM) (Part 3)', 'Simple Harmonic Motion (SHM) Part-3 | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6280, 84),
      (5, 'eq3yJOvkrlc', 'Simple Harmonic Motion (SHM) (Part 2)', 'Simple Harmonic Motion (SHM) Part-2 | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 5770, 84),
      (6, 'llHIs7Az3Qg', 'Simple Harmonic Motion (SHM) (Part 1)', 'Simple Harmonic Motion (SHM) Part-1 | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6875, 84),
      (7, 'EPH9WHAog4w', 'Rotation (Part 3)', 'Rotation (Part-3) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6340, 27),
      (8, '7v4ObzgG118', 'Rotation (Part 2)', 'Rotation (Part-2) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6190, 27),
      (9, 'w6NKg7hVH1g', 'Rotation (Part 1)', 'Rotation (Part-1) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6445, 27),
      (10, '3NbwS6tX5S8', 'Centre of Mass (Part 2)', 'Centre of Mass (Part-2) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6561, 22),
      (11, '7INrZd3CqcY', 'Centre of Mass (Part 1)', 'Centre of Mass (Part-1) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6337, 22),
      (12, 'kKQyh0eFv70', 'Work, Energy and Power (Part 2)', 'Work, Energy and Power (Part-2) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6316, 21),
      (13, 'QjTou0JC4gU', 'Work, Energy and Power (Part 1)', 'Work, Energy and Power (Part-1) | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 5972, 21),
      (14, 'Do2sZ71H7zI', 'Circular Motion (Part 2)', 'Circular Motion Part-2 | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6336, 82),
      (15, 'T2D7sodPDcw', 'Circular Motion (Part 1)', 'Circular Motion Part-1 | Physics - Free Bridge Course for JEE Aspirants 📚 ALLEN JEE', 6381, 82)
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
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      1, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    for v_level in
      select id from public.class_levels where slug in ('class-11', 'class-12', 'dropper')
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 15 then
    raise exception 'expected 15 lessons for "%", inserted %', 'Physics Bridge Course — JEE', v_inserted;
  end if;

  -- Every lesson must sit on the same channel as its course, or the institute
  -- guard would reject it; assert it here so a mistake surfaces in this file.
  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physics Bridge Course — JEE';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics Bridge Course — JEE';
  end if;
end $$;
