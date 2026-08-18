-- CREATE-ONLY import: fills the empty "PRMO and IOQM Solutions" chapter.
--
-- Chapter 298 was created on 2026-08-03 with ZERO lessons, so a student who
-- clicked it from Browse saw an empty page. This file gives it real content.
--
-- Scope note: only past-paper SOLUTIONS and mock-paper discussions are included,
-- because that is what the chapter is named. ABJ Sir's 40-video olympiad LECTURE
-- series on the Mohit Tyagi channel (Number Theory, Combinatorics, Principle of
-- Mathematical Induction -- all tagged RMO/PRMO) is real and good, but it is
-- preparation material rather than solutions, and this catalogue has no chapter
-- for it yet. Left out on purpose rather than mis-filed here.
--
-- Source     : ALLEN JEE (UCkUI45drrKTWLxy3q3voJRw)
-- Lessons    : 5
-- Verified   : every id returned HTTP 200 from YouTube's oEmbed API with
--              author_name "ALLEN JEE", and none was already in the catalogue.
-- Durations  : deliberately left NULL. These were read from a channel search
--              listing rather than a playlist payload, and this project does not
--              record a number it has not verified.
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

  select id into strict v_goal_id from public.learning_goals where slug = 'olympiad';

  if not exists (
    select 1 from public.chapters where id = 298 and subject_id = 3 and name = 'PRMO and IOQM Solutions'
  ) then
    raise exception 'chapter 298 is not the expected "PRMO and IOQM Solutions" chapter';
  end if;

  if exists (select 1 from public.playlists where title = 'IOQM Paper Solutions and Mock Discussions') then
    raise exception 'course "%" already exists - this file has already been run', 'IOQM Paper Solutions and Mock Discussions';
  end if;

  if exists (
    select 1 from public.videos where youtube_video_id = any(array['rT_9GvqwOIA', 'b2KINJ2yLr4', 'pDePNkb5gAc', 'fyup0AZgEzk', 'uYc_nD6oDHs'])
  ) then
    raise exception 'at least one of these 5 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'IOQM Paper Solutions and Mock Discussions', 'IOQM Paper Solutions and Mock Discussions', 'IOQM past paper solutions and mock paper discussions, from the official ALLEN JEE channel.',
    null, v_channel_id, 3, 3, 'pyq', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'rT_9GvqwOIA', 'IOQM 2024 — Paper Solutions and Discussion', 'IOQM  2024 Paper Solution + Discussion  — Live Session'),
      (2, 'b2KINJ2yLr4', 'IOQM 2025 — Question Paper Solutions', 'IOQM 2025 Solutions - Live | IOQM 2025 Question Paper Solution by ALLEN JEE'),
      (3, 'pDePNkb5gAc', 'IOQM 2024-25 Mock Test — Discussion', 'IOQM  2024-2025 Mock Test Discussion Live'),
      (4, 'fyup0AZgEzk', 'IOQM 2024-25 Mock Test 2 — Discussion', 'IOQM  2024-2025 Mock Test 2 — Discussion Live'),
      (5, 'uYc_nD6oDHs', 'IOQM 2024-25 Mock Test 3 — Discussion', 'IOQM  2024-2025 Mock Test 3 — Discussion Live')
    ) as x(position, youtube_video_id, title, source_title)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 3,
      3, 298, 'allowed', now()
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

  if v_inserted <> 5 then
    raise exception 'expected 5 lessons for "%", inserted %', 'IOQM Paper Solutions and Mock Discussions', v_inserted;
  end if;

  -- The whole point: this chapter must no longer be empty.
  if not exists (select 1 from public.videos where chapter_id = 298) then
    raise exception 'chapter 298 is still empty after the import';
  end if;
end $$;
