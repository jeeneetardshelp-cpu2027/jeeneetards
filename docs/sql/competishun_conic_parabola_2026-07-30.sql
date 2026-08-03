-- CREATE-ONLY production artifact: Competishun+ Parabola, Class XI.
-- Shared source playlist: PLQsNiHo64JI-JuKsH0SfhjK9r01339sAl
-- Reviewed attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8
-- youtube_playlist_id is intentionally NULL because the source playlist is
-- split into three independently browsable chapter courses.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_expected text[] := array[
    'dcGYeTM_8m0', '0dG3-YVGJ74', 'wSoVyCKUkLs', 'u4QcWvxmrLM'
  ];
  v_row record;
begin
  if (select count(*) from public.playlists) <> 191
     or (select count(*) from public.videos) <> 2311
     or (select count(*) from public.playlist_videos) <> 2317
     or (select count(*) from public.chapters) <> 220 then
    raise exception 'catalogue baseline changed before Parabola import';
  end if;

  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-11';

  if not exists (
    select 1 from public.chapters
    where id = 63 and subject_id = 3 and name = 'Parabola'
  ) then raise exception 'Parabola chapter mismatch'; end if;
  if exists (
    select 1 from public.playlists
    where title = 'Parabola | Class XI Mathematics'
  ) then raise exception 'Parabola course already exists'; end if;
  if exists (
    select 1 from public.videos where youtube_video_id = any(v_expected)
  ) then raise exception 'Parabola source video reuse detected'; end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Parabola | Class XI Mathematics',
    'Conic section I Class - XI Mathematics',
    'Curated from the official Competishun+ Conic section playlist; Parabola lessons only.',
    'Competishun+', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '11th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id);

  for v_row in
    select * from (values
      (1, 'dcGYeTM_8m0', 'Parabola L-1 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5516),
      (2, '0dG3-YVGJ74', 'Parabola L-2 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5267),
      (3, 'wSoVyCKUkLs', 'Parabola L-3 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5528),
      (4, 'u4QcWvxmrLM', 'Parabola L-4 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5393)
    ) as x(position, youtube_video_id, title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status,
      last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      3, 63, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 4
  then raise exception 'Parabola membership count mismatch'; end if;
end $$;
