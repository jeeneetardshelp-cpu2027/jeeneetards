-- ============================================================
-- CATALOG NAVIGATION v9 — ISOLATED PRODUCTION DELTA
--
-- AUTO-GENERATED. Do not edit by hand.
-- Core source SHA-256: 1609de029bc1d94e07ec021fff6499f3203e669bbca0887d1013453ff7425140
-- Verified staging run: 50bee2 (10 passed, 0 failed, cleanup clean)
--
-- DDL only: two additive indexes and two public read functions.
-- No inserts, updates, deletes, table changes, fixtures or credentials.
-- The preflight refuses staging/test targets and incompatible schemas.
-- The postflight runs in the same transaction and aborts on any mismatch.
-- ============================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- SOURCE: src/migrations/catalog_navigation_v9_production_preflight.sql
-- Production-only compatibility checks for catalogue navigation v9.
-- This block changes nothing. Any failed condition aborts the transaction
-- before an index or function is created.

do $preflight$
declare
  v_table text;
  v_missing text;
  v_bad_environment boolean := false;
begin
  if to_regclass('public.app_environment') is not null then
    execute $query$
      select exists (
        select 1
        from public.app_environment
        where lower(coalesce(name, '')) in ('staging', 'test', 'development', 'dev')
      )
    $query$ into v_bad_environment;
  end if;

  if v_bad_environment then
    raise exception 'REFUSING: catalog navigation production delta was pointed at a non-production environment';
  end if;

  foreach v_table in array array[
    'public.playlists',
    'public.videos',
    'public.playlist_videos',
    'public.learning_goals',
    'public.playlist_learning_goals',
    'public.class_levels',
    'public.playlist_class_levels',
    'public.subjects',
    'public.chapters'
  ] loop
    if to_regclass(v_table) is null then
      raise exception 'REFUSING: required table % does not exist', v_table;
    end if;
    if not has_table_privilege('anon', v_table, 'SELECT') then
      raise exception 'REFUSING: anon lacks SELECT on required table %', v_table;
    end if;
  end loop;

  select string_agg(format('%I.%I', wanted.table_name, wanted.column_name), ', ')
    into v_missing
    from (values
      ('playlists', 'id'), ('playlists', 'title'),
      ('playlists', 'subject_id'), ('playlists', 'channel_id'),
      ('playlists', 'language'), ('playlists', 'content_type'),
      ('playlists', 'difficulty'),
      ('videos', 'id'), ('videos', 'chapter_id'),
      ('chapters', 'id'), ('chapters', 'subject_id'),
      ('chapters', 'slug'), ('chapters', 'name'),
      ('chapters', 'display_order'),
      ('subjects', 'id'), ('subjects', 'slug'),
      ('subjects', 'name'), ('subjects', 'display_order'),
      ('learning_goals', 'id'), ('learning_goals', 'slug'),
      ('learning_goals', 'name'), ('learning_goals', 'display_order'),
      ('class_levels', 'id'), ('class_levels', 'slug')
    ) as wanted(table_name, column_name)
   where not exists (
     select 1
       from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = wanted.table_name
        and c.column_name = wanted.column_name
   );

  if v_missing is not null then
    raise exception 'REFUSING: required columns are missing: %', v_missing;
  end if;

  if to_regprocedure('public.get_browse_curriculum(text,text,text)') is not null then
    raise exception 'REFUSING: get_browse_curriculum(text,text,text) already exists; review before replacing it';
  end if;

  if to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null then
    raise exception 'REFUSING: browse_facet_counts(...) already exists; review before replacing it';
  end if;
end
$preflight$;



-- SOURCE: src/migrations/catalog_navigation_v9.sql
-- =====================================================================
-- catalog_navigation_v9.sql
-- Bounded curriculum navigation + contextual catalogue facet counts.
--
-- The browser must never download every playlist/video merely to build a
-- menu or count filter options. Both functions below aggregate in Postgres
-- and return only the small result needed to draw the current navigation.
-- =====================================================================

create index if not exists idx_plg_goal_playlist
  on public.playlist_learning_goals (learning_goal_id, playlist_id);
create index if not exists idx_pcl_class_playlist
  on public.playlist_class_levels (class_level_id, playlist_id);

-- ---------------------------------------------------------------------
-- One current curriculum level per call:
--   null goal                         -> learning goals
--   goal, null subject                -> subjects with matching courses
--   goal + subject                    -> chapters with matching courses
-- Class is applied to subjects/chapters so a selected stage cannot lead to
-- a branch that is populated only for another stage.
-- ---------------------------------------------------------------------
drop function if exists public.get_browse_curriculum(text, text, text);
create function public.get_browse_curriculum(
    p_goal text default null,
    p_class text default null,
    p_subject text default null)
returns table (
    level text,
    entity_id bigint,
    slug text,
    name text,
    display_order integer,
    course_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with rows as (
    -- Landing level. Keep zero-count reference rows so a deliberately
    -- unavailable goal can be labelled "Coming soon" rather than vanishing.
    select
      'goal'::text as level,
      lg.id as entity_id,
      lg.slug,
      lg.name,
      lg.display_order,
      count(distinct plg.playlist_id)::bigint as course_count
    from public.learning_goals lg
    left join public.playlist_learning_goals plg
      on plg.learning_goal_id = lg.id
    where p_goal is null and p_subject is null
    group by lg.id, lg.slug, lg.name, lg.display_order

    union all

    select
      'subject'::text,
      s.id,
      s.slug,
      s.name,
      s.display_order,
      count(distinct pl.id)::bigint
    from public.subjects s
    join public.playlists pl on pl.subject_id = s.id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is null
      and lg.slug = p_goal
      and (
        p_class is null or exists (
          select 1
          from public.playlist_class_levels pcl
          join public.class_levels cl on cl.id = pcl.class_level_id
          where pcl.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      )
    group by s.id, s.slug, s.name, s.display_order

    union all

    select
      'chapter'::text,
      ch.id,
      ch.slug,
      ch.name,
      ch.display_order,
      count(distinct pl.id)::bigint
    from public.chapters ch
    join public.subjects s on s.id = ch.subject_id
    join public.videos v on v.chapter_id = ch.id
    join public.playlist_videos pv on pv.video_id = v.id
    join public.playlists pl on pl.id = pv.playlist_id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is not null
      and lg.slug = p_goal
      and s.slug = p_subject
      and (
        p_class is null or exists (
          select 1
          from public.playlist_class_levels pcl
          join public.class_levels cl on cl.id = pcl.class_level_id
          where pcl.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      )
    group by ch.id, ch.slug, ch.name, ch.display_order
  )
  select r.level, r.entity_id, r.slug, r.name, r.display_order, r.course_count
  from rows r
  order by r.display_order, r.name, r.entity_id;
$$;

comment on function public.get_browse_curriculum(text, text, text) is
  'Bounded goal/subject/chapter navigation with distinct course counts and strict class semantics.';

revoke all on function public.get_browse_curriculum(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_browse_curriculum(text, text, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Contextual facet counts in one round trip.
--
-- Each facet applies every OTHER active filter and excludes its own. A
-- playlist is always counted DISTINCTLY. The synthetic Dropper option uses
-- the same superset semantics as the result query: explicit Dropper + 11 + 12.
-- ---------------------------------------------------------------------
drop function if exists public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text);
create function public.browse_facet_counts(
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
      (p_class is null or exists (
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
      )) as ok_class,
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
      (p_search is null or btrim(p_search) = '' or pl.title ilike '%' || btrim(p_search) || '%') as ok_search
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
      and exists (
        select 1
        from public.playlist_class_levels j
        join public.class_levels cl on cl.id = j.class_level_id
        where j.playlist_id = b.id and cl.slug = any(co.slugs)
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
    where b.ok_goal and b.ok_class and b.ok_subject and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
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
  'Contextual distinct course counts. Each facet excludes itself; Dropper includes class 11 and 12.';

revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;


-- SOURCE: src/migrations/catalog_navigation_v9_production_postflight.sql
-- Assertions executed in the same transaction as the production delta.
-- A failure here rolls back the functions and indexes together.

do $postflight$
declare
  v_signature text;
  v_security_definer boolean;
  v_volatility "char";
begin
  foreach v_signature in array array[
    'public.get_browse_curriculum(text,text,text)',
    'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'POSTFLIGHT: function % was not created', v_signature;
    end if;

    select p.prosecdef, p.provolatile
      into v_security_definer, v_volatility
      from pg_proc p
     where p.oid = to_regprocedure(v_signature);

    if v_security_definer then
      raise exception 'POSTFLIGHT: % must remain SECURITY INVOKER', v_signature;
    end if;
    if v_volatility <> 's' then
      raise exception 'POSTFLIGHT: % must remain STABLE', v_signature;
    end if;

    if not has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'POSTFLIGHT: expected role grants are missing for %', v_signature;
    end if;
  end loop;

  if exists (
    select 1
      from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('get_browse_curriculum', 'browse_facet_counts')
       and grantee = 'PUBLIC'
       and privilege_type = 'EXECUTE'
  ) then
    raise exception 'POSTFLIGHT: PUBLIC still has EXECUTE on a v9 function';
  end if;

  if to_regclass('public.idx_plg_goal_playlist') is null
     or to_regclass('public.idx_pcl_class_playlist') is null then
    raise exception 'POSTFLIGHT: one or more v9 indexes are missing';
  end if;

  perform count(*)
    from public.get_browse_curriculum(null, null, null);
  perform count(*)
    from public.browse_facet_counts(null, null, null, null, null, null, null, null, null);
end
$postflight$;



commit;
