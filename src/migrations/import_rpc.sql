-- ============================================================
--  TRANSACTIONAL IMPORT  —  one Postgres function does the whole
--  playlist import atomically. A plpgsql function IS a single
--  transaction: if any statement fails, the ENTIRE import rolls
--  back, so you can never get videos/playlists without their
--  taxonomy relationships. Run once; safe to re-run.
--
--  This replaces the browser making several .insert()/.upsert()
--  calls (which are NOT one transaction). The client now fetches
--  from YouTube, builds a payload, and calls import_playlist() once.
-- ============================================================

-- Audience focus: which class a course is PRIMARILY made for, distinct
-- from the classes it's merely applicable to (class_levels). Lets
-- "dropper-focused" be ranked apart from "also suitable for droppers".
alter table public.playlists add column if not exists audience_focus text;

create or replace function public.import_playlist(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id  bigint;
  v_playlist_id bigint;
  v_goal_id     bigint;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id  bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id  bigint := nullif(payload->>'chapter_id','')::bigint;
  v_labels      text[] := coalesce(
      (select array_agg(x) from jsonb_array_elements_text(payload->'class_labels') x), '{}');
  v_class_ids   bigint[];
  v_video       jsonb;
  v_video_id    bigint;
  v_cid         bigint;
  v_pos         int := 0;
  v_added       int := 0;
  v_reused      int := 0;
  v_reused_pl   boolean := false;
begin
  -- Authorisation — admins (browser) or the service role (local bulk script).
  -- SECURITY DEFINER runs as owner, so we must gate it ourselves.
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  -- Learning goal derived from the (legacy) category, by name.
  select lg.id into v_goal_id
    from public.learning_goals lg
    join public.categories c on c.name = lg.name
   where c.id = v_category_id;

  -- Class labels -> class_levels ids (the applicable classes).
  select coalesce(array_agg(cl.id), '{}') into v_class_ids
    from unnest(v_labels) as label
    join public.class_levels cl on cl.slug = case lower(label)
        when '10th' then 'class-10' when '11th' then 'class-11'
        when '12th' then 'class-12' when 'dropper' then 'dropper' else null end;

  -- 1. Channel — an existing id (admin picks one), else find-or-create by
  --    YouTube channel id (the bulk node importer creates channels).
  v_channel_id := nullif(payload->>'channel_id','')::bigint;
  if v_channel_id is null then
    select id into v_channel_id from public.institutes_channels
     where youtube_channel_id = payload#>>'{channel,youtube_channel_id}';
    if v_channel_id is null then
      insert into public.institutes_channels (name, youtube_channel_id)
      values (payload#>>'{channel,name}', payload#>>'{channel,youtube_channel_id}')
      returning id into v_channel_id;
    end if;
  end if;
  if v_channel_id is null then
    raise exception 'no channel: provide channel_id or channel.youtube_channel_id';
  end if;

  -- 2. Playlist — find or create by YouTube playlist id (re-import reuses it).
  select id into v_playlist_id from public.playlists
   where youtube_playlist_id = payload->>'youtube_playlist_id';

  if v_playlist_id is null then
    insert into public.playlists (
        title, teacher, channel_id, category_id, subject_id, class_levels,
        content_type, language, difficulty, audience_focus,
        youtube_playlist_id, last_verified_at)
    values (
        payload->>'title', nullif(payload->>'teacher',''), v_channel_id,
        v_category_id, v_subject_id, v_labels,
        nullif(payload->>'content_type',''), nullif(payload->>'language',''),
        nullif(payload->>'difficulty',''), nullif(payload->>'audience_focus',''),
        payload->>'youtube_playlist_id', now())
    returning id into v_playlist_id;
  else
    v_reused_pl := true;
    -- Re-import: ADD to classification (never silently drops curated data).
    update public.playlists set
        class_levels   = (select array(select distinct unnest(class_levels || v_labels))),
        content_type   = coalesce(nullif(payload->>'content_type',''), content_type),
        language       = coalesce(nullif(payload->>'language',''), language),
        difficulty     = coalesce(nullif(payload->>'difficulty',''), difficulty),
        audience_focus = coalesce(nullif(payload->>'audience_focus',''), audience_focus),
        last_verified_at = now()
     where id = v_playlist_id;
  end if;

  -- Playlist junctions.
  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_playlist_id, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;

  -- 3. Each video: upsert, junctions, ordered link.
  for v_video in select * from jsonb_array_elements(payload->'videos') loop
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
      -- Reused across playlists: refresh metadata, keep existing relationships.
      update public.videos set
          duration_seconds = coalesce(nullif(v_video->>'duration_seconds','')::int, duration_seconds),
          last_verified_at = now()
       where id = v_video_id;
    end if;

    -- Video junctions — on conflict do nothing preserves multi-goal / multi-class.
    insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal_id) on conflict do nothing;
    foreach v_cid in array v_class_ids loop
      insert into public.video_class_levels (video_id, class_level_id)
        values (v_video_id, v_cid) on conflict do nothing;
    end loop;

    -- Ordered link — dedup on (playlist,video), refresh position.
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_playlist_id, v_video_id, v_pos)
      on conflict (playlist_id, video_id) do update set position = excluded.position;
  end loop;

  return jsonb_build_object(
    'playlist_id', v_playlist_id, 'reused_playlist', v_reused_pl,
    'videos_added', v_added, 'videos_reused', v_reused, 'lessons', v_pos);
end;
$$;

grant execute on function public.import_playlist(jsonb) to authenticated;
