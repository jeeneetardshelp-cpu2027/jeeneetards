-- CREATE-ONLY production artifact: Rank Boosters — Chemistry.
-- Shared source playlist: PLO1SoY_zaltU (youtube_playlist_id intentionally NULL).
-- Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
begin;

do $rank_boosters_chemistry$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_fingerprint text;
  v_row record;
begin
  if (select count(*) from public.playlists) <> 290
     or (select count(*) from public.videos) <> 3078
     or (select count(*) from public.playlist_videos) <> 3084
     or (select count(*) from public.chapters) <> 241 then
    raise exception 'Rank Boosters Chemistry baseline changed';
  end if;

  select id into strict v_channel_id from public.institutes_channels
  where youtube_channel_id = 'UC6ieIswHA9WInRsa2r88hRw';
  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if (select count(*) from public.class_levels
      where slug in ('class-11', 'class-12', 'dropper')) <> 3 then
    raise exception 'Rank Boosters Chemistry class reference mismatch';
  end if;
  if not exists (select 1 from public.chapters where id = 30 and subject_id = 2 and name = 'Chemical Equilibrium')
     or not exists (select 1 from public.chapters where id = 86 and subject_id = 2 and name = 'Chemical Bonding and Molecular Structure')
     or not exists (select 1 from public.chapters where id = 96 and subject_id = 2 and name = 'Some Basic Principles of Organic Chemistry')
     or not exists (select 1 from public.chapters where id = 37 and subject_id = 2 and name = 'Atomic Structure')
     or not exists (select 1 from public.chapters where id = 95 and subject_id = 2 and name = 'Redox Reactions') then
    raise exception 'Rank Boosters Chemistry chapter reference mismatch';
  end if;
  if exists (select 1 from public.playlists where youtube_playlist_id = 'PLO1SoY_zaltU') then
    raise exception 'Rank Boosters source playlist is already claimed';
  end if;
  if exists (select 1 from public.playlists where title = 'Rank Boosters — Chemistry') then
    raise exception 'Rank Boosters Chemistry course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array['h2Xm0S2WQOU', 'Zj68NfCS-MM', 'PaS0OpRkR6g', 'zIJdg0KnHx8', '9PRMeoPIMXI'])
  ) then
    raise exception 'Rank Boosters Chemistry video reuse detected';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Rank Boosters — Chemistry', 'Rank Boosters',
    'Chemistry lectures curated from the official mixed-subject Competishun+ Rank Boosters playlist.',
    'Competishun+', v_channel_id, 1, 2, 'practice', 'hinglish', 'advanced', 'Dropper'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'h2Xm0S2WQOU', 'Le Chatelier’s Principle | Inert Gas, Pressure & Equilibrium| JEE Chemistry #alksir', 397, 30),
      (2, 'Zj68NfCS-MM', 'Bentz''s Rule in Chemical Bonding | PF₃Cl₂ Bond Lengths & JEE Advanced Concept Question #alksir', 199, 86),
      (3, 'PaS0OpRkR6g', 'Most Expected JEE Advanced Organic Chemistry Question | Resonance Trick Explained #jee2027', 305, 96),
      (4, 'zIJdg0KnHx8', 'Wave Function Explained for JEE Advanced | Quantum Mechanics | JEE Chemistry Made Easy', 368, 37),
      (5, '9PRMeoPIMXI', 'JEE Advanced Titration Trick 🔥 Flow Diagram Method | Complex Redox + Precipitation Questions', 323, 95)
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

  if (select count(*) from public.playlists) <> 291
     or (select count(*) from public.videos) <> 3083
     or (select count(*) from public.playlist_videos) <> 3089
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.playlist_videos where playlist_id = v_playlist_id) <> 5 then
    raise exception 'Rank Boosters Chemistry post-import totals mismatch';
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
$rank_boosters_chemistry$;

commit;
