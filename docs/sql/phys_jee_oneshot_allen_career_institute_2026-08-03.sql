-- CREATE-ONLY import: ALLEN Career Institute Physics for JEE.
--
-- WHY: measured through the exam-goal filter a student actually browses with,
-- JEE Physics had only 10 of 31 chapters carrying more than one institute --
-- Competishun and Physics Wallah between them. The Aakash NEET and ALLEN NEET
-- Physics imported earlier today is NEET-tagged and invisible to a JEE student,
-- and re-tagging it as JEE would assert a syllabus fit that is not true.
-- These four files take the JEE view to 17 of 31.
--
-- Source     : ALLEN Career Institute — https://www.youtube.com/playlist?list=
-- Lessons    : 11
-- Chapters   : 9
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API with author_name "ALLEN Career Institute", and none was already in the
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCgUeJ2Gv7rJtMBkQF2Ppn4A';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('ALLEN Career Institute', 'UCgUeJ2Gv7rJtMBkQF2Ppn4A') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Physics One Shot — JEE (ALLEN Career Institute)') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics One Shot — JEE (ALLEN Career Institute)';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'KHS2IgYwHpc', 'OwO_W62RyII', 'pzfSEBw8ot4', 'pbA2sjKbopc', 'SnX6_gblGjI', 'ACS9MfXFI8U',
      'LzgqmJHapyw', 'wS3fHRRIcvg', 'Oj44aHXYZXc', 'WmKlpIzjLHc', 'onMzemv10PQ'
    ])
  ) then
    raise exception 'at least one of these 11 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics One Shot — JEE (ALLEN Career Institute)', 'Physics One Shot — JEE (ALLEN Career Institute)', 'Full-chapter one-shot Physics lectures from the official ALLEN JEE channel.',
    null, v_channel_id, 1, 1, 'one-shot', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'KHS2IgYwHpc', 'Centre of Mass', 'One Shot Video on Centre of Mass | Complete Chapter In One Lecture | Perfect Revision | ALLEN JEE', 7294, 22),
      (2, 'OwO_W62RyII', 'Rotational Mechanics', 'Rotational Mechanics in One Shot | Master Class By ALLEN Expert | Part-1 | Rigid Body Dynamics 📍', 19701, 27),
      (3, 'pzfSEBw8ot4', 'Newton''s Law of Motion', 'One Shot Video on Newton''s Law of Motion | Master Class By ALLEN Expert 📍', 26402, 6),
      (4, 'pbA2sjKbopc', 'ElectroMagnetic Waves', 'ElectroMagnetic Waves | Complete Concept in 1 Shot | Important for Upcoming Exam | @ALLENJEE', 12088, 15),
      (5, 'SnX6_gblGjI', 'Polarisation', 'One Shot Video 🔥 Polarisation | Must Watch Class for Aspirants | ALLEN Kota', 6904, 16),
      (6, 'ACS9MfXFI8U', 'Diffraction', 'Best Video on Diffraction 🔥 | Complete Concept in One Shot | Master Class | @ALLENJEE', 9050, 16),
      (7, 'LzgqmJHapyw', 'Numerical Solving Rotational Mechanics', 'One Shot Numerical Solving 🔥 Rotational Mechanics  | Must Watch Class for Aspirants | ALLEN Kota', 21569, 27),
      (8, 'wS3fHRRIcvg', 'Work, Energy and Power', 'Work, Energy and Power - Complete Chapter in 1 Shot | All Concepts, Tricks & PYQs | ALLEN', 20336, 21),
      (9, 'Oj44aHXYZXc', 'Circular Motion', 'Circular Motion | Complete Concept in one shot 🔥| Physics Master Class | ALLEN', 13106, 82),
      (10, 'WmKlpIzjLHc', 'Relative Motion', 'Complete Relative Motion in 1 Shot | Marathon Class 🏃🏼 Most Important Concept for Aspirants', 14688, 1),
      (11, 'onMzemv10PQ', 'Fluid Mechanics', 'Mega Lecture of Fluid Mechanics All Concepts & Tricks in One Class By AM Sir | ALLEN', 30905, 26)
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

  if v_inserted <> 11 then
    raise exception 'expected 11 lessons for "%", inserted %', 'Physics One Shot — JEE (ALLEN Career Institute)', v_inserted;
  end if;

  -- Every lesson must sit on the same channel as its course, or the institute
  -- guard would reject it; assert it here so a mistake surfaces in this file.
  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physics One Shot — JEE (ALLEN Career Institute)';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics One Shot — JEE (ALLEN Career Institute)';
  end if;
end $$;
