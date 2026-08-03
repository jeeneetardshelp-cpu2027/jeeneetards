-- CREATE-ONLY curated split from playlist PLQsNiHo64JI_ZgwuPziK1FPxw3T-EC1CA.
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 200
     or (select count(*) from public.videos) <> 2371
     or (select count(*) from public.playlist_videos) <> 2377
     or (select count(*) from public.chapters) <> 221 then
    raise exception 'catalogue baseline changed before Definite Integration import';
  end if;

  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-12';

  if not exists (
    select 1 from public.chapters
    where id = 73 and subject_id = 3 and name = 'Definite Integration'
  ) then raise exception 'Definite Integration chapter mismatch'; end if;
  if exists (
    select 1 from public.playlists where title = 'Definite Integration | Class XII Mathematics'
  ) then raise exception 'Definite Integration course already exists'; end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      '2bUAVKLcXDU', 'S3v3dW1aeiE', 'qgKI0-b5FPs',
      'twKtoHEMQWs', 'mITYi2UrFH8', '5FvzNb3F3-4'
    ])
  ) then raise exception 'Definite Integration video reuse detected'; end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Definite Integration | Class XII Mathematics',
    'Definite Integration & Its Applications I Class - XII Mathematics',
    'Curated from the official Competishun+ playlist; Definite Integration lessons only.',
    'Competishun+', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '12th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id);

  for v_row in
    select * from (values
      (1, '2bUAVKLcXDU', 'Definite Integration L-1 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5803),
      (2, 'S3v3dW1aeiE', 'Definite Integration L-2 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 6015),
      (3, 'qgKI0-b5FPs', 'Definite Integration L-3 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5922),
      (4, 'twKtoHEMQWs', 'Definite Integration L-4 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5848),
      (5, 'mITYi2UrFH8', 'Definite Integration L-5 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 4926),
      (6, '5FvzNb3F3-4', 'Definite Integration L-6 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 6227)
    ) as x(position, youtube_video_id, title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      3, 73, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;
end $$;
