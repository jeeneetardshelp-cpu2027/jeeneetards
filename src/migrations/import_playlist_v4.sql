-- ============================================================
--  v4 — functions and reference data. DO NOT apply to production.
--
--  This file is SAFE to apply on its own: it creates/replaces functions and
--  adds reference tables. It deliberately does NOT create the derived-array
--  trigger and does NOT touch playlists.class_levels. That work lives in
--  v4_class_levels_migration.sql, which must be preceded by a reviewed dry-run
--  drift report (see src/scripts/driftReport.js).
--
--  Changes vs v3, per the second review:
--   2. create_course.video_ids fully validated; lesson count verified
--   3. set_video_taxonomy validates goal/class compatibility; clearing is an
--      explicitly named operation (clear_video_taxonomy)
--   4. learning goals are EXPLICIT (learning_goal_id), never derived from the
--      category name; boards get their own classification
--   5. video added/reused counters are correct under concurrent creation
-- ============================================================

-- ------------------------------------------------------------
-- 0. ENVIRONMENT MARKER
-- ------------------------------------------------------------
create table if not exists public.app_environment (
    id      boolean primary key default true check (id),   -- single row
    name    text not null check (name in ('production','staging','test'))
);
alter table public.app_environment enable row level security;
drop policy if exists "env readable" on public.app_environment;
create policy "env readable" on public.app_environment for select using (true);

-- ------------------------------------------------------------
-- 1. GOAL ↔ CLASS COMPATIBILITY
-- ------------------------------------------------------------
create table if not exists public.learning_goal_class_levels (
    learning_goal_id bigint not null references public.learning_goals(id) on delete cascade,
    class_level_id   bigint not null references public.class_levels(id)   on delete cascade,
    primary key (learning_goal_id, class_level_id)
);
alter table public.learning_goal_class_levels enable row level security;
drop policy if exists "public read" on public.learning_goal_class_levels;
create policy "public read" on public.learning_goal_class_levels for select using (true);

insert into public.learning_goal_class_levels (learning_goal_id, class_level_id)
select lg.id, cl.id
  from public.learning_goals lg
  join public.class_levels cl
    on (lg.slug in ('jee','neet','olympiad') and cl.slug in ('class-11','class-12','dropper'))
    or (lg.slug = 'school'                   and cl.slug in ('class-10','class-11','class-12'))
on conflict do nothing;

-- ------------------------------------------------------------
-- 2. TAXONOMY FIX (review item 4)
--
--    v3 resolved the learning goal with `join categories c on c.name = lg.name`.
--    categories are (JEE, NEET, Olympiad); learning_goals also contains
--    'School Boards'. The join therefore returned NULL for school content and
--    every CBSE import failed with "no learning-goal mapping". Worse, it made
--    two independent concepts — "what exam is this for" and "which content
--    bucket does this sit in" — silently depend on matching English names.
--
--    Fix: callers pass learning_goal_id explicitly. Nothing is derived.
--    Boards become their own axis (playlist_boards) instead of being crammed
--    into the goal.
-- ------------------------------------------------------------

-- playlists.category_id is NOT NULL, so school content needs a category to
-- live in. This is a content bucket only — it no longer implies a goal.
insert into public.categories (name, slug, display_order) values
    ('School Boards', 'school-boards', 4)
on conflict (slug) do nothing;

insert into public.boards (name, slug, display_order) values
    ('CBSE', 'cbse', 1), ('ICSE', 'icse', 2), ('State Board', 'state', 3)
on conflict (slug) do nothing;

create table if not exists public.playlist_boards (
    playlist_id bigint not null references public.playlists(id) on delete cascade,
    board_id    bigint not null references public.boards(id)    on delete cascade,
    primary key (playlist_id, board_id)
);
alter table public.playlist_boards enable row level security;
drop policy if exists "public read" on public.playlist_boards;
create policy "public read" on public.playlist_boards for select using (true);
create index if not exists idx_pb_board on public.playlist_boards (board_id);

-- ------------------------------------------------------------
-- 3. DERIVED ARRAY HELPER
--    Defined here because both the audit migration and the trigger need it.
--    NOTE: no trigger is created in this file. See v4_class_levels_migration.sql.
-- ------------------------------------------------------------
create or replace function public.derived_class_levels(p_playlist_id bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(lbl order by ord), '{}')
  from (
    select case cl.slug when 'class-10' then '10th' when 'class-11' then '11th'
                        when 'class-12' then '12th' when 'dropper' then 'Dropper'
                        else cl.slug end as lbl,
           cl.display_order as ord
    from public.playlist_class_levels pcl
    join public.class_levels cl on cl.id = pcl.class_level_id
    where pcl.playlist_id = p_playlist_id
  ) s;
$$;

-- Label ↔ slug translation lives in SQL, in ONE place.
create or replace function public.class_label_to_slug(p_label text)
returns text language sql immutable set search_path = '' as $$
  select case lower(trim(p_label))
           when '10th' then 'class-10' when '11th' then 'class-11'
           when '12th' then 'class-12' when 'dropper' then 'dropper' end;
$$;

-- ------------------------------------------------------------
-- 4. SHARED VALIDATION
-- ------------------------------------------------------------
create or replace function public.validate_import_payload(payload jsonb, mode text, require_videos boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  MAX_VIDEOS constant int := 500;
  MAX_SECS   constant int := 86400;          -- 24h per lecture
  v_goal_id bigint := nullif(payload->>'learning_goal_id','')::bigint;
  v_goal_slug text;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id  bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id  bigint := nullif(payload->>'chapter_id','')::bigint;
  v_labels text[]; v_class_ids bigint[]; v_board_ids bigint[];
  v_focus text := nullif(payload->>'audience_focus','');
  v_vids jsonb := payload->'videos'; v_count int;
  v_ypid text := nullif(payload->>'youtube_playlist_id','');
  v_vid_ids jsonb := payload->'video_ids'; v_vid_count int;
begin
  if mode not in ('merge','replace') then raise exception 'invalid mode %, expected merge|replace', mode; end if;
  if nullif(trim(payload->>'title'),'') is null then raise exception 'title is required'; end if;

  -- An imported course must name its source playlist; a hand-made one need not.
  if require_videos and v_ypid is null then raise exception 'youtube_playlist_id is required'; end if;
  if v_ypid is not null and v_ypid !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_playlist_id format'; end if;
  if payload ? 'channel' and nullif(payload#>>'{channel,youtube_channel_id}','') is not null
     and (payload#>>'{channel,youtube_channel_id}') !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_channel_id format'; end if;

  -- ---- learning goal: EXPLICIT (review item 4) ----
  if v_goal_id is null then
    raise exception 'learning_goal_id is required (it is no longer derived from the category)'; end if;
  select slug into v_goal_slug from public.learning_goals where id = v_goal_id;
  if v_goal_slug is null then raise exception 'invalid learning_goal_id %', v_goal_id; end if;

  if v_category_id is null or not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'invalid category_id %', v_category_id; end if;
  if v_subject_id is null or not exists (select 1 from public.subjects where id = v_subject_id) then
    raise exception 'invalid subject_id %', v_subject_id; end if;
  if v_chapter_id is not null and not exists (
      select 1 from public.chapters where id = v_chapter_id and subject_id = v_subject_id) then
    raise exception 'chapter % does not belong to subject %', v_chapter_id, v_subject_id; end if;

  -- ---- boards (own axis) ----
  if payload ? 'board_ids' then
    if jsonb_typeof(payload->'board_ids') <> 'array' then raise exception 'board_ids must be an array'; end if;
    select coalesce(array_agg(x::bigint),'{}') into v_board_ids
      from jsonb_array_elements_text(payload->'board_ids') x;
    if exists (select 1 from unnest(v_board_ids) b
               where not exists (select 1 from public.boards where id = b)) then
      raise exception 'invalid board_id in %', v_board_ids; end if;
  else
    v_board_ids := '{}';
  end if;
  if v_goal_slug = 'school' and coalesce(array_length(v_board_ids,1),0) = 0 then
    raise exception 'school-board content requires at least one board_id'; end if;
  if v_goal_slug <> 'school' and coalesce(array_length(v_board_ids,1),0) > 0 then
    raise exception 'board_ids apply only to the School Boards learning goal'; end if;

  -- ---- class levels ----
  select coalesce(array_agg(x),'{}') into v_labels from jsonb_array_elements_text(payload->'class_labels') x;
  if array_length(v_labels,1) is null then raise exception 'at least one class label is required'; end if;
  if exists (select 1 from unnest(v_labels) l where public.class_label_to_slug(l) is null) then
    raise exception 'unknown class label in %', v_labels; end if;
  select coalesce(array_agg(cl.id),'{}') into v_class_ids
    from unnest(v_labels) label
    join public.class_levels cl on cl.slug = public.class_label_to_slug(label);
  if exists (
      select 1 from unnest(v_class_ids) cid
      where not exists (select 1 from public.learning_goal_class_levels m
                        where m.learning_goal_id = v_goal_id and m.class_level_id = cid)) then
    raise exception 'class % not valid for this learning goal', v_labels; end if;

  if v_focus is not null and not (v_focus = any(v_labels)) then
    raise exception 'audience_focus % is not among applicable classes %', v_focus, v_labels; end if;

  -- ---- metadata enums ----
  if nullif(payload->>'content_type','') is not null
     and payload->>'content_type' not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', payload->>'content_type'; end if;
  if nullif(payload->>'language','') is not null
     and payload->>'language' not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', payload->>'language'; end if;
  if nullif(payload->>'difficulty','') is not null
     and payload->>'difficulty' not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', payload->>'difficulty'; end if;

  -- ---- manual course: video_ids (review item 2) ----
  if not require_videos then
    if v_vid_ids is null or jsonb_typeof(v_vid_ids) <> 'array' or jsonb_array_length(v_vid_ids) = 0 then
      raise exception 'video_ids must be a non-empty array'; end if;
    v_vid_count := jsonb_array_length(v_vid_ids);
    if v_vid_count > MAX_VIDEOS then
      raise exception 'too many videos (%, max %)', v_vid_count, MAX_VIDEOS; end if;
    if exists (select 1 from jsonb_array_elements(v_vid_ids) e
               where jsonb_typeof(e) <> 'number' or (e->>0) !~ '^[0-9]+$') then
      raise exception 'video_ids must all be positive numeric ids'; end if;
    if (select count(distinct x) from jsonb_array_elements_text(v_vid_ids) x) <> v_vid_count then
      raise exception 'duplicate video_id in payload'; end if;
    if exists (select 1 from jsonb_array_elements_text(v_vid_ids) x
               where not exists (select 1 from public.videos v where v.id = x::bigint)) then
      raise exception 'video_ids contains an id that does not exist'; end if;

    return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                              'board_ids', to_jsonb(v_board_ids), 'video_count', v_vid_count);
  end if;

  -- ---- imported course: videos[] ----
  if v_vids is null or jsonb_typeof(v_vids) <> 'array' or jsonb_array_length(v_vids) = 0 then
    raise exception 'videos must be a non-empty array'; end if;
  v_count := jsonb_array_length(v_vids);
  if v_count > MAX_VIDEOS then raise exception 'playlist too large (% videos, max %)', v_count, MAX_VIDEOS; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e
             where (e->>'youtube_video_id') is null or (e->>'youtube_video_id') !~ '^[A-Za-z0-9_-]{11}$') then
    raise exception 'a video has a missing/invalid youtube_video_id'; end if;
  if (select count(distinct e->>'youtube_video_id') from jsonb_array_elements(v_vids) e) <> v_count then
    raise exception 'duplicate youtube_video_id in payload'; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e where nullif(trim(e->>'title'),'') is null) then
    raise exception 'a video has a blank title'; end if;
  if exists (select 1 from jsonb_array_elements(v_vids) e
             where (e->>'duration_seconds') is not null
               and ((e->>'duration_seconds')::int <= 0 or (e->>'duration_seconds')::int > MAX_SECS)) then
    raise exception 'a video has an out-of-range duration (1..% seconds)', MAX_SECS; end if;

  return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                            'board_ids', to_jsonb(v_board_ids), 'video_count', v_count);
end; $$;

-- ------------------------------------------------------------
-- 5. THE IMPORT
-- ------------------------------------------------------------
create or replace function public.import_playlist(payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[]; v_board_ids bigint[];
  v_channel_id bigint; v_playlist_id bigint;
  v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id bigint := nullif(payload->>'chapter_id','')::bigint;
  v_chapter_name text := nullif(payload->>'chapter_name','');
  v_video jsonb; v_video_id bigint; v_cid bigint; v_pos int := 0;
  v_added int := 0; v_reused int := 0; v_reused_pl boolean := false;
  v_inserted boolean := false; v_keep bigint[] := '{}';
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  v_valid := public.validate_import_payload(payload, mode, true);
  v_goal_id := (v_valid->>'goal_id')::bigint;
  select array_agg(x::bigint) into v_class_ids from jsonb_array_elements_text(v_valid->'class_ids') x;
  select coalesce(array_agg(x::bigint),'{}') into v_board_ids from jsonb_array_elements_text(v_valid->'board_ids') x;

  -- Serialise imports of the SAME playlist so concurrency is deterministic.
  perform pg_advisory_xact_lock(hashtext(payload->>'youtube_playlist_id'));

  -- channel: race-safe upsert
  v_channel_id := nullif(payload->>'channel_id','')::bigint;
  if v_channel_id is not null then
    if not exists (select 1 from public.institutes_channels where id = v_channel_id) then
      raise exception 'invalid channel_id %', v_channel_id; end if;
  else
    if nullif(payload#>>'{channel,youtube_channel_id}','') is null then
      raise exception 'channel_id or channel.youtube_channel_id required'; end if;
    insert into public.institutes_channels (name, youtube_channel_id)
    values (payload#>>'{channel,name}', payload#>>'{channel,youtube_channel_id}')
    on conflict (youtube_channel_id) do update set name = public.institutes_channels.name
    returning id into v_channel_id;
  end if;

  -- chapter: resolve-or-create, race-safe, inside this transaction
  if v_chapter_id is null and v_chapter_name is not null then
    insert into public.chapters (name, slug, subject_id)
    values (v_chapter_name,
            regexp_replace(regexp_replace(lower(v_chapter_name),'[^a-z0-9]+','-','g'),'(^-+|-+$)','','g'),
            v_subject_id)
    on conflict (subject_id, name) do update set name = public.chapters.name
    returning id into v_chapter_id;
  end if;

  -- playlist: race-safe upsert on the partial unique index
  select id into v_playlist_id from public.playlists where youtube_playlist_id = payload->>'youtube_playlist_id';
  if v_playlist_id is null then
    insert into public.playlists (
        title, teacher, channel_id, category_id, subject_id,
        content_type, language, difficulty, audience_focus, youtube_playlist_id, last_verified_at)
    values (trim(payload->>'title'), nullif(payload->>'teacher',''), v_channel_id, v_category_id, v_subject_id,
        nullif(payload->>'content_type',''), nullif(payload->>'language',''),
        nullif(payload->>'difficulty',''), nullif(payload->>'audience_focus',''),
        payload->>'youtube_playlist_id', now())
    on conflict (youtube_playlist_id) where youtube_playlist_id is not null
      do update set last_verified_at = now()
    -- xmax = 0 means we truly INSERTed; non-zero means a concurrent transaction
    -- won the race and we took the DO UPDATE branch instead.
    returning id, (xmax = 0) into v_playlist_id, v_inserted;
    v_reused_pl := not v_inserted;
  else
    v_reused_pl := true;
  end if;

  if v_reused_pl then
    if mode = 'replace' then
      -- replace DOES re-home the playlist's channel (see docs §4).
      update public.playlists set
          title = trim(payload->>'title'), teacher = nullif(payload->>'teacher',''),
          channel_id = v_channel_id, category_id = v_category_id, subject_id = v_subject_id,
          content_type = nullif(payload->>'content_type',''),
          language = nullif(payload->>'language',''),
          difficulty = nullif(payload->>'difficulty',''),
          audience_focus = nullif(payload->>'audience_focus',''), last_verified_at = now()
       where id = v_playlist_id;
      delete from public.playlist_learning_goals where playlist_id = v_playlist_id;
      delete from public.playlist_class_levels   where playlist_id = v_playlist_id;
      delete from public.playlist_boards         where playlist_id = v_playlist_id;
    else
      update public.playlists set
          content_type   = coalesce(content_type,  nullif(payload->>'content_type','')),
          language       = coalesce(language,       nullif(payload->>'language','')),
          difficulty     = coalesce(difficulty,     nullif(payload->>'difficulty','')),
          audience_focus = coalesce(audience_focus, nullif(payload->>'audience_focus','')),
          last_verified_at = now()
       where id = v_playlist_id;
    end if;
  end if;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_playlist_id, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;
  foreach v_cid in array v_board_ids loop
    insert into public.playlist_boards (playlist_id, board_id)
      values (v_playlist_id, v_cid) on conflict do nothing;
  end loop;

  for v_video in select * from jsonb_array_elements(payload->'videos') loop
    v_pos := v_pos + 1;
    select id into v_video_id from public.videos where youtube_video_id = v_video->>'youtube_video_id';
    if v_video_id is null then
      insert into public.videos (
          youtube_video_id, title, channel_id, category_id, subject_id, chapter_id,
          duration_seconds, caption_status, embedding_status, last_verified_at)
      values (v_video->>'youtube_video_id', trim(v_video->>'title'), v_channel_id,
          v_category_id, v_subject_id, v_chapter_id,
          nullif(v_video->>'duration_seconds','')::int,
          nullif(v_video->>'caption_status',''), nullif(v_video->>'embedding_status',''), now())
      on conflict (youtube_video_id) do update set last_verified_at = now()
      returning id, (xmax = 0) into v_video_id, v_inserted;
      -- review item 5: a concurrent transaction may have created this video
      -- between our SELECT and our INSERT. xmax tells us which branch ran, so
      -- the counters describe what actually happened rather than what we hoped.
      if v_inserted then v_added := v_added + 1; else v_reused := v_reused + 1; end if;
    else
      v_reused := v_reused + 1;
      update public.videos set
          duration_seconds = coalesce(nullif(v_video->>'duration_seconds','')::int, duration_seconds),
          caption_status   = coalesce(nullif(v_video->>'caption_status',''), caption_status),
          embedding_status = coalesce(nullif(v_video->>'embedding_status',''), embedding_status),
          last_verified_at = now()
       where id = v_video_id;
    end if;

    -- Video taxonomy stays ADDITIVE (never strips other playlists' meaning).
    -- Corrections go through set_video_taxonomy() / clear_video_taxonomy().
    insert into public.video_learning_goals (video_id, learning_goal_id)
      values (v_video_id, v_goal_id) on conflict do nothing;
    foreach v_cid in array v_class_ids loop
      insert into public.video_class_levels (video_id, class_level_id)
        values (v_video_id, v_cid) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_playlist_id, v_video_id, v_pos)
      on conflict (playlist_id, video_id) do update set position = excluded.position;
    v_keep := v_keep || v_video_id;
  end loop;

  if mode = 'replace' then
    delete from public.playlist_videos where playlist_id = v_playlist_id and video_id <> all(v_keep);
  end if;

  return jsonb_build_object('playlist_id', v_playlist_id, 'mode', mode,
    'reused_playlist', v_reused_pl, 'videos_added', v_added,
    'videos_reused', v_reused, 'lessons', v_pos);
end; $$;

-- ------------------------------------------------------------
-- 6. EXPLICIT correction of video taxonomy (review item 3)
--    Setting taxonomy requires a MEANINGFUL taxonomy. Removing all of it is a
--    different intent and needs a differently named call, so nobody empties a
--    video's classification by passing '{}' without meaning to.
-- ------------------------------------------------------------
create or replace function public.set_video_taxonomy(
  p_video_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_gid bigint; v_cid bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;

  if coalesce(array_length(p_learning_goal_ids,1),0) = 0
     or coalesce(array_length(p_class_level_ids,1),0) = 0 then
    raise exception 'at least one learning goal and one class level are required; use clear_video_taxonomy() to remove all taxonomy';
  end if;

  if exists (select 1 from unnest(p_learning_goal_ids) g
             where not exists (select 1 from public.learning_goals where id = g)) then
    raise exception 'invalid learning_goal_id in %', p_learning_goal_ids; end if;
  if exists (select 1 from unnest(p_class_level_ids) c
             where not exists (select 1 from public.class_levels where id = c)) then
    raise exception 'invalid class_level_id in %', p_class_level_ids; end if;

  -- every goal must accept every class (review item 3)
  foreach v_gid in array p_learning_goal_ids loop
    foreach v_cid in array p_class_level_ids loop
      if not exists (select 1 from public.learning_goal_class_levels m
                     where m.learning_goal_id = v_gid and m.class_level_id = v_cid) then
        raise exception 'class_level % is not valid for learning_goal %', v_cid, v_gid; end if;
    end loop;
  end loop;

  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels   where video_id = p_video_id;
  foreach v_gid in array p_learning_goal_ids loop
    insert into public.video_learning_goals (video_id, learning_goal_id) values (p_video_id, v_gid); end loop;
  foreach v_cid in array p_class_level_ids loop
    insert into public.video_class_levels (video_id, class_level_id) values (p_video_id, v_cid); end loop;

  return jsonb_build_object('video_id', p_video_id,
    'goals', array_length(p_learning_goal_ids,1), 'classes', array_length(p_class_level_ids,1));
end; $$;

create or replace function public.clear_video_taxonomy(p_video_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_g int; v_c int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;
  delete from public.video_learning_goals where video_id = p_video_id;
  get diagnostics v_g = row_count;
  delete from public.video_class_levels where video_id = p_video_id;
  get diagnostics v_c = row_count;
  return jsonb_build_object('video_id', p_video_id, 'goals_removed', v_g, 'classes_removed', v_c);
end; $$;

-- ------------------------------------------------------------
-- 7. Manual course creation, transactional
-- ------------------------------------------------------------
create or replace function public.create_course(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[]; v_board_ids bigint[];
  v_pid bigint; v_cid bigint; v_vid bigint; v_pos int := 0;
  v_expected int; v_actual int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;

  -- Same validator, same rules; only the "carries a video array" part differs.
  v_valid := public.validate_import_payload(payload, 'merge', false);
  v_goal_id := (v_valid->>'goal_id')::bigint;
  v_expected := (v_valid->>'video_count')::int;
  select array_agg(x::bigint) into v_class_ids from jsonb_array_elements_text(v_valid->'class_ids') x;
  select coalesce(array_agg(x::bigint),'{}') into v_board_ids from jsonb_array_elements_text(v_valid->'board_ids') x;

  if not exists (select 1 from public.institutes_channels
                 where id = nullif(payload->>'channel_id','')::bigint) then
    raise exception 'invalid channel_id %', payload->>'channel_id'; end if;

  insert into public.playlists (title, teacher, channel_id, category_id, subject_id,
      content_type, language, difficulty, audience_focus, last_verified_at)
  values (trim(payload->>'title'), nullif(payload->>'teacher',''),
      (payload->>'channel_id')::bigint, (payload->>'category_id')::bigint,
      (payload->>'subject_id')::bigint, nullif(payload->>'content_type',''),
      nullif(payload->>'language',''), nullif(payload->>'difficulty',''),
      nullif(payload->>'audience_focus',''), now())
  returning id into v_pid;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_pid, v_goal_id) on conflict do nothing;
  foreach v_cid in array v_class_ids loop
    insert into public.playlist_class_levels (playlist_id, class_level_id)
      values (v_pid, v_cid) on conflict do nothing; end loop;
  foreach v_cid in array v_board_ids loop
    insert into public.playlist_boards (playlist_id, board_id)
      values (v_pid, v_cid) on conflict do nothing; end loop;

  for v_vid in select x::bigint from jsonb_array_elements_text(payload->'video_ids') x loop
    v_pos := v_pos + 1;
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_pid, v_vid, v_pos) on conflict (playlist_id, video_id) do update set position = excluded.position;
  end loop;

  -- review item 2: the reported lesson count must equal the links that exist.
  select count(*) into v_actual from public.playlist_videos where playlist_id = v_pid;
  if v_actual <> v_expected then
    raise exception 'lesson count mismatch: expected %, linked %', v_expected, v_actual; end if;

  return jsonb_build_object('playlist_id', v_pid, 'lessons', v_actual);
end; $$;

-- ------------------------------------------------------------
-- 8. GRANTS
-- ------------------------------------------------------------
revoke all on function public.import_playlist(jsonb, text)  from public, anon;
revoke all on function public.set_video_taxonomy(bigint, bigint[], bigint[]) from public, anon;
revoke all on function public.clear_video_taxonomy(bigint) from public, anon;
revoke all on function public.create_course(jsonb) from public, anon;
revoke all on function public.validate_import_payload(jsonb, text, boolean) from public, anon;
grant execute on function public.import_playlist(jsonb, text) to authenticated, service_role;
grant execute on function public.set_video_taxonomy(bigint, bigint[], bigint[]) to authenticated, service_role;
grant execute on function public.clear_video_taxonomy(bigint) to authenticated, service_role;
grant execute on function public.create_course(jsonb) to authenticated, service_role;
