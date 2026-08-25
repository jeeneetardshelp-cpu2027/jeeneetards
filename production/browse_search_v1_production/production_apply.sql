-- ============================================================
-- BROWSE SEARCH v1 - PRODUCTION APPLY
-- PRODUCTION PROJECT kezelafqhgqrprpadmlf ONLY.
-- Hardened package for the reviewed docs/sql/browse_search_2026-08-25.sql
-- and docs/sql/browse_facet_search_2026-08-25.sql, combined into ONE
-- transaction whose self-tests run BEFORE commit -- so a parity, dependency,
-- or drift failure rolls the whole thing back instead of leaving a broken
-- anon-facing function live to students.
--
-- Adds:  search_query_tokens(text), search_playlist_ids(text),
--        search_video_ids(text)        (new)
-- Replaces: browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)
--        (its ONLY change vs the live v13 body is the ok_search predicate,
--         which now matches via search_playlist_ids instead of a title ILIKE)
--
-- Non-destructive: create-or-replace only; no DROP, no ALTER TABLE, no index
-- build. It cannot lock reads. Idempotent / safe to re-run.
--
-- RUN THE WHOLE FILE. Confirm you see 'BROWSE SEARCH v1 APPLY VERIFIED'.
-- Take a fresh PITR restore point first; rollback.sql restores the prior state.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Target guard: production is the row-less app_environment marker.
-- ------------------------------------------------------------
do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing (not the production project)';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
end
$target_guard$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- ------------------------------------------------------------
-- 1. Dependency + drift preflight (inside the txn, so a failure aborts).
--    The reviewed bodies reuse universal_search's helpers and pg_trgm's `%>`;
--    all must already be live. And browse_facet_counts must be the exact v13
--    version this delta was diffed against -- if production carries a different
--    body, REFUSE rather than silently reverting it.
-- ------------------------------------------------------------
do $preflight$
declare
  v_bfc_def text;
begin
  -- pg_trgm (provides the `%>` word-similarity operator).
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'REFUSING: pg_trgm extension is not installed';
  end if;

  -- Shared tokenisation / ranking helpers from universal_search.
  if to_regprocedure('public.normalize_search_text(text)') is null
     or to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_filler_tokens()') is null
     or to_regprocedure('public.search_singular(text)') is null
     or to_regprocedure('public.search_rank_tokens(text,text[],text)') is null
     or to_regprocedure('public.universal_search(text,text[],integer,integer)') is null then
    raise exception 'REFUSING: universal_search helper functions are missing; deploy universal_search first';
  end if;

  -- Catalogue tables the id/facet functions read.
  if to_regclass('public.playlists') is null
     or to_regclass('public.videos') is null
     or to_regclass('public.playlist_videos') is null then
    raise exception 'REFUSING: catalogue tables are missing';
  end if;

  -- browse_facet_counts and its v13 chapter-scope helper must exist.
  if to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is null then
    raise exception 'REFUSING: browse_facet_counts is missing (deploy chapter_class_scopes v13 first)';
  end if;
  if to_regprocedure('public.chapter_matches_class_scope(bigint,bigint,text)') is null then
    raise exception 'REFUSING: chapter_matches_class_scope (v13) is missing';
  end if;

  -- DRIFT GUARD: we only know it is safe to replace the v13 body, whose sole
  -- search predicate is the single-column title ILIKE. If the live definition
  -- is not that (already upgraded, or a different revision), stop and re-review.
  v_bfc_def := pg_get_functiondef(
    to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')::oid);
  if v_bfc_def not like '%pl.title ilike ''%'' || btrim(p_search) || ''%''%' then
    if v_bfc_def like '%search_playlist_ids%' then
      raise exception 'ALREADY APPLIED: browse_facet_counts already routes search through search_playlist_ids';
    end if;
    raise exception 'REFUSING: live browse_facet_counts is not the reviewed v13 body (drift) -- re-review before replacing';
  end if;
end
$preflight$;

-- ------------------------------------------------------------
-- 2. Tokenisation helper, reproduced VERBATIM from universal_search's prelude.
-- ------------------------------------------------------------
create or replace function public.search_query_tokens(p_query text)
returns table (qlen int, q text, q_tokens text[], q_long text)
language plpgsql immutable parallel safe
set search_path = public, pg_temp
as $$
declare
  q_raw     text := public.normalize_search_text(p_query);
  v_q       text := public.search_latin_key(p_query);
  v_tokens  text[];
  v_content text[];
  v_long    text;
begin
  qlen := least(coalesce(length(q_raw), 0), coalesce(length(v_q), 0));
  q := v_q;

  v_tokens := array_remove(string_to_array(coalesce(v_q, ''), ' '), '');

  v_content := array(
    select tok
      from unnest(v_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(v_content) > 0 then
    v_tokens := v_content;
  end if;
  q_tokens := v_tokens;

  select tok into v_long
    from unnest(v_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(v_long, v_q);

  return next;
end; $$;

comment on function public.search_query_tokens(text) is
  'universal_search tokenisation as a reusable helper (latin key, filler-filtered tokens, longest token, length floor). Lets browse search tokenise identically to the homepage.';

revoke all on function public.search_query_tokens(text) from public, anon, authenticated, service_role;
grant execute on function public.search_query_tokens(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Playlist (course) ids whose title matches, universal_search's predicate.
-- ------------------------------------------------------------
create or replace function public.search_playlist_ids(p_query text)
returns table (id bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || t.q_long || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(pl.title), t.q_tokens, t.q) is not null;
end; $$;

comment on function public.search_playlist_ids(text) is
  'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish). For the /browse course list to search as well as the homepage.';

revoke all on function public.search_playlist_ids(text) from public, anon, authenticated, service_role;
grant execute on function public.search_playlist_ids(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Lecture (video) ids whose title matches, capped and relevance-ordered.
-- ------------------------------------------------------------
create or replace function public.search_video_ids(p_query text)
returns table (id bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || t.q_long || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q) is not null
     order by public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q),
              length(v.title), v.id
     limit 500;
end; $$;

comment on function public.search_video_ids(text) is
  'Lecture ids whose title matches p_query with universal_search''s lecture logic. Relevance-ordered, capped at 500 so a broad query cannot overflow a URL id-filter.';

revoke all on function public.search_video_ids(text) from public, anon, authenticated, service_role;
grant execute on function public.search_video_ids(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 5. Pin pg_trgm's real schema onto the two `%>`-using functions, INSIDE the
--    transaction (create-or-replace reset their SET to the create-time value),
--    so the self-tests below can resolve `%>` before we commit. Looked up from
--    pg_extension, not guessed (extensions schema on Supabase, public elsewhere).
-- ------------------------------------------------------------
do $pin_search_path$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if v_schema is null then
    raise exception 'REFUSING: could not resolve pg_trgm schema';
  end if;
  execute format(
    'alter function public.search_playlist_ids(text) set search_path = public, %I, pg_temp', v_schema);
  execute format(
    'alter function public.search_video_ids(text) set search_path = public, %I, pg_temp', v_schema);
end
$pin_search_path$;

-- ------------------------------------------------------------
-- 6. Replace browse_facet_counts. Body is byte-identical to the live v13
--    definition EXCEPT the ok_search predicate (verified by diff against
--    production/chapter_class_scopes_v13_production/production_apply.sql).
-- ------------------------------------------------------------
create or replace function public.browse_facet_counts(
    p_goal text default null,
    p_class text default null,
    p_subject text default null,
    p_chapter text default null,
    p_channel bigint default null,
    p_language text[] default null,
    p_type text[] default null,
    p_difficulty text[] default null,
    p_search text default null)
returns table (facet text, value text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with class_options(value, slugs) as (
    values
      ('class-10'::text, array['class-10']::text[]),
      ('class-11'::text, array['class-11']::text[]),
      ('class-12'::text, array['class-12']::text[]),
      ('dropper'::text, array['dropper','class-11','class-12']::text[])
  ), base as (
    select
      pl.id,
      pl.language,
      pl.content_type,
      pl.difficulty,
      pl.channel_id,
      (p_goal is null or exists (
        select 1
        from public.playlist_learning_goals g
        join public.learning_goals lg on lg.id = g.learning_goal_id
        where g.playlist_id = pl.id and lg.slug = p_goal
      )) as ok_goal,
      case
        when p_class is null then true
        when p_chapter is not null then exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = pl.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, pl.id, p_class)
        )
        else exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      end as ok_class,
      (p_subject is null or exists (
        select 1 from public.subjects s
        where s.id = pl.subject_id and s.slug = p_subject
      )) as ok_subject,
      (p_chapter is null or exists (
        select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.chapters c on c.id = v.chapter_id
        where pv.playlist_id = pl.id and c.slug = p_chapter
      )) as ok_chapter,
      (p_channel is null or pl.channel_id = p_channel) as ok_channel,
      (p_language is null or pl.language = any(p_language)) as ok_language,
      (p_type is null or pl.content_type = any(p_type)) as ok_type,
      (p_difficulty is null or pl.difficulty = any(p_difficulty)) as ok_difficulty,
      -- CHANGED: match with the homepage engine, not a single-column ILIKE, so
      -- these counts agree with the /browse result list (search_playlist_ids,
      -- browse_search_2026-08-25.sql). Uncorrelated subquery -> evaluated once.
      (p_search is null or btrim(p_search) = ''
         or pl.id in (select sid.id from public.search_playlist_ids(btrim(p_search)) sid)) as ok_search
    from public.playlists pl
  ), facets as (
    select 'goal'::text as facet, lg.slug as value, count(distinct b.id)::bigint as n
    from base b
    join public.playlist_learning_goals g on g.playlist_id = b.id
    join public.learning_goals lg on lg.id = g.learning_goal_id
    where b.ok_class and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by lg.slug

    union all

    select 'class', co.value, count(distinct b.id)::bigint
    from base b
    cross join class_options co
    where b.ok_goal and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and (
        (p_chapter is null and exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = b.id and cl.slug = any(co.slugs)
        ))
        or
        (p_chapter is not null and exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = b.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, b.id, co.value)
        ))
      )
    group by co.value

    union all

    select 'subject', s.slug, count(distinct b.id)::bigint
    from base b
    join public.playlists pl on pl.id = b.id
    join public.subjects s on s.id = pl.subject_id
    where b.ok_goal and b.ok_class and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by s.slug

    union all

    select 'chapter', c.slug, count(distinct b.id)::bigint
    from base b
    join public.playlist_videos pv on pv.playlist_id = b.id
    join public.videos v on v.id = pv.video_id
    join public.chapters c on c.id = v.chapter_id
    where b.ok_goal and b.ok_subject and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and public.chapter_matches_class_scope(c.id, b.id, p_class)
    group by c.slug

    union all

    select 'language', b.language, count(distinct b.id)::bigint
    from base b
    where b.language is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.language

    union all

    select 'type', b.content_type, count(distinct b.id)::bigint
    from base b
    where b.content_type is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_difficulty and b.ok_search
    group by b.content_type

    union all

    select 'difficulty', b.difficulty, count(distinct b.id)::bigint
    from base b
    where b.difficulty is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_type and b.ok_search
    group by b.difficulty

    union all

    select 'channel', b.channel_id::text, count(distinct b.id)::bigint
    from base b
    where b.channel_id is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.channel_id
  )
  select f.facet, f.value, f.n
  from facets f
  where f.n > 0
  order by f.facet, f.value;
$$;

comment on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text) is
  'Contextual counts using reviewed canonical chapter classes and unchanged course-level Dropper semantics. Search matches via search_playlist_ids (the homepage engine), so counts agree with the /browse result list.';

revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. SELF-TEST, INSIDE the transaction: any failure rolls the whole apply back.
--    Proves the new id functions match universal_search, the browse leak is
--    closed, the facet counts route through the new engine, and the floor holds.
-- ------------------------------------------------------------
do $verify$
declare
  v_row       record;
  v_mine      bigint[];
  v_universal bigint[];
  v_total     bigint;
  v_search_hits int;
  v_facet_hits  int;
  v_fail      text[] := '{}';
begin
  -- Playlist equivalence: universal's ids are a subset of ours; exact set when
  -- universal's result is not truncated.
  for v_row in
    select unnest(array[
      'friction problems', 'projectile motion', 'thermodynamics',
      'rotatinal motion', 'mole concept'
    ]) as q
  loop
    select array(select id from public.search_playlist_ids(v_row.q) order by id) into v_mine;
    select array(select entity_id from public.universal_search(v_row.q, array['playlist'], 50, 0) order by entity_id)
      into v_universal;
    select coalesce(max(group_total), 0) into v_total
      from public.universal_search(v_row.q, array['playlist'], 50, 0);
    if exists (select 1 from unnest(v_universal) u where u <> all (coalesce(v_mine, array[]::bigint[]))) then
      v_fail := v_fail || (v_row.q || ' [playlist: universal id missing from browse]');
    end if;
    if v_total <= 50 and v_mine is distinct from v_universal then
      v_fail := v_fail || (v_row.q || ' [playlist: set differs from universal, total=' || v_total || ']');
    end if;
  end loop;

  -- Lecture equivalence (subset), guarded on the total so a truncated universal
  -- result is not compared against a capped browse one.
  for v_row in select unnest(array['projectile motion', 'friction problems']) as q loop
    select coalesce(max(group_total), 0) into v_total
      from public.universal_search(v_row.q, array['lecture'], 50, 0);
    if v_total <= 500 then
      if exists (
        select entity_id from public.universal_search(v_row.q, array['lecture'], 50, 0)
        except
        select id from public.search_video_ids(v_row.q)
      ) then
        v_fail := v_fail || (v_row.q || ' [lecture: universal id missing from browse]');
      end if;
    end if;
  end loop;

  -- The leak is closed: the headline query returns something now.
  if (select count(*) from public.search_playlist_ids('friction problems'))
   + (select count(*) from public.search_video_ids('friction problems')) = 0 then
    v_fail := v_fail || 'friction problems [still zero on browse]';
  end if;

  -- Two-character floor holds.
  if (select count(*) from public.search_playlist_ids('a')) <> 0
   or (select count(*) from public.search_video_ids('a')) <> 0 then
    v_fail := v_fail || 'single-char floor regressed';
  end if;

  -- Facet counts now route through search_playlist_ids: a matching search
  -- yields counts; a no-match yields none; no-search still returns the catalogue.
  select count(*) into v_search_hits from public.search_playlist_ids('friction problems');
  select count(*) into v_facet_hits
    from public.browse_facet_counts(null,null,null,null,null,null,null,null,'friction problems') where n > 0;
  if v_search_hits > 0 and v_facet_hits = 0 then
    v_fail := v_fail || 'facet counts empty for a matching search [ok_search not using search_playlist_ids]';
  end if;
  select count(*) into v_facet_hits
    from public.browse_facet_counts(null,null,null,null,null,null,null,null,'zzzznotathingxyz');
  if v_facet_hits <> 0 then
    v_fail := v_fail || 'no-match search returned facet rows [ok_search not filtering]';
  end if;
  select count(*) into v_facet_hits
    from public.browse_facet_counts(null,null,null,null,null,null,null,null,null);
  if v_facet_hits = 0 then
    v_fail := v_fail || 'no-search facet counts empty [unchanged path regressed]';
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'BROWSE SEARCH v1 SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'BROWSE SEARCH v1 SELF-TEST PASSED: browse id functions match universal_search; leak closed; facet counts routed; floor intact.';
end
$verify$;

commit;

select 'BROWSE SEARCH v1 APPLY VERIFIED' as result;
