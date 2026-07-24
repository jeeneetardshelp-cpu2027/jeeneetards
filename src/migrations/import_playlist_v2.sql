-- ============================================================
--  import_playlist v2  —  HARDENED. DO NOT run against production
--  until reviewed. Validates every field/relationship before it
--  writes, supports merge|replace, keeps the whole import (incl.
--  chapter creation) in ONE transaction, and is locked down for
--  authenticated + service_role only.
--
--  Depends on: import_rpc.sql (v1) having added playlists.audience_focus,
--  and the learning-goal / class-level tables + junctions.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SOURCE OF TRUTH for class filtering.
--    Decision: playlist_class_levels (the JUNCTION) is authoritative.
--    playlists.class_levels[] becomes a DENORMALISED MIRROR kept in sync
--    by this trigger, so the two can never drift by application convention.
--    Reads may use either; writes go to the junction.
-- ------------------------------------------------------------
create or replace function public.sync_playlist_class_levels_array()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pid bigint := coalesce(new.playlist_id, old.playlist_id);
begin
  update public.playlists p
     set class_levels = coalesce((
        select array_agg(cl.slug_label order by cl.display_order)
        from public.playlist_class_levels pcl
        join (
          select id, display_order,
                 case slug when 'class-10' then '10th' when 'class-11' then '11th'
                           when 'class-12' then '12th' when 'dropper' then 'Dropper'
                           else slug end as slug_label
          from public.class_levels
        ) cl on cl.id = pcl.class_level_id
        where pcl.playlist_id = v_pid
     ), '{}')
   where p.id = v_pid;
  return null;
end;
$$;

drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels;
create trigger trg_sync_pl_class_array
  after insert or delete on public.playlist_class_levels
  for each row execute function public.sync_playlist_class_levels_array();


-- ------------------------------------------------------------
-- 2. The hardened import function.
-- ------------------------------------------------------------
create or replace function public.import_playlist(payload jsonb, mode text default 'merge')
returns jsonb
language plpgsql
security definer
set search_path = ''            -- hardened: every object below is schema-qualified
as $$
declare
  MAX_VIDEOS   constant int := 500;
  v_channel_id bigint;
  v_playlist_id bigint;
  v_goal_id    bigint;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id  bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id  bigint := nullif(payload->>'chapter_id','')::bigint;
  v_chapter_name text  := nullif(payload->>'chapter_name','');
  v_title      text    := nullif(trim(payload->>'title'),'');
  v_focus      text    := nullif(payload->>'audience_focus','');
  v_labels     text[];
  v_class_ids  bigint[];
  v_video      jsonb;
  v_video_id   bigint;
  v_cid        bigint;
  v_vids       jsonb   := payload->'videos';
  v_count      int;
  v_pos        int := 0;
  v_added      int := 0;
  v_reused     int := 0;
  v_reused_pl  boolean := false;
  v_keep_ids   bigint[] := '{}';
begin
  ---------------------------------------------------------------
  -- AUTHORISATION
  ---------------------------------------------------------------
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  ---------------------------------------------------------------
  -- VALIDATION (fail before writing anything)
  ---------------------------------------------------------------
  if mode not in ('merge','replace') then
    raise exception 'invalid mode %, expected merge|replace', mode;
  end if;
  if v_title is null then raise exception 'title is required'; end if;
  if nullif(payload->>'youtube_playlist_id','') is null then
    raise exception 'youtube_playlist_id is required'; end if;

  -- category must exist and map to a learning goal
  if v_category_id is null or not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'invalid category_id %', v_category_id; end if;
  select lg.id into v_goal_id
    from public.learning_goals lg
    join public.categories c on c.name = lg.name
   where c.id = v_category_id;
  if v_goal_id is null then
    raise exception 'no learning-goal mapping for category %', v_category_id; end if;

  -- subject must exist
  if v_subject_id is null or not exists (select 1 from public.subjects where id = v_subject_id) then
    raise exception 'invalid subject_id %', v_subject_id; end if;

  -- class labels: non-empty and all known
  select coalesce(array_agg(x), '{}') into v_labels
    from jsonb_array_elements_text(payload->'class_labels') x;
  if array_length(v_labels,1) is null then
    raise exception 'at least one class label is required'; end if;
  if exists (select 1 from unnest(v_labels) l where lower(l) not in ('10th','11th','12th','dropper')) then
    raise exception 'unknown class label in %', v_labels; end if;
  select coalesce(array_agg(cl.id), '{}') into v_class_ids
    from unnest(v_labels) as label
    join public.class_levels cl on cl.slug = case lower(label)
        when '10th' then 'class-10' when '11th' then 'class-11'
        when '12th' then 'class-12' when 'dropper' then 'dropper' end;
  if array_length(v_class_ids,1) <> array_length(v_labels,1) then
    raise exception 'a class label did not resolve to a class_levels row'; end if;

  -- audience focus, if given, must be one of the applicable classes
  if v_focus is not null and not (v_focus = any(v_labels)) then
    raise exception 'audience_focus % is not among applicable classes %', v_focus, v_labels; end if;

  -- videos: present, sane count, valid + unique ids
  if v_vids is null or jsonb_typeof(v_vids) <> 'array' or jsonb_array_length(v_vids) = 0 then
    raise exception 'videos must be a non-empty array'; end if;
  v_count := jsonb_array_length(v_vids);
  if v_count > MAX_VIDEOS then
    raise exception 'playlist too large (% videos, max %)', v_count, MAX_VIDEOS; end if;
  if exists (
      select 1 from jsonb_array_elements(v_vids) e
      where (e->>'youtube_video_id') is null
         or (e->>'youtube_video_id') !~ '^[A-Za-z0-9_-]{11}$') then
    raise exception 'a video has a missing/invalid youtube_video_id'; end if;
  if (select count(distinct e->>'youtube_video_id') from jsonb_array_elements(v_vids) e) <> v_count then
    raise exception 'duplicate youtube_video_id in payload'; end if;

  -- channel: existing id, else find/create by youtube_channel_id
  v_channel_id := nullif(payload->>'channel_id','')::bigint;
  if v_channel_id is not null then
    if not exists (select 1 from public.institutes_channels where id = v_channel_id) then
      raise exception 'invalid channel_id %', v_channel_id; end if;
  else
    if nullif(payload#>>'{channel,youtube_channel_id}','') is null then
      raise exception 'channel_id or channel.youtube_channel_id required'; end if;
    select id into v_channel_id from public.institutes_channels
     where youtube_channel_id = payload#>>'{channel,youtube_channel_id}';
    if v_channel_id is null then
      insert into public.institutes_channels (name, youtube_channel_id)
      values (payload#>>'{channel,name}', payload#>>'{channel,youtube_channel_id}')
      returning id into v_channel_id;
    end if;
  end if;

  -- chapter: resolve-or-create IN THIS TRANSACTION; enforce subject match
  if v_chapter_id is not null then
    if not exists (select 1 from public.chapters c where c.id = v_chapter_id and c.subject_id = v_subject_id) then
      raise exception 'chapter % does not belong to subject %', v_chapter_id, v_subject_id; end if;
  elsif v_chapter_name is not null then
    select id into v_chapter_id from public.chapters
     where subject_id = v_subject_id and name = v_chapter_name;
    if v_chapter_id is null then
      insert into public.chapters (name, slug, subject_id)
      values (v_chapter_name,
              regexp_replace(regexp_replace(lower(v_chapter_name), '[^a-z0-9]+','-','g'), '(^-+|-+$)','','g'),
              v_subject_id)
      returning id into v_chapter_id;
    end if;
  end if;  -- else chapter_id stays null (allowed by schema)

  ---------------------------------------------------------------
  -- WRITE  (all-or-nothing: one plpgsql function = one transaction)
  ---------------------------------------------------------------
  select id into v_playlist_id from public.playlists
   where youtube_playlist_id = payload->>'youtube_playlist_id';

  if v_playlist_id is null then
    insert into public.playlists (
        title, teacher, channel_id, category_id, subject_id,
        content_type, language, difficulty, audience_focus,
        youtube_playlist_id, last_verified_at)
    values (
        v_title, nullif(payload->>'teacher',''), v_channel_id, v_category_id, v_subject_id,
        nullif(payload->>'content_type',''), nullif(payload->>'language',''),
        nullif(payload->>'difficulty',''), v_focus,
        payload->>'youtube_playlist_id', now())
    returning id into v_playlist_id;
  else
    v_reused_pl := true;
    if mode = 'replace' then
      -- REPLACE: reviewed metadata + taxonomy set exactly.
      update public.playlists set
          title = v_title, teacher = nullif(payload->>'teacher',''),
          category_id = v_category_id, subject_id = v_subject_id,
          content_type = nullif(payload->>'content_type',''),
          language = nullif(payload->>'language',''),
          difficulty = nullif(payload->>'difficulty',''),
          audience_focus = v_focus, last_verified_at = now()
       where id = v_playlist_id;
      -- replace PLAYLIST taxonomy exactly (never touches shared VIDEO taxonomy)
      delete from public.playlist_learning_goals where playlist_id = v_playlist_id;
      delete from public.playlist_class_levels   where playlist_id = v_playlist_id;
    else
      -- MERGE: fill gaps only; never overwrite curated non-null values.
      update public.playlists set
          content_type   = coalesce(content_type,   nullif(payload->>'content_type','')),
          language       = coalesce(language,        nullif(payload->>'language','')),
          difficulty     = coalesce(difficulty,      nullif(payload->>'difficulty','')),
          audience_focus = coalesce(audience_focus,  v_focus),
          last_verified_at = now()
       where id = v_playlist_id;
    end if;
  end if;

  -- playlist junctions (merge: additive; replace: set exactly, re-inserted here)
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_playlist_id, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;

  -- videos
  for v_video in select * from jsonb_array_elements(v_vids) loop
    v_pos := v_pos + 1;
    select id into v_video_id from public.videos
     where youtube_video_id = v_video->>'youtube_video_id';
    if v_video_id is null then
      insert into public.videos (
          youtube_video_id, title, channel_id, category_id, subject_id, chapter_id,
          duration_seconds, caption_status, embedding_status, last_verified_at)
      values (
          v_video->>'youtube_video_id', v_video->>'title', v_channel_id,
          v_category_id, v_subject_id, v_chapter_id,
          nullif(v_video->>'duration_seconds','')::int,
          nullif(v_video->>'caption_status',''), nullif(v_video->>'embedding_status',''), now())
      returning id into v_video_id;
      v_added := v_added + 1;
    else
      v_reused := v_reused + 1;
      -- Reused (maybe shared with other playlists): refresh SAFE YouTube facts
      -- only. Do NOT overwrite the (possibly curated) title or re-home the video.
      update public.videos set
          duration_seconds = coalesce(nullif(v_video->>'duration_seconds','')::int, duration_seconds),
          caption_status   = coalesce(nullif(v_video->>'caption_status',''), caption_status),
          embedding_status = coalesce(nullif(v_video->>'embedding_status',''), embedding_status),
          last_verified_at = now()
       where id = v_video_id;
    end if;

    -- VIDEO taxonomy is ALWAYS additive — shared videos keep other memberships.
    insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal_id) on conflict do nothing;
    foreach v_cid in array v_class_ids loop
      insert into public.video_class_levels (video_id, class_level_id)
        values (v_video_id, v_cid) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_playlist_id, v_video_id, v_pos)
      on conflict (playlist_id, video_id) do update set position = excluded.position;
    v_keep_ids := v_keep_ids || v_video_id;
  end loop;

  -- REPLACE: drop links to videos no longer in the playlist (stale removal).
  -- Only the LINK row is removed; the video and its shared taxonomy remain.
  if mode = 'replace' then
    delete from public.playlist_videos
     where playlist_id = v_playlist_id and video_id <> all(v_keep_ids);
  end if;

  return jsonb_build_object(
    'playlist_id', v_playlist_id, 'mode', mode, 'reused_playlist', v_reused_pl,
    'videos_added', v_added, 'videos_reused', v_reused, 'lessons', v_pos);
end;
$$;


-- ------------------------------------------------------------
-- 3. LOCK DOWN execution.
-- ------------------------------------------------------------
revoke all on function public.import_playlist(jsonb, text) from public;
revoke all on function public.import_playlist(jsonb, text) from anon;
-- Drop the v1 single-arg signature so only the hardened one remains.
drop function if exists public.import_playlist(jsonb);
grant execute on function public.import_playlist(jsonb, text) to authenticated, service_role;
