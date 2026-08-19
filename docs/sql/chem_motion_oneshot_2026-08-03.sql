-- CREATE-ONLY import: Motion Kota Chemistry for JEE.
--
-- These are the last cleanly-mappable JEE Chemistry lessons available from the
-- five institutes now in the catalogue. Across both files they close two
-- chapters -- Solid State and Solutions -- and give three more a third
-- institute.
--
-- HONEST CEILING, recorded so nobody re-runs this search expecting more:
-- 16 JEE Chemistry chapters stay single-institute after this (Hydrogen,
-- s-Block, both p-Block groups, Redox Reactions, Chemical Kinetics, Surface
-- Chemistry, Nuclear Chemistry, Qualitative Analysis, Basic Inorganic
-- Nomenclature, Structural Isomerism, Introduction to Chemistry, General
-- Inorganic Chemistry and the rest). All five institutes teach those inside
-- COMBINED one-shots -- "Mole & Redox", "P Block + D and F Block", "GOC,
-- Isomerism & Alkyl Halide" -- which have no single correct chapter_id and are
-- excluded here for the same reason they were excluded everywhere else. Closing
-- them needs a source that teaches physical and inorganic chemistry chapter by
-- chapter; none of the five does.
--
-- Source     : Motion Kota — https://www.youtube.com/playlist?list=PLZYt2g8epPyvCmhBKGmqxLj6xAqeRFfe_
-- Lessons    : 4    Chapters: 4
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API, all hosted on this one channel, none already present.
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCd7OIpmiEXf3iu1cir6-PrA';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('Motion Kota', 'UCd7OIpmiEXf3iu1cir6-PrA') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Chemistry One Shot — Motion JEE') then
    raise exception 'course "%" already exists - this file has already been run', 'Chemistry One Shot — Motion JEE';
  end if;

  if exists (select 1 from public.videos where youtube_video_id = any(array['P6sRIKQ-wgI', 'N9O76tD2v8E', 'M_2iZj6akfw', 'ee8Xpl_smLo'])) then
    raise exception 'at least one of these 4 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Chemistry One Shot — Motion JEE', 'Chemistry One Shot — Motion JEE', 'Full-chapter one-shot Chemistry lectures from the official Motion Kota JEE channel.',
    null, v_channel_id, 1, 2, 'one-shot', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'P6sRIKQ-wgI', 'Chemical Bonding', 'Chemical Bonding Explained|JEE One Shot Chemistry|Motion JEE #jee2023 #jeechemistry #motioneducation', 9468, 86),
      (2, 'N9O76tD2v8E', 'Liquid Solutions', 'Liquid Solutions Explained | JEE One Shot - Chemistry | Motion JEE #jee2023 #motioneducation', 11360, 33),
      (3, 'M_2iZj6akfw', 'Coordination Compound', 'Coordination Compound Explained | JEE One Shot - Chemistry | Motion JEE #jee2023 #motioneducation', 11740, 87),
      (4, 'ee8Xpl_smLo', 'Chemical Equilibrium', 'Chemical Equilibrium Explained|JEE One Shot- Chemistry|Motion JEE #jee2023 #motionkota #jeechemistry', 11597, 30)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 2) then
      raise exception 'chapter % is not a Chemistry chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
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
    raise exception 'expected 4 lessons for "%", inserted %', 'Chemistry One Shot — Motion JEE', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Chemistry One Shot — Motion JEE';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Chemistry One Shot — Motion JEE';
  end if;
end $$;
