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
-- Lessons    : 30
-- Chapters   : 13
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

  if exists (select 1 from public.playlists where title = 'Physics Foundation Series — JEE') then
    raise exception 'course "%" already exists - this file has already been run', 'Physics Foundation Series — JEE';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'ge6170L0GGo', 'sQZl03rnCKE', 'xR4a8vUcJL4', 'WUEWLmFRZ_8', 'ffX_tQGSz1Y', 'S45CcaeGMys',
      'loTHFYQwlGc', 'q_NZLGD2KI0', '8DTHpFCuBKs', 'aKF_rbBb0qo', '-mHlNhYgufI', '5LdQ-wXElNo',
      'EtEfqHg7Aps', 'qvS8G2tj3_Y', 'nEpEcmsv9dk', 'LWw2cX_DGbs', 'Q0EX9wB4AKI', 'n7CiepcP5Uw',
      'gpPt4bUXHgc', '_7hlk5XBrNg', 'fw_hbqVFU78', 'YVjag3VxCe4', 'Vrpgw2u2D-E', 'VWLP-WmlT8U',
      'xvCj-5GHcpw', 'Y8m0qws0mJs', 'SrbBSPi1kP8', '06eFTIe-44c', 't5-d1u8zHn0', '6PFg4KlNz6c'
    ])
  ) then
    raise exception 'at least one of these 30 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Physics Foundation Series — JEE', 'Physics Foundation Series — JEE', 'Fundamental concepts, chapter by chapter, from the official ALLEN JEE Physics Foundation Series.',
    null, v_channel_id, 1, 1, 'full-course', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'ge6170L0GGo', 'Simple Harmonic Motion (Part 2)', 'Physics - Fundamental Concepts of Simple Harmonic Motion (Part-2) | Foundation Series |  @ALLENJEE', 10841, 84),
      (2, 'sQZl03rnCKE', 'Simple Harmonic Motion (Part 1)', 'Physics - Fundamental Concepts of Simple Harmonic Motion (Part-1) | Foundation Series |  @ALLENJEE', 10715, 84),
      (3, 'xR4a8vUcJL4', 'Fluid Mechanics (Part 2)', 'Physics - Fundamental Concepts of Fluid Mechanics (Part-2) | Foundation Series |  @ALLENJEE', 9546, 26),
      (4, 'WUEWLmFRZ_8', 'Fluid Mechanics (Part 1)', 'Physics - Fundamental Concepts of Fluid Mechanics (Part-1) | Foundation Series |  @ALLENJEE', 10971, 26),
      (5, 'ffX_tQGSz1Y', 'Heat Thermodynamics (Part 1)', 'Physics - Fundamental Concepts of Heat Thermodynamics (Part-1) | Foundation Series |  @ALLENJEE', 10732, 23),
      (6, 'S45CcaeGMys', 'Heat Transfer (Part 2)', 'Physics - Fundamental Concepts of Heat Transfer (Part-2) | Foundation Series |  @ALLENJEE', 9626, 25),
      (7, 'loTHFYQwlGc', 'Heat Transfer (Part 1)', 'Physics - Fundamental Concepts of Heat Transfer (Part-1) | Foundation Series |  @ALLENJEE', 10596, 25),
      (8, 'q_NZLGD2KI0', 'Rotation (Part 3)', 'Physics - Fundamental Concepts of Rotation (Part-3) | Foundation Series |  @ALLENJEE', 13971, 27),
      (9, '8DTHpFCuBKs', 'Rotation (Part 2)', 'Physics - Fundamental Concepts of Rotation (Part-2) | Foundation Series |  @ALLENJEE', 11235, 27),
      (10, 'aKF_rbBb0qo', 'Rotation (Part 1)', 'Physics - Fundamental Concepts of Rotation (Part-1) | Foundation Series |  @ALLENJEE', 10757, 27),
      (11, '-mHlNhYgufI', 'Practice Questions Center of Mass (COM)', 'Physics - Practice Questions Center of Mass (COM) | Foundation Series |  @ALLENJEE', 6684, 22),
      (12, '5LdQ-wXElNo', 'Center of Mass (COM) (Part 3)', 'Physics - Fundamental Concepts of Center of Mass (COM) Part -3 | Foundation Series |  @ALLENJEE', 5265, 22),
      (13, 'EtEfqHg7Aps', 'Center of Mass (COM) (Part 2)', 'Physics - Fundamental Concepts of Center of Mass (COM) Part -2 | Foundation Series |  @ALLENJEE', 7250, 22),
      (14, 'qvS8G2tj3_Y', 'Center of Mass (COM) (Part 1)', 'Physics - Fundamental Concepts of Center of Mass (COM) Part -1 | Foundation Series |  @ALLENJEE', 6321, 22),
      (15, 'nEpEcmsv9dk', 'Work Power, Energy (WPE) (Part 3)', 'Physics - Fundamental Concepts of Work Power, Energy (WPE) Part-3 | Foundation Series |  @ALLENJEE', 7086, 21),
      (16, 'LWw2cX_DGbs', 'Work Power, Energy (WPE) (Part 2)', 'Physics - Fundamental Concepts of Work Power, Energy (WPE) Part-2 | Foundation Series |  @ALLENJEE', 6186, 21),
      (17, 'Q0EX9wB4AKI', 'Work Power, Energy (WPE) (Part 1)', 'Physics - Fundamental Concepts of Work Power, Energy (WPE) Part-1 | Foundation Series |  @ALLENJEE', 12066, 21),
      (18, 'n7CiepcP5Uw', 'Circular Motion (Part 2)', 'Physics - Fundamental Concepts of Circular Motion (Part-2) | Foundation Series | @ALLENJEE', 7666, 82),
      (19, 'gpPt4bUXHgc', 'Circular Motion (Part 1)', 'Physics - Fundamental Concepts of Circular Motion (Part-1) | Foundation Series | @ALLENJEE', 8961, 82),
      (20, '_7hlk5XBrNg', 'Relative Motion', 'Physics - Fundamental Concepts of Relative Motion | Foundation Series | @ALLENJEE', 7856, 1),
      (21, 'fw_hbqVFU78', 'Kinematics 2D', 'Physics - Fundamental Concepts of Kinematics 2D | Foundation Series | @ALLENJEE', 12917, 1),
      (22, 'YVjag3VxCe4', 'Kinematics 1D (Part 2)', 'Physics - Fundamental Concepts of Kinematics 1D (Part-2) | Foundation Series | @ALLENJEE', 12924, 1),
      (23, 'Vrpgw2u2D-E', 'Friction (Part 2)', 'Physics - Friction (Part-2) | Important for JEE Aspirants | Foundation Series |  @ALLENJEE', 8601, 7),
      (24, 'VWLP-WmlT8U', 'Friction (Part 1)', 'Physics - Friction (Part-1) | Important for JEE Aspirants | Foundation Series |  @ALLENJEE', 10881, 7),
      (25, 'xvCj-5GHcpw', 'Newton''s Laws of Motion (Part 3)', 'Physics - Fundamental Concepts of Newton''s Laws of Motion (Part-3) | Foundation Series | @ALLENJEE', 15026, 6),
      (26, 'Y8m0qws0mJs', 'Newton''s Laws of Motion (Part 2)', 'Physics - Fundamental Concepts of Newton''s Laws of Motion (Part-2) | Foundation Series | @ALLENJEE', 11441, 6),
      (27, 'SrbBSPi1kP8', 'Newton''s Laws of Motion (Part 1)', 'Physics - Fundamental Concepts of Newton''s Laws of Motion (Part-1) | Foundation Series | @ALLENJEE', 14481, 6),
      (28, '06eFTIe-44c', 'Kinematics 1D (Part 1)', 'Physics - Fundamental Concepts of Kinematics 1D (Part-1) | Foundation Series | @ALLENJEE', 16021, 1),
      (29, 't5-d1u8zHn0', 'Vector', 'Physics - Fundamental Concepts of Vector | Foundation Series | @ALLENJEE', 12828, 80),
      (30, '6PFg4KlNz6c', 'Unit & Dimension', 'Physics - All Concepts from Basic of Unit & Dimension | Foundation Series | @ALLENJEE', 9636, 28)
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

  if v_inserted <> 30 then
    raise exception 'expected 30 lessons for "%", inserted %', 'Physics Foundation Series — JEE', v_inserted;
  end if;

  -- Every lesson must sit on the same channel as its course, or the institute
  -- guard would reject it; assert it here so a mistake surfaces in this file.
  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Physics Foundation Series — JEE';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Physics Foundation Series — JEE';
  end if;
end $$;
