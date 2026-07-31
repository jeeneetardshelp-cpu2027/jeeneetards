-- CREATE-ONLY production artifact: JEE Advanced Practice Series — Chemistry.
-- Shared source playlist: PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3.
-- youtube_playlist_id is intentionally NULL because Mathematics course 248
-- already owns the real source ID.
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
begin;

do $jee_advanced_practice_chemistry$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_fingerprint text;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 291
     or (select count(*) from public.videos) <> 3083
     or (select count(*) from public.playlist_videos) <> 3089
     or (select count(*) from public.chapters) <> 241 then
    raise exception 'JEE Advanced Practice Chemistry baseline changed';
  end if;

  select id into strict v_channel_id from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if v_channel_id <> 81 then
    raise exception 'Competishun+ channel reference changed (%)', v_channel_id;
  end if;
  if (select count(*) from public.class_levels
      where slug in ('class-11', 'class-12', 'dropper')) <> 3 then
    raise exception 'JEE Advanced Practice Chemistry class reference mismatch';
  end if;
  if not exists (select 1 from public.chapters where id = 95 and subject_id = 2 and name = 'Redox Reactions')
     or not exists (select 1 from public.chapters where id = 92 and subject_id = 2 and name = 'Organic Compounds Containing Oxygen')
     or not exists (select 1 from public.chapters where id = 288 and subject_id = 2 and name = 'Organic Reaction Mechanisms')
     or not exists (select 1 from public.chapters where id = 54 and subject_id = 2 and name = 'Mole Concept')
     or not exists (select 1 from public.chapters where id = 88 and subject_id = 2 and name = 'Electrochemistry') then
    raise exception 'JEE Advanced Practice Chemistry chapter reference mismatch';
  end if;
  if (select count(*) from public.playlists
      where youtube_playlist_id = 'PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3') <> 1
     or not exists (
       select 1 from public.playlists
       where id = 248
         and title = 'JEE Advanced Practice Series'
         and subject_id = 3
         and youtube_playlist_id = 'PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3'
     ) then
    raise exception 'JEE Advanced Practice source owner changed';
  end if;
  if exists (select 1 from public.playlists where title = 'JEE Advanced Practice Series — Chemistry') then
    raise exception 'JEE Advanced Practice Chemistry course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'g-Fa0TIitRc', 'oWxR8SdYllY', 'L4dnuL2EAfY', '25WiaWXrh_A', '1yIPYj0vEdk'
    ])
  ) then
    raise exception 'JEE Advanced Practice Chemistry video reuse detected';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'JEE Advanced Practice Series — Chemistry',
    'JEE Advanced Practice Series',
    'Chemistry practice lectures curated from the official mixed-subject Competishun+ JEE Advanced Practice Series playlist.',
    'Competishun+', v_channel_id, 1, 2, 'practice', 'hinglish', 'advanced', 'Dropper'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'g-Fa0TIitRc', 'JEE ADVANCE PRACTICE SERIES|REDOX TITRATION|NUMERICAL |EQUIVALENT CONCEPT|PHYSICAL CHEMISTRY |', 747, 95),
      (2, 'oWxR8SdYllY', 'JEE ADVANCE PRACTICE SERIES|ROADMAP QUESTION|CARBONYL COMPOUNDS|ORGANIC CHEMISTRY |RIYA MA''AM', 647, 92),
      (3, 'L4dnuL2EAfY', 'JEE ADVANCE PRACTICE SERIES|ROADMAP QUESTION|π-bond chemistry|ORGANIC CHEMISTRY |RIYA MA''AM', 552, 288),
      (4, '25WiaWXrh_A', 'JEE ADVANCE PRACTICE SERIES|MOLE CONCEPT|TITRATION|EQUIVALENT CONCEPT|REDOX|PHYSICAL CHEMISTRY|', 852, 54),
      (5, '1yIPYj0vEdk', 'Question based On Potentiometric Titration', 829, 88)
    ) as x(position, youtube_video_id, title, duration_seconds, chapter_id)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, id from public.class_levels
    where slug in ('class-11', 'class-12', 'dropper');
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 5
     or (select youtube_playlist_id from public.playlists where id = v_playlist_id) is not null then
    raise exception 'JEE Advanced Practice Chemistry post-import totals mismatch';
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
    coalesce((select string_agg(row_to_json(y)::text, '|' order by y.playlist_id, y.position, y.id) from (
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
  if v_fingerprint <> '6829fcb6eae22479db7b82b7b3da654d' then
    raise exception 'protected JEE fingerprint changed (%)', v_fingerprint;
  end if;
end
$jee_advanced_practice_chemistry$;

commit;
