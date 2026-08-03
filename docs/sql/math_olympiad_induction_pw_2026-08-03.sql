-- CREATE-ONLY import: "Principle of Mathematical Induction" for JEE/olympiad Mathematics.
--
-- WHY A NEW CHAPTER: this catalogue had nowhere to file olympiad topic content.
-- Its existing olympiad chapters (INMO Solutions, ISI Entrance PYQs, PRMO and
-- IOQM Solutions) are all past-paper solutions; there was no chapter for the
-- underlying topics an olympiad student actually studies. ALLEN JEE's own
-- Foundation Series lesson on mathematical induction had to be skipped during
-- the 3 August Mathematics import for exactly this reason.
--
-- The chapter is created here if it does not already exist, so these files can
-- be run in any order and re-running is safe.
--
-- Source     : JEE Wallah — https://www.youtube.com/playlist?list=PLxyGaR3hEy3htuvqqkoVwm76Opq9A5Gsh
-- Lessons    : 1
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "JEE Wallah", and none was already
--              in the catalogue.
-- Titles     : cleaned for display; source_title keeps YouTube's original
--              verbatim. All pass src/titleQuality.js with zero blocking issues
--              and zero warnings, and are unique within this course.
--
-- Safe to re-run: aborts rather than duplicating.
do $$
declare
  v_channel_id bigint;
  v_chapter_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_goal record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('JEE Wallah', 'UCVJU_IChPMOe8RWkdVQjtfQ') returning id into v_channel_id;
  end if;

  select id into v_chapter_id from public.chapters
  where subject_id = 3 and name = 'Principle of Mathematical Induction';
  if v_chapter_id is null then
    if exists (select 1 from public.chapters where subject_id = 3 and display_order = 47) then
      raise exception 'Mathematics display_order 47 is already taken - resolve before creating "%"', 'Principle of Mathematical Induction';
    end if;
    insert into public.chapters (name, slug, subject_id, display_order)
    values ('Principle of Mathematical Induction', 'principle-of-mathematical-induction', 3, 47)
    returning id into v_chapter_id;
  end if;

  if exists (select 1 from public.playlists where title = 'Mathematical Induction — Maths Raftaar') then
    raise exception 'course "%" already exists - this file has already been run', 'Mathematical Induction — Maths Raftaar';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'JIXkwmIEfdA'
    ])
  ) then
    raise exception 'at least one of these 1 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Mathematical Induction — Maths Raftaar', 'Mathematical Induction — Maths Raftaar', 'Mathematical induction from the official JEE Wallah channel.',
    null, v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, id from public.learning_goals
  where slug = any(array['jee']);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'JIXkwmIEfdA', 'Mathematical Induction 01', 'Mathematical Induction 01 | PMI and Homework Discussion | Class 11/JEE | RAFTAAR', 3469)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, v_chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    for v_goal in
      select id from public.learning_goals where slug = any(array['jee'])
    loop
      insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal.id) on conflict do nothing;
    end loop;

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

  if v_inserted <> 1 then
    raise exception 'expected 1 lessons for "%", inserted %', 'Mathematical Induction — Maths Raftaar', v_inserted;
  end if;

  -- A new chapter must not be left empty, and no lesson may be left unfiled.
  if not exists (select 1 from public.videos where chapter_id = v_chapter_id) then
    raise exception 'chapter "%" is still empty after the import', 'Principle of Mathematical Induction';
  end if;
  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Mathematical Induction — Maths Raftaar';
  end if;
end $$;
