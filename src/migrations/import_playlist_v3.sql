-- ============================================================
--  v3 — addresses the independent review. DO NOT apply to production.
--
--  1. Deterministic same-playlist concurrency (advisory lock + ON CONFLICT)
--  2. Junction is the REAL source of truth (array writes are neutralised)
--  3. DB-side validation: goal↔class compatibility, id formats, titles,
--     duration range, metadata enums
--  4. Explicit correction path for wrong video taxonomy (set_video_taxonomy)
--  5. replace mode updates channel_id (decision: replace means replace)
--  6. environment marker so tests can refuse production DB-side
--  + create_course() so manual admin creation is transactional too
-- ============================================================

-- ------------------------------------------------------------
-- 0. ENVIRONMENT MARKER (blocker 6)
--    A staging/test DB self-identifies. Production simply never gets this
--    row, so a test harness can refuse even with no .env present.
-- ------------------------------------------------------------
create table if not exists public.app_environment (
    id      boolean primary key default true check (id),   -- single row
    name    text not null check (name in ('production','staging','test'))
);
alter table public.app_environment enable row level security;
drop policy if exists "env readable" on public.app_environment;
create policy "env readable" on public.app_environment for select using (true);

-- ------------------------------------------------------------
-- 1. GOAL ↔ CLASS COMPATIBILITY (blocker 3)
--    Entrance exams never accept Class 10; school boards do. Enforced in
--    the DB, not in application constants.
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
-- 2. class_levels[] IS DERIVED (blocker 2 & 8)
--    Junction is authoritative. The array is recomputed from it, and a
--    BEFORE trigger overwrites whatever any writer supplies — so a direct
--    legacy write to playlists.class_levels CANNOT create drift.
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

create or replace function public.force_derived_class_levels()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.class_levels := public.derived_class_levels(new.id);
  return new;
end; $$;

-- INSERT is covered too: otherwise a direct legacy INSERT carrying a bogus
-- array would still create drift. On a brand-new row the junction is empty, so
-- the array starts '{}' and is filled by trg_sync_pl_class_array below.
drop trigger if exists trg_force_class_levels on public.playlists;
create trigger trg_force_class_levels
  before insert or update on public.playlists
  for each row execute function public.force_derived_class_levels();

create or replace function public.sync_playlist_class_levels_array()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pid bigint := coalesce(new.playlist_id, old.playlist_id);
begin
  update public.playlists set class_levels = public.derived_class_levels(v_pid) where id = v_pid;
  return null;
end; $$;

drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels;
create trigger trg_sync_pl_class_array
  after insert or delete on public.playlist_class_levels
  for each row execute function public.sync_playlist_class_levels_array();

-- ONE-TIME REPAIR (blocker 8): any drift inherited from the v1/v2 era, where
-- the array was maintained by application code, is corrected here. Idempotent.
update public.playlists set class_levels = public.derived_class_levels(id)
 where class_levels is distinct from public.derived_class_levels(id);

-- ------------------------------------------------------------
-- 3. Shared validation helper — raises on the first problem.
-- ------------------------------------------------------------
-- require_videos: import_playlist supplies a `videos` array; create_course
-- links EXISTING videos by id, so it validates everything else and passes false.
create or replace function public.validate_import_payload(payload jsonb, mode text, require_videos boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  MAX_VIDEOS constant int := 500;
  MAX_SECS   constant int := 86400;          -- 24h per lecture
  v_goal_id bigint; v_category_id bigint := nullif(payload->>'category_id','')::bigint;
  v_subject_id bigint := nullif(payload->>'subject_id','')::bigint;
  v_chapter_id bigint := nullif(payload->>'chapter_id','')::bigint;
  v_labels text[]; v_class_ids bigint[]; v_focus text := nullif(payload->>'audience_focus','');
  v_vids jsonb := payload->'videos'; v_count int; v_ypid text := nullif(payload->>'youtube_playlist_id','');
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

  if v_category_id is null or not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'invalid category_id %', v_category_id; end if;
  select lg.id into v_goal_id from public.learning_goals lg
    join public.categories c on c.name = lg.name where c.id = v_category_id;
  if v_goal_id is null then raise exception 'no learning-goal mapping for category %', v_category_id; end if;

  if v_subject_id is null or not exists (select 1 from public.subjects where id = v_subject_id) then
    raise exception 'invalid subject_id %', v_subject_id; end if;
  if v_chapter_id is not null and not exists (
      select 1 from public.chapters where id = v_chapter_id and subject_id = v_subject_id) then
    raise exception 'chapter % does not belong to subject %', v_chapter_id, v_subject_id; end if;

  select coalesce(array_agg(x),'{}') into v_labels from jsonb_array_elements_text(payload->'class_labels') x;
  if array_length(v_labels,1) is null then raise exception 'at least one class label is required'; end if;
  if exists (select 1 from unnest(v_labels) l where lower(l) not in ('10th','11th','12th','dropper')) then
    raise exception 'unknown class label in %', v_labels; end if;
  select coalesce(array_agg(cl.id),'{}') into v_class_ids
    from unnest(v_labels) label join public.class_levels cl on cl.slug = case lower(label)
      when '10th' then 'class-10' when '11th' then 'class-11'
      when '12th' then 'class-12' when 'dropper' then 'dropper' end;
  -- goal ↔ class compatibility, from the DB
  if exists (
      select 1 from unnest(v_class_ids) cid
      where not exists (select 1 from public.learning_goal_class_levels m
                        where m.learning_goal_id = v_goal_id and m.class_level_id = cid)) then
    raise exception 'class % not valid for this learning goal', v_labels; end if;

  if v_focus is not null and not (v_focus = any(v_labels)) then
    raise exception 'audience_focus % is not among applicable classes %', v_focus, v_labels; end if;

  -- metadata enums
  if nullif(payload->>'content_type','') is not null
     and payload->>'content_type' not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', payload->>'content_type'; end if;
  if nullif(payload->>'language','') is not null
     and payload->>'language' not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', payload->>'language'; end if;
  if nullif(payload->>'difficulty','') is not null
     and payload->>'difficulty' not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', payload->>'difficulty'; end if;

  if not require_videos then
    return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids));
  end if;

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

  return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids));
end; $$;

-- ------------------------------------------------------------
-- 4. THE IMPORT
-- ------------------------------------------------------------
create or replace function public.import_playlist(payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[];
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

  -- DETERMINISM (blocker 1): serialise imports of the SAME playlist.
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
    -- xmax = 0 means this row was truly INSERTed; non-zero means a concurrent
    -- transaction won the race and we took the DO UPDATE branch instead.
    returning id, (xmax = 0) into v_playlist_id, v_inserted;
    v_reused_pl := not v_inserted;
  else
    v_reused_pl := true;
  end if;

  if v_reused_pl then
    if mode = 'replace' then
      -- blocker 5: replace DOES re-home the playlist's channel.
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
      returning id into v_video_id;
      v_added := v_added + 1;
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
    -- Corrections go through set_video_taxonomy() — see blocker 4.
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
-- 5. EXPLICIT correction of video taxonomy (blocker 4)
--    Import never removes video taxonomy. This does — deliberately, for one
--    video, admin-only, transactional.
-- ------------------------------------------------------------
create or replace function public.set_video_taxonomy(
  p_video_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;

  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels   where video_id = p_video_id;
  foreach v_id in array coalesce(p_learning_goal_ids,'{}') loop
    insert into public.video_learning_goals (video_id, learning_goal_id) values (p_video_id, v_id); end loop;
  foreach v_id in array coalesce(p_class_level_ids,'{}') loop
    insert into public.video_class_levels (video_id, class_level_id) values (p_video_id, v_id); end loop;

  return jsonb_build_object('video_id', p_video_id,
    'goals', coalesce(array_length(p_learning_goal_ids,1),0),
    'classes', coalesce(array_length(p_class_level_ids,1),0));
end; $$;

-- ------------------------------------------------------------
-- 6. Manual course creation, transactional (blocker 2)
--    Replaces AdminPanel's direct array write + non-transactional sync.
-- ------------------------------------------------------------
create or replace function public.create_course(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_valid jsonb; v_goal_id bigint; v_class_ids bigint[]; v_pid bigint; v_cid bigint;
  v_vid bigint; v_pos int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501'; end if;

  -- Same validator, same rules (goal↔class compatibility, enums, FKs) —
  -- only the "must carry a video array" part is skipped.
  v_valid := public.validate_import_payload(payload, 'merge', false);
  v_goal_id := (v_valid->>'goal_id')::bigint;
  select array_agg(x::bigint) into v_class_ids from jsonb_array_elements_text(v_valid->'class_ids') x;

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

  -- existing video ids, in order
  for v_vid in select x::bigint from jsonb_array_elements_text(payload->'video_ids') x loop
    v_pos := v_pos + 1;
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (v_pid, v_vid, v_pos) on conflict (playlist_id, video_id) do update set position = excluded.position;
  end loop;

  return jsonb_build_object('playlist_id', v_pid, 'lessons', v_pos);
end; $$;

-- ------------------------------------------------------------
-- 7. GRANTS
-- ------------------------------------------------------------
revoke all on function public.import_playlist(jsonb, text)  from public, anon;
revoke all on function public.set_video_taxonomy(bigint, bigint[], bigint[]) from public, anon;
revoke all on function public.create_course(jsonb) from public, anon;
revoke all on function public.validate_import_payload(jsonb, text, boolean) from public, anon;
grant execute on function public.import_playlist(jsonb, text) to authenticated, service_role;
grant execute on function public.set_video_taxonomy(bigint, bigint[], bigint[]) to authenticated, service_role;
grant execute on function public.create_course(jsonb) to authenticated, service_role;
