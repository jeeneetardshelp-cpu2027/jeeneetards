-- CREATE-ONLY production artifact: split the official Competishun+ Matrices & Determinants playlist.
-- Source: PLQsNiHo64JI-JMoyQnawepxJZRbif_3I0
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8
-- The shared YouTube playlist is represented as two independently browsable courses;
-- youtube_playlist_id remains NULL, matching the established conic split pattern.
begin;

do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_expected text[] := array['veOjPlDl_M0','xYsoYgiOhmI','Lp38n-FdnYg','hGVtE3CNMU8','AhUixJ20Xc0'];
  v_row record;
begin
  if (select count(*) from public.playlists) <> 220
     or (select count(*) from public.videos) <> 2478
     or (select count(*) from public.playlist_videos) <> 2484
     or (select count(*) from public.chapters) <> 226 then
    raise exception 'catalogue baseline changed before Matrices split import';
  end if;
  select id into strict v_channel_id from public.institutes_channels
    where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-12';
  if not exists (select 1 from public.chapters where id = 279 and subject_id = 3 and name = 'Matrices')
  then raise exception 'Matrices chapter mismatch'; end if;
  if exists (select 1 from public.playlists where title = 'Matrices | Class XII Mathematics')
  then raise exception 'Matrices course already exists'; end if;
  if exists (select 1 from public.videos where youtube_video_id = any(v_expected))
  then raise exception 'Matrices source video reuse detected'; end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Matrices | Class XII Mathematics',
    'Matrices & Determinants I Class- XII Mathematics',
    'Curated from the official Competishun+ Matrices & Determinants playlist; Matrices lessons only.',
    'Competishun+', v_channel_id, 1, 3, 'full-course', 'hinglish', 'advanced', '12th'
  ) returning id into v_playlist_id;
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id) values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id) values (v_playlist_id, v_class_id);

  for v_row in select * from (values
    (1, 'veOjPlDl_M0', 'Matrices L-1 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 4845),
    (2, 'xYsoYgiOhmI', 'Matrices L-2 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 3810),
    (3, 'Lp38n-FdnYg', 'Matrices L-3 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 4817),
    (4, 'hGVtE3CNMU8', 'Matrices L-4 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5009),
    (5, 'AhUixJ20Xc0', 'Matrices L-5 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 4923)
  ) as x(position, youtube_video_id, title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      3, 279, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id) values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id) values (v_video_id, v_class_id);
    insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, v_row.position);
  end loop;
  if (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 5
  then raise exception 'Matrices membership count mismatch'; end if;
end $$;

do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_expected text[] := array['fMDLOPNHVs4','MMMSeG-1dAg','r0Y0aRDYjHI'];
  v_row record;
begin
  if (select count(*) from public.playlists) <> 221
     or (select count(*) from public.videos) <> 2483
     or (select count(*) from public.playlist_videos) <> 2489
     or (select count(*) from public.chapters) <> 226 then
    raise exception 'catalogue baseline changed before Determinants split import';
  end if;
  select id into strict v_channel_id from public.institutes_channels
    where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-12';
  if not exists (select 1 from public.chapters where id = 69 and subject_id = 3 and name = 'Determinants')
  then raise exception 'Determinants chapter mismatch'; end if;
  if exists (select 1 from public.playlists where title = 'Determinants | Class XII Mathematics')
  then raise exception 'Determinants course already exists'; end if;
  if exists (select 1 from public.videos where youtube_video_id = any(v_expected))
  then raise exception 'Determinants source video reuse detected'; end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Determinants | Class XII Mathematics',
    'Matrices & Determinants I Class- XII Mathematics',
    'Curated from the official Competishun+ Matrices & Determinants playlist; Determinants lessons only.',
    'Competishun+', v_channel_id, 1, 3, 'full-course', 'hinglish', 'advanced', '12th'
  ) returning id into v_playlist_id;
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id) values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id) values (v_playlist_id, v_class_id);

  for v_row in select * from (values
    (1, 'fMDLOPNHVs4', 'Determinant L-1 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5226),
    (2, 'MMMSeG-1dAg', 'Determinant L-2 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 5172),
    (3, 'r0Y0aRDYjHI', 'Determinant L-3 | IIT JEE Mathematics Class 12 | Complete Chapter for JEE Main & Advanced', 4790)
  ) as x(position, youtube_video_id, title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      3, 69, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id) values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id) values (v_video_id, v_class_id);
    insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, v_row.position);
  end loop;
  if (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 3
  then raise exception 'Determinants membership count mismatch'; end if;
end $$;

do $$
declare
  v_fingerprint text;
begin
  if (select count(*) from public.playlists) <> 222
     or (select count(*) from public.videos) <> 2486
     or (select count(*) from public.playlist_videos) <> 2492
     or (select count(*) from public.chapters) <> 226 then
    raise exception 'catalogue totals mismatch after Matrices/Determinants split';
  end if;

  if (select count(*) from public.playlists
      where title in ('Matrices | Class XII Mathematics',
                      'Determinants | Class XII Mathematics')) <> 2 then
    raise exception 'split course count mismatch';
  end if;

  if exists (
    select 1
    from public.playlists
    where title in ('Matrices | Class XII Mathematics',
                    'Determinants | Class XII Mathematics')
      and youtube_playlist_id is not null
  ) then
    raise exception 'split courses unexpectedly claim the shared YouTube playlist id';
  end if;

  if (select count(*)
      from public.playlist_videos pv
      join public.playlists p on p.id = pv.playlist_id
      where p.title in ('Matrices | Class XII Mathematics',
                        'Determinants | Class XII Mathematics')) <> 8 then
    raise exception 'split membership total mismatch';
  end if;

  select md5(
    coalesce((
      select string_agg(row_to_json(x)::text, '|' order by x.id)
      from (
        select p.id, p.title, p.teacher, p.youtube_playlist_id,
               p.category_id, p.subject_id, p.class_levels,
               p.audience_focus, p.content_type, p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee' and p.id < 167
      ) x
    ), '') || '|' || coalesce((
      select string_agg(row_to_json(y)::text, '|'
                        order by y.playlist_id, y.position, y.id)
      from (
        select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where p.id < 167
          and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee'
          )
      ) y
    ), '')
  ) into v_fingerprint;

  if v_fingerprint <> '6829fcb6eae22479db7b82b7b3da654d' then
    raise exception 'protected JEE fingerprint changed (%)', v_fingerprint;
  end if;
end $$;

commit;
