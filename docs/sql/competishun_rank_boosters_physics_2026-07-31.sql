-- CREATE-ONLY production artifact: Rank Boosters — Physics.
-- Shared source playlist: PLO1SoY_zaltU (youtube_playlist_id intentionally NULL).
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
begin;

do $rank_boosters_physics$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_fingerprint text;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 289
     or (select count(*) from public.videos) <> 3074
     or (select count(*) from public.playlist_videos) <> 3080
     or (select count(*) from public.chapters) <> 241 then
    raise exception 'Rank Boosters Physics baseline changed';
  end if;

  select id into strict v_channel_id from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if (select count(*) from public.class_levels
      where slug in ('class-11', 'class-12', 'dropper')) <> 3 then
    raise exception 'Rank Boosters Physics class reference mismatch';
  end if;
  if not exists (select 1 from public.chapters where id = 21 and subject_id = 1 and name = 'Work, Energy and Power')
     or not exists (select 1 from public.chapters where id = 6 and subject_id = 1 and name = 'Newton''s Laws of Motion (NLM)')
     or not exists (select 1 from public.chapters where id = 20 and subject_id = 1 and name = 'Ray Optics and Optical Instruments') then
    raise exception 'Rank Boosters Physics chapter reference mismatch';
  end if;
  if exists (select 1 from public.playlists where youtube_playlist_id = 'PLO1SoY_zaltU') then
    raise exception 'Rank Boosters source playlist is already claimed';
  end if;
  if exists (select 1 from public.playlists where title = 'Rank Boosters — Physics') then
    raise exception 'Rank Boosters Physics course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array['Hmbch7zot8c', 'Lf4PQl4ffr8', 'YPnPX59h89E', 'XDJoI4apZw0'])
  ) then
    raise exception 'Rank Boosters Physics video reuse detected';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Rank Boosters — Physics', 'Rank Boosters',
    'Physics lectures curated from the official mixed-subject Competishun+ Rank Boosters playlist.',
    'Competishun+', v_channel_id, 1, 1, 'practice', 'hinglish', 'advanced', 'Dropper'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'Hmbch7zot8c', 'wpe', 566, 21),
      (2, 'Lf4PQl4ffr8', 'JEE Advanced Rope Bead Problem Full Solution #jeeadvanced', 744, 21),
      (3, 'YPnPX59h89E', 'Effective Mass in Atwood Machine | Advanced Newton''s Laws | JEE Main & Advanced Physics #abjsir', 1963, 6),
      (4, 'XDJoI4apZw0', 'JEE Advanced Physics: Non-Paraxial Rays Through Plane Surface | Complete Derivation', 1053, 20)
    ) as x(position, youtube_video_id, title, duration_seconds, chapter_id)
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.title, v_channel_id, 1,
      1, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;
    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, id from public.class_levels
    where slug in ('class-11', 'class-12', 'dropper');
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
  end loop;

  if (select count(*) from public.playlists) <> 290
     or (select count(*) from public.videos) <> 3078
     or (select count(*) from public.playlist_videos) <> 3084
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 4 then
    raise exception 'Rank Boosters Physics post-import totals mismatch';
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
$rank_boosters_physics$;

commit;
