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
-- Lessons    : 9
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

  if exists (select 1 from public.playlists where title = 'Physics One Shot — JEE') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics One Shot — JEE';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'ZVMejz1J2P0', 'a41po306xjc', 'KRVcX4T4GAA', 'NoyInI_r5-k', 'fGU4Il_H8l8', 'C4i87oPRb7o',
      'FSwUCo0rJ8k', '7o0mi1Mtzgc', 'allFLIoqKbQ'
    ])
  ) then
    raise exception 'at least one of these 9 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics One Shot — JEE', 'Physics One Shot — JEE', 'Full-chapter one-shot Physics lectures from the official ALLEN JEE channel.',
    null, v_channel_id, 1, 1, 'one-shot', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'ZVMejz1J2P0', 'Semiconductor', 'Master Class of Semiconductor - All Concepts & Tricks in One Shot | JEE Main 2024 | @ALLENJEE', 12591, 17),
      (2, 'a41po306xjc', 'Wave Optics', 'Master Class of Wave Optics | All Concepts & Tricks in One Shot 🔥 JEE Main 2024 | @ALLENJEE', 18161, 16),
      (3, 'KRVcX4T4GAA', 'Fluid Mechanics', '🔴Live - Mega Lecture of Fluid Mechanics All Concepts & Tricks in One Class By AM Sir | @ALLENJEE', 30508, 26),
      (4, 'NoyInI_r5-k', 'Electromagnetic Waves', 'Complete Electromagnetic Waves in 1 Shot | JEE Advanced 2024 | All Concepts, Tricks & PYQs', 12088, 15),
      (5, 'fGU4Il_H8l8', 'Diffraction', 'JEE Advanced 2024 - Physics: Diffraction in One Shot | All Concepts & Tricks, PYQs | @ALLENJEE', 8918, 16),
      (6, 'C4i87oPRb7o', 'Rotational Mechanics (Part 1)', 'JEE Advanced 2024 - Physics: Rotational Mechanics in One Shot | All Concepts & Tricks | @ALLENJEE', 21533, 27),
      (7, 'FSwUCo0rJ8k', 'Polarisation', 'JEE Advanced 2024 - Physics: Polarisation in One Shot | All Concepts & Tricks | @ALLENJEE', 6904, 16),
      (8, '7o0mi1Mtzgc', 'Centre of Mass (COM)', 'JEE Advanced 2024 - Physics: Centre of Mass (COM) in One Shot | All Concepts & Tricks | @ALLENJEE', 7296, 22),
      (9, 'allFLIoqKbQ', 'Rotational Mechanics (Part 2)', 'JEE Advanced 2024 - Physics: Rotational Mechanics in One Shot | All Concepts & Tricks | @ALLENJEE', 19701, 27)
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

  if v_inserted <> 9 then
    raise exception 'expected 9 lessons for "%", inserted %', 'Physics One Shot — JEE', v_inserted;
  end if;

  -- Every lesson must sit on the same channel as its course, or the institute
  -- guard would reject it; assert it here so a mistake surfaces in this file.
  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physics One Shot — JEE';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics One Shot — JEE';
  end if;
end $$;
