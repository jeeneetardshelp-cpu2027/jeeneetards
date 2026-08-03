-- CREATE-ONLY production artifact: Competishun+ Ellipse, Class XI.
-- Shared source playlist: PLQsNiHo64JI-JuKsH0SfhjK9r01339sAl
-- Reviewed attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_expected text[] := array[
    'PCE3VDwe2EE', 'uc3GTPalZbY', '5wMGKPSmrHY', 'RxEVQWF6LII'
  ];
  v_row record;
begin
  if (select count(*) from public.playlists) <> 192
     or (select count(*) from public.videos) <> 2315
     or (select count(*) from public.playlist_videos) <> 2321
     or (select count(*) from public.chapters) <> 220 then
    raise exception 'catalogue baseline changed before Ellipse import';
  end if;

  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-11';
  if not exists (
    select 1 from public.chapters
    where id = 60 and subject_id = 3 and name = 'Ellipse'
  ) then raise exception 'Ellipse chapter mismatch'; end if;
  if exists (
    select 1 from public.playlists
    where title = 'Ellipse | Class XI Mathematics'
  ) then raise exception 'Ellipse course already exists'; end if;
  if exists (
    select 1 from public.videos where youtube_video_id = any(v_expected)
  ) then raise exception 'Ellipse source video reuse detected'; end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Ellipse | Class XI Mathematics',
    'Conic section I Class - XI Mathematics',
    'Curated from the official Competishun+ Conic section playlist; Ellipse lessons only.',
    'Competishun+', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '11th'
  ) returning id into v_playlist_id;
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id);

  for v_row in
    select * from (values
      (1, 'PCE3VDwe2EE', 'Ellipse L-1 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 4839),
      (2, 'uc3GTPalZbY', 'Ellipse L-2 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5377),
      (3, '5wMGKPSmrHY', 'Ellipse L-3 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5352),
      (4, 'RxEVQWF6LII', 'Ellipse L-4 | IIT JEE Mathematics Class 11 | Complete Chapter for JEE Main & Advanced', 5147)
    ) as x(position, youtube_video_id, title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status,
      last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      3, 60, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 4
  then raise exception 'Ellipse membership count mismatch'; end if;
end $$;
