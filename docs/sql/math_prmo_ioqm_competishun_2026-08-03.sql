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
-- Source     : Competishun+ (UC6ieIswHA9WInRsa2r88hRw)
-- Lessons    : 4
-- Verified   : every id returned HTTP 200 from YouTube's oEmbed API with
--              author_name "Competishun+", and none was already in the catalogue.
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('Competishun+', 'UC6ieIswHA9WInRsa2r88hRw') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'olympiad';

  if not exists (
    select 1 from public.chapters where id = 298 and subject_id = 3 and name = 'PRMO and IOQM Solutions'
  ) then
    raise exception 'chapter 298 is not the expected "PRMO and IOQM Solutions" chapter';
  end if;

  if exists (select 1 from public.playlists where title = 'PRMO and IOQM Past Paper Solutions') then
    raise exception 'course "%" already exists - this file has already been run', 'PRMO and IOQM Past Paper Solutions';
  end if;

  if exists (
    select 1 from public.videos where youtube_video_id = any(array['2qm5UjRyIcs', 'X3BWR79DtyU', '3YvuUlM2OHY', 'dows6wBBk3A'])
  ) then
    raise exception 'at least one of these 4 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'PRMO and IOQM Past Paper Solutions', 'PRMO and IOQM Past Paper Solutions', 'Worked solutions to past PRMO and IOQM papers, from the official Competishun+ channel.',
    'Competishun+', v_channel_id, 3, 3, 'pyq', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, '2qm5UjRyIcs', 'IOQM 2020 — Full Paper Solutions', 'IOQM 2020 SOLUTIONS | Indian Olympiad Qualifier For Mathematics | IAPT | HBCSE | PRMO | Competishun'),
      (2, 'X3BWR79DtyU', 'IOQM 2021-22 — Full Paper Solutions', 'IOQM 2021 22 Solutions | Indian Olympiad Qualifier for Mathematics'),
      (3, '3YvuUlM2OHY', 'PRMO 2019 — Solutions to Questions 1 to 15', 'PRMO 2019 SOLUTIONS Q 1 to 15 | Pre Regional Mathematics Olympiad | IAPT | HBCSE'),
      (4, 'dows6wBBk3A', 'PRMO 2018 — Solutions to Questions 1 to 10', 'PRMO 2018 SOLUTIONS Q 1 to 10 | Indian Olympiad Qualifier For Mathematics | IAPT | HBCSE')
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

  if v_inserted <> 4 then
    raise exception 'expected 4 lessons for "%", inserted %', 'PRMO and IOQM Past Paper Solutions', v_inserted;
  end if;

  -- The whole point: this chapter must no longer be empty.
  if not exists (select 1 from public.videos where chapter_id = 298) then
    raise exception 'chapter 298 is still empty after the import';
  end if;
end $$;
