-- ============================================================
--  v6 — DELTA on top of import_playlist_v4.sql. DO NOT apply to production.
--
--  v6 = v5 with every test-only helper removed (they now live in
--  staging_test_helpers.sql, which the production path never applies).
--
--  Apply order: ... -> import_playlist_v4.sql -> THIS FILE -> fixtures ->
--               v5_class_levels_migration.sql
--
--  1. category ↔ learning-goal compatibility, enforced (Browse and Explore can
--     no longer disagree about which goal a course belongs to)
--  4. the class_levels migration becomes a callable, testable function so its
--     abort paths can be automated
--  5. video_ids validation hardened (the v4 check silently passed 0, negative,
--     decimal and overflow values — see note below)
--  6. duplicate goal/class ids rejected BEFORE anything is deleted
--  7. audit table lifecycle: per-run evidence preserved, permissions locked
-- ============================================================

-- ------------------------------------------------------------
-- 1. CATEGORY ↔ LEARNING GOAL (review item 1)
--
--    Browse reads videos.category_id. Explore reads video_learning_goals.
--    Nothing tied those two axes together, so a course could legitimately be
--    filed under category JEE while its goal junction said NEET, and it would
--    appear under JEE in Browse and NEET in Explore. Same course, two answers.
--
--    This mapping makes the pair explicit and validated. It is intentionally
--    many-to-many: a category may legitimately serve several goals later.
-- ------------------------------------------------------------
create table if not exists public.category_learning_goals (
    category_id      bigint not null references public.categories(id)     on delete cascade,
    learning_goal_id bigint not null references public.learning_goals(id) on delete cascade,
    primary key (category_id, learning_goal_id)
);
alter table public.category_learning_goals enable row level security;
drop policy if exists "public read" on public.category_learning_goals;
create policy "public read" on public.category_learning_goals for select using (true);

insert into public.category_learning_goals (category_id, learning_goal_id)
select c.id, lg.id
  from public.categories c
  join public.learning_goals lg
    on (c.slug = 'jee'           and lg.slug = 'jee')
    or (c.slug = 'neet'          and lg.slug = 'neet')
    or (c.slug = 'olympiad'      and lg.slug = 'olympiad')
    or (c.slug = 'school-boards' and lg.slug = 'school')
on conflict do nothing;

-- ------------------------------------------------------------
-- 7. AUDIT TABLE LIFECYCLE (review item 7)
--
--    Evidence is kept PER RUN and never silently overwritten: every execution
--    stamps its own run_id, and nothing deletes prior rows. Removal is an
--    explicit, admin-only operation (purge_migration_audit) that reports what
--    it removed.
--
--    Permissions: RLS on, no anon policy at all (so anon reads nothing), admin
--    read via is_admin(). service_role bypasses RLS for test/export use.
-- ------------------------------------------------------------
create table if not exists public.class_levels_migration_audit (
    id              bigint generated always as identity primary key,
    playlist_id     bigint not null,
    verdict         text   not null,   -- agree | array-only | junction-only | both-empty
    array_labels    text[],
    junction_labels text[],
    migrated_at     timestamptz not null default now()
);
alter table public.class_levels_migration_audit
    add column if not exists run_id uuid;

alter table public.class_levels_migration_audit enable row level security;
drop policy if exists "admin read audit" on public.class_levels_migration_audit;
create policy "admin read audit" on public.class_levels_migration_audit
    for select using (public.is_admin());
revoke all on table public.class_levels_migration_audit from anon;

create or replace function public.purge_migration_audit(p_keep_runs int default 3)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_removed int;
begin
  -- Same reasoning as migrate_class_levels(): retention is an operator action,
  -- normally run from the SQL Editor. See the comment there on session_user.
  if not (public.is_admin()
          or auth.role() = 'service_role'
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.class_levels_migration_audit
   where run_id is not null
     and run_id not in (
       select run_id from (
         select run_id, max(migrated_at) as t
           from public.class_levels_migration_audit
          where run_id is not null
          group by run_id order by t desc limit p_keep_runs) keep);
  get diagnostics v_removed = row_count;
  return jsonb_build_object('removed', v_removed, 'kept_runs', p_keep_runs);
end; $$;

-- NOTE: has_trigger() and the blocking-drift fixture helpers used to live in
-- this file. They exist only to let the test suite inspect and manufacture
-- states, and have no business in a production migration — they are now in
-- src/migrations/staging_test_helpers.sql, which the production path never
-- applies. See docs/import_hardening.md.

-- ------------------------------------------------------------
-- 5 + 1. VALIDATION (replaces the v4 function)
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

  if require_videos and v_ypid is null then raise exception 'youtube_playlist_id is required'; end if;
  if v_ypid is not null and v_ypid !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_playlist_id format'; end if;
  if payload ? 'channel' and nullif(payload#>>'{channel,youtube_channel_id}','') is not null
     and (payload#>>'{channel,youtube_channel_id}') !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'invalid youtube_channel_id format'; end if;

  if v_goal_id is null then
    raise exception 'learning_goal_id is required (it is no longer derived from the category)'; end if;
  select slug into v_goal_slug from public.learning_goals where id = v_goal_id;
  if v_goal_slug is null then raise exception 'invalid learning_goal_id %', v_goal_id; end if;

  if v_category_id is null or not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'invalid category_id %', v_category_id; end if;

  -- review item 1: the pair must be a declared, legal combination.
  if not exists (select 1 from public.category_learning_goals m
                 where m.category_id = v_category_id and m.learning_goal_id = v_goal_id) then
    raise exception 'category % is not valid for learning goal % (Browse and Explore would disagree)',
      v_category_id, v_goal_id;
  end if;

  if v_subject_id is null or not exists (select 1 from public.subjects where id = v_subject_id) then
    raise exception 'invalid subject_id %', v_subject_id; end if;
  if v_chapter_id is not null and not exists (
      select 1 from public.chapters where id = v_chapter_id and subject_id = v_subject_id) then
    raise exception 'chapter % does not belong to subject %', v_chapter_id, v_subject_id; end if;

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

  if nullif(payload->>'content_type','') is not null
     and payload->>'content_type' not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', payload->>'content_type'; end if;
  if nullif(payload->>'language','') is not null
     and payload->>'language' not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', payload->>'language'; end if;
  if nullif(payload->>'difficulty','') is not null
     and payload->>'difficulty' not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', payload->>'difficulty'; end if;

  -- ---- manual course: video_ids (review item 5) ----
  --
  -- The v4 check was `jsonb_typeof(e) <> 'number' or (e->>0) !~ '^[0-9]+$'`.
  -- `->>0` addresses an ARRAY ELEMENT; applied to a JSON scalar it returns
  -- NULL, so the regex arm was always NULL and never rejected anything. Only
  -- the type arm did any work — 0, -1, 1.5 and 10^30 all sailed through.
  -- `#>>'{}'` extracts the scalar itself, which is what was meant.
  if not require_videos then
    if v_vid_ids is null or jsonb_typeof(v_vid_ids) <> 'array' or jsonb_array_length(v_vid_ids) = 0 then
      raise exception 'video_ids must be a non-empty array'; end if;
    v_vid_count := jsonb_array_length(v_vid_ids);
    if v_vid_count > MAX_VIDEOS then
      raise exception 'too many videos (%, max %)', v_vid_count, MAX_VIDEOS; end if;
    -- number type rejects string/null/object/array/boolean;
    -- the pattern rejects 0, negatives, decimals and >18-digit overflow.
    if exists (select 1 from jsonb_array_elements(v_vid_ids) e
               where jsonb_typeof(e) <> 'number'
                  or (e#>>'{}') !~ '^[1-9][0-9]{0,17}$') then
      raise exception 'video_ids must all be positive whole numbers within range'; end if;
    if (select count(distinct x) from jsonb_array_elements_text(v_vid_ids) x) <> v_vid_count then
      raise exception 'duplicate video_id in payload'; end if;
    if exists (select 1 from jsonb_array_elements_text(v_vid_ids) x
               where not exists (select 1 from public.videos v where v.id = x::bigint)) then
      raise exception 'video_ids contains an id that does not exist'; end if;

    return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                              'board_ids', to_jsonb(v_board_ids), 'video_count', v_vid_count);
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

  return jsonb_build_object('goal_id', v_goal_id, 'class_ids', to_jsonb(v_class_ids),
                            'board_ids', to_jsonb(v_board_ids), 'video_count', v_count);
end; $$;

-- ------------------------------------------------------------
-- 6 + 1. set_video_taxonomy (replaces the v4 function)
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

  -- review item 6: duplicates are rejected BEFORE any delete happens.
  if (select count(distinct x) from unnest(p_learning_goal_ids) x) <> array_length(p_learning_goal_ids,1) then
    raise exception 'duplicate learning_goal_id in %', p_learning_goal_ids; end if;
  if (select count(distinct x) from unnest(p_class_level_ids) x) <> array_length(p_class_level_ids,1) then
    raise exception 'duplicate class_level_id in %', p_class_level_ids; end if;

  if exists (select 1 from unnest(p_learning_goal_ids) g
             where not exists (select 1 from public.learning_goals where id = g)) then
    raise exception 'invalid learning_goal_id in %', p_learning_goal_ids; end if;
  if exists (select 1 from unnest(p_class_level_ids) c
             where not exists (select 1 from public.class_levels where id = c)) then
    raise exception 'invalid class_level_id in %', p_class_level_ids; end if;

  -- NOTE: deliberately NO category check here. A single Physics lecture
  -- genuinely serves both JEE and NEET, and videos.category_id is
  -- single-valued, so constraining goals to the video's category would make
  -- that legitimate case unrepresentable. The category↔goal mapping is
  -- enforced where filing intent is declared (import / create_course); the
  -- guarantee that Browse and Explore agree comes from both of them reading
  -- the goal junction, not from narrowing a video to one goal.

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

-- ------------------------------------------------------------
-- 4. THE MIGRATION, AS A CALLABLE FUNCTION (review item 4)
--
--    Same audit-first logic as v4, but callable — so the abort paths can be
--    tested automatically instead of by hand. One function call is one
--    transaction, so an abort rolls back the audit rows, the backfill AND the
--    trigger creation together.
-- ------------------------------------------------------------
create or replace function public.migrate_class_levels(p_enable_triggers boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bad_labels text; v_conflicts text; v_n_conflict int;
  v_backfilled int := 0; v_drift int; r record; v_cid bigint;
  v_run uuid := gen_random_uuid();
  v_counts jsonb;
begin
  -- This function is invoked two ways: from the SQL Editor as part of the
  -- migration, and over PostgREST by the test suite. In the SQL Editor there
  -- is no JWT, so auth.uid()/auth.role() are both NULL and the service_role
  -- check alone would reject the migration outright.
  --
  -- session_user, NOT current_user: inside a SECURITY DEFINER function
  -- current_user is always the function owner (postgres), which would make the
  -- check vacuously true for every caller. session_user stays the role that
  -- actually connected — 'postgres' in the SQL Editor, 'authenticator' for
  -- PostgREST — so this cannot be reached through the API.
  if not (public.is_admin()
          or auth.role() = 'service_role'
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;

  -- 1. unknown labels abort
  select string_agg(format('playlist %s: %s', p.id, p.class_levels), '; ')
    into v_bad_labels
    from public.playlists p
   where exists (select 1 from unnest(coalesce(p.class_levels,'{}')) l
                 where public.class_label_to_slug(l) is null);
  if v_bad_labels is not null then
    raise exception 'ABORT: unknown class label(s): %', v_bad_labels; end if;

  -- 2. ambiguous conflicts abort
  select count(*), string_agg(format('playlist %s: array=%s junction=%s', id, a, j), '; ')
    into v_n_conflict, v_conflicts
    from (
      select p.id,
             (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x) as a,
             (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x) as j
        from public.playlists p
    ) s
   where coalesce(array_length(a,1),0) > 0
     and coalesce(array_length(j,1),0) > 0
     and a is distinct from j;
  if coalesce(v_n_conflict,0) > 0 then
    raise exception 'ABORT: % playlist(s) disagree between array and junction: %', v_n_conflict, v_conflicts; end if;

  -- 3. audit + backfill. Prior runs are PRESERVED (review item 7).
  for r in
    select p.id,
           (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x) as a,
           (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x) as j
      from public.playlists p
  loop
    if coalesce(array_length(r.a,1),0) = 0 and coalesce(array_length(r.j,1),0) = 0 then
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'both-empty', r.a, r.j);
    elsif coalesce(array_length(r.j,1),0) = 0 then
      for v_cid in
        select cl.id from unnest(r.a) x
          join public.class_levels cl on cl.slug = public.class_label_to_slug(x)
      loop
        insert into public.playlist_class_levels (playlist_id, class_level_id)
          values (r.id, v_cid) on conflict do nothing;
      end loop;
      v_backfilled := v_backfilled + 1;
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'array-only', r.a, r.j);
    elsif coalesce(array_length(r.a,1),0) = 0 then
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'junction-only', r.a, r.j);
    else
      insert into public.class_levels_migration_audit (run_id, playlist_id, verdict, array_labels, junction_labels)
        values (v_run, r.id, 'agree', r.a, r.j);
    end if;
  end loop;

  update public.playlists p
     set class_levels = public.derived_class_levels(p.id)
   where coalesce(array_length(p.class_levels,1),0) = 0
     and coalesce(array_length(public.derived_class_levels(p.id),1),0) > 0;

  -- 4. verify zero drift before enabling anything
  select count(*) into v_drift
    from public.playlists p
   where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
         is distinct from
         (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x);
  if v_drift > 0 then
    raise exception 'ABORT: % playlist(s) still drift after backfill. No triggers were enabled.', v_drift; end if;

  -- 5. only now is it safe to make the array derived
  if p_enable_triggers then
    execute $ddl$
      create or replace function public.force_derived_class_levels()
      returns trigger language plpgsql security definer set search_path = '' as $fn$
      begin
        new.class_levels := public.derived_class_levels(new.id);
        return new;
      end; $fn$;
    $ddl$;
    execute $ddl$
      create or replace function public.sync_playlist_class_levels_array()
      returns trigger language plpgsql security definer set search_path = '' as $fn$
      declare v_pid bigint := coalesce(new.playlist_id, old.playlist_id);
      begin
        update public.playlists set class_levels = public.derived_class_levels(v_pid) where id = v_pid;
        return null;
      end; $fn$;
    $ddl$;
    execute 'drop trigger if exists trg_force_class_levels on public.playlists';
    execute 'create trigger trg_force_class_levels before insert or update on public.playlists
               for each row execute function public.force_derived_class_levels()';
    execute 'drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels';
    execute 'create trigger trg_sync_pl_class_array after insert or delete on public.playlist_class_levels
               for each row execute function public.sync_playlist_class_levels_array()';
  end if;

  select jsonb_object_agg(verdict, n) into v_counts
    from (select verdict, count(*) n from public.class_levels_migration_audit
           where run_id = v_run group by verdict) s;

  return jsonb_build_object('run_id', v_run, 'backfilled', v_backfilled,
    'drift_after', v_drift, 'triggers_enabled', p_enable_triggers, 'verdicts', v_counts);
end; $$;

-- ------------------------------------------------------------
-- GRANTS
-- ------------------------------------------------------------
-- NOTE ON `authenticated`:
-- Supabase projects ship with default privileges —
--   alter default privileges in schema public grant all on functions
--     to postgres, anon, authenticated, service_role;
-- — so EVERY function created here is granted EXECUTE to `authenticated`
-- automatically. Revoking from `public, anon` does NOT remove that. Anything
-- meant to be service_role-only must revoke from `authenticated` explicitly,
-- otherwise any logged-in student holds EXECUTE on it. (The function bodies
-- still re-check is_admin(), so this was defence in depth rather than an open
-- door — but the grant must match the intent.)
revoke all on function public.validate_import_payload(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.set_video_taxonomy(bigint, bigint[], bigint[]) from public, anon;
revoke all on function public.migrate_class_levels(boolean) from public, anon, authenticated;
revoke all on function public.purge_migration_audit(int) from public, anon, authenticated;
grant execute on function public.set_video_taxonomy(bigint, bigint[], bigint[]) to authenticated, service_role;
grant execute on function public.migrate_class_levels(boolean) to service_role;
grant execute on function public.purge_migration_audit(int) to service_role;
