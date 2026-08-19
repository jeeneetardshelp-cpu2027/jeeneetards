-- CREATE-ONLY production artifact: Competishun+ IOQC 2021–2022 Solutions.
-- Reviewed package SHA-256:
--   62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
-- The videos are official-channel uploads outside the public playlist set, so
-- youtube_playlist_id is intentionally NULL. No existing row may be reused.
begin;

do $ioqc_2021_2022$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_fingerprint text;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 293
     or (select count(*) from public.videos) <> 3090
     or (select count(*) from public.playlist_videos) <> 3096
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90 then
    raise exception 'IOQC 2021-2022 baseline changed';
  end if;

  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw'
    and name = 'Competishun+';
  select id into strict v_goal_id
  from public.learning_goals
  where slug = 'olympiad';

  if not exists (
    select 1 from public.categories where id = 3 and slug = 'olympiad'
  ) or not exists (
    select 1 from public.subjects where id = 2 and slug = 'chemistry'
  ) or not exists (
    select 1 from public.chapters
    where id = 295 and subject_id = 2 and name = 'IOQC Solutions'
  ) or (select count(*) from public.class_levels
        where slug in ('class-11', 'class-12', 'dropper')) <> 3 then
    raise exception 'IOQC 2021-2022 reference data mismatch';
  end if;

  if not exists (
    select 1
    from public.playlists p
    where p.title = 'Jahn–Teller Distortion'
      and p.youtube_playlist_id is null
      and p.teacher = 'Competishun+'
      and p.category_id = 1
      and p.subject_id = 2
      and (select count(*) from public.playlist_videos pv
           where pv.playlist_id = p.id) = 2
  ) then
    raise exception 'required Jahn-Teller predecessor is missing';
  end if;
  if exists (
    select 1 from public.playlists where title = 'IOQC 2021–2022 Solutions'
  ) then
    raise exception 'IOQC 2021-2022 course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(
      array['lAwzadMpkSE', '0DopkpuIfC0', 'xnnuW1XaSEg']
    )
  ) then
    raise exception 'IOQC 2021-2022 video reuse detected';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'IOQC 2021–2022 Solutions',
    'IOQC 2021–2022 Solutions (Competishun+ uploads)',
    'Reviewed chemistry olympiad solutions curated from official Competishun+ channel uploads.',
    'Competishun+', v_channel_id, 3, 2, 'pyq', 'hinglish',
    'advanced', 'Dropper'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id
  from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'lAwzadMpkSE', 'IOQC 2021–2022 Solutions — Part 1',
       'IOQC 2021-2022 PART-1 SOLUTION|CHEMISTRY OLYMPIADS|INCHO|ACT|IAPT|HBSCE|ICHO|RIYA MA''AM', 3294),
      (2, '0DopkpuIfC0', 'IOQC 2021–2022 Solutions — Part 2, Problem 1',
       'IOQC 2021-2022 PART-2 SOLUTION | PROBLEM-1 | RIYA MA''AM', 1924),
      (3, 'xnnuW1XaSEg', 'IOQC 2021–2022 Solutions — Part 2, Problem 2',
       'IOQC 2021-2022 PART-2 SOLUTION|PROBLEM-2|CHEMISTRY OLYMPIADS|INCHO|ACT|IAPT|HBSCE|ICHO|RIYA MA''AM', 2215)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status,
      last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title,
      v_channel_id, 3, 2, 295, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, id
    from public.class_levels
    where slug in ('class-11', 'class-12', 'dropper');
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlists) <> 294
     or (select count(*) from public.videos) <> 3093
     or (select count(*) from public.playlist_videos) <> 3099
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90
     or (select count(*) from public.playlist_videos
         where playlist_id = v_playlist_id) <> 3
     or (select count(*) from public.playlist_learning_goals
         where playlist_id = v_playlist_id and learning_goal_id = v_goal_id) <> 1
     or (select count(*) from public.playlist_class_levels
         where playlist_id = v_playlist_id) <> 3
     or (select count(*) from public.video_learning_goals
         where learning_goal_id = v_goal_id
           and video_id in (
             select video_id from public.playlist_videos
             where playlist_id = v_playlist_id
           )) <> 3
     or (select count(*) from public.video_class_levels
         where video_id in (
           select video_id from public.playlist_videos
           where playlist_id = v_playlist_id
         )) <> 9 then
    raise exception 'IOQC 2021-2022 post-import totals mismatch';
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
    raise exception 'IOQC 2021-2022 changed rolling JEE counts';
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
$ioqc_2021_2022$;

commit;
