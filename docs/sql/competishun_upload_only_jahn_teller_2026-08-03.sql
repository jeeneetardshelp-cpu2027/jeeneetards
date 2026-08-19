-- CREATE-ONLY production artifact: Competishun+ Jahn–Teller Distortion.
-- Reviewed package SHA-256:
--   62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
-- The videos are official-channel uploads outside the public playlist set, so
-- youtube_playlist_id is intentionally NULL. No existing row may be reused.
begin;

do $jahn_teller$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_fingerprint text;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90 then
    raise exception 'Jahn-Teller baseline changed';
  end if;

  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw'
    and name = 'Competishun+';
  select id into strict v_goal_id
  from public.learning_goals
  where slug = 'jee';

  if not exists (
    select 1 from public.categories where id = 1 and slug = 'jee'
  ) or not exists (
    select 1 from public.subjects where id = 2 and slug = 'chemistry'
  ) or not exists (
    select 1 from public.chapters
    where id = 87 and subject_id = 2 and name = 'Coordination Compounds'
  ) or not exists (
    select 1 from public.class_levels where slug = 'class-12'
  ) then
    raise exception 'Jahn-Teller reference data mismatch';
  end if;

  if exists (
    select 1 from public.playlists where title = 'Jahn–Teller Distortion'
  ) then
    raise exception 'Jahn-Teller course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array['NW0wDF6acgQ', 'BJlj2EAGLw8'])
  ) then
    raise exception 'Jahn-Teller video reuse detected';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Jahn–Teller Distortion',
    'Jahn–Teller Distortion (Competishun+ uploads)',
    'Two-part advanced lesson on Jahn–Teller distortion, curated from official Competishun+ channel uploads.',
    'Competishun+', v_channel_id, 1, 2, 'full-course', 'hinglish',
    'advanced', '12th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id
  from public.class_levels
  where slug = 'class-12';

  for v_row in
    select * from (values
      (1, 'NW0wDF6acgQ', 'Jahn–Teller Distortion — Part 1',
       'jahn teller distortion(JTD) part-1 | Coordination |  RIYA MA''AM', 2211),
      (2, 'BJlj2EAGLw8', 'Jahn–Teller Distortion — Part 2',
       'Jahn teller distortion part-2 | Coordination compounds | Riya Ma''am', 2937)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status,
      last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title,
      v_channel_id, 1, 2, 87, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, id
    from public.class_levels
    where slug = 'class-12';
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlists) <> 293
     or (select count(*) from public.videos) <> 3090
     or (select count(*) from public.playlist_videos) <> 3096
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90
     or (select count(*) from public.playlist_videos
         where playlist_id = v_playlist_id) <> 2
     or (select count(*) from public.playlist_learning_goals
         where playlist_id = v_playlist_id and learning_goal_id = v_goal_id) <> 1
     or (select count(*) from public.playlist_class_levels
         where playlist_id = v_playlist_id) <> 1
     or (select count(*) from public.video_learning_goals
         where learning_goal_id = v_goal_id
           and video_id in (
             select video_id from public.playlist_videos
             where playlist_id = v_playlist_id
           )) <> 2
     or (select count(*) from public.video_class_levels
         where video_id in (
           select video_id from public.playlist_videos
           where playlist_id = v_playlist_id
         )) <> 2 then
    raise exception 'Jahn-Teller post-import totals mismatch';
  end if;

  if (select count(*)
      from public.playlists p
      where exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee'
      )) <> 168
     or (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
         where exists (
           select 1 from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
           where plg.playlist_id = p.id and lg.slug = 'jee'
         )) <> 1896 then
    raise exception 'Jahn-Teller rolling JEE delta mismatch';
  end if;

  select md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
      from public.playlist_videos pv
      join public.playlists p on p.id = pv.playlist_id
      where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee'
      )
    ) y), '')
  ) into v_fingerprint;
  if v_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'protected JEE fingerprint changed (%)', v_fingerprint;
  end if;
end
$jahn_teller$;

commit;
