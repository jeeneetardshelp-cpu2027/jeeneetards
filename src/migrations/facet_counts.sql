-- =====================================================================
--  facet_counts.sql — contextual option counts for the browse filter panel.
--
--  SUPERSEDED. DO NOT APPLY.
--  The verified implementation is catalog_navigation_v9.sql. This file is
--  retained only as review history because it used the obsolete
--  p_institute vocabulary and did not implement the verified v9 contract.
--
--  PREPARED, NOT APPLIED. This has been run nowhere: not production, not
--  staging (there is no staging project). It exists so the count semantics in
--  docs/facet_counts.md are expressed as code and can be reviewed before any
--  DDL is executed.
--
--  THE THREE RULES (see docs/facet_counts.md for why each matters):
--
--    1. every OTHER active filter applies to each option's count
--    2. the facet being counted is EXCLUDED from its own computation, so a
--       student can always see and switch to the alternatives
--    3. count(DISTINCT playlists.id) — a playlist tagged for two classes
--       matches a Dropper query through two junction rows and must still
--       count once
--
--  One round trip returns every facet. The N+1 alternative — one count query
--  per option — is what this replaces.
-- =====================================================================

create or replace function public.browse_facet_counts(
    p_goal        text    default null,   -- learning_goals.slug
    p_class       text    default null,   -- 'class-11' | 'class-12' | 'dropper' | 'class-10'
    p_subject     text    default null,   -- subjects.slug
    p_chapter     text    default null,   -- chapters.slug
    p_institute   bigint  default null,   -- institutes_channels.id
    p_language    text[]  default null,
    p_type        text[]  default null,
    p_difficulty  text[]  default null,
    p_search      text    default null)
returns table (facet text, value text, n bigint)
language sql stable security invoker set search_path = public, pg_temp as $$
  with
  -- Dropper is a SUPERSET of Class 11 and 12; the other classes are exact.
  -- This mirrors classSlugsForStage() in usePlaylistBrowse.js exactly, and
  -- classFilter.test.js asserts the two agree.
  wanted_class as (
    select case
      when p_class is null      then null
      when p_class = 'dropper'  then array['dropper','class-11','class-12']
      else array[p_class]
    end as slugs
  ),
  -- Every playlist that satisfies the filters, with each filter's
  -- contribution kept as a separate boolean so a facet can drop its own.
  base as (
    select pl.id,
           pl.language, pl.content_type, pl.difficulty, pl.channel_id,
           (p_goal is null or exists (
              select 1 from public.playlist_learning_goals g
                join public.learning_goals lg on lg.id = g.learning_goal_id
               where g.playlist_id = pl.id and lg.slug = p_goal))          as ok_goal,
           (p_class is null or exists (
              select 1 from public.playlist_class_levels j
                join public.class_levels cl on cl.id = j.class_level_id
               where j.playlist_id = pl.id
                 and cl.slug = any((select slugs from wanted_class))))     as ok_class,
           (p_subject is null or exists (
              select 1 from public.subjects s
               where s.id = pl.subject_id and s.slug = p_subject))         as ok_subject,
           (p_chapter is null or exists (
              select 1 from public.playlist_videos pv
                join public.videos v  on v.id = pv.video_id
                join public.chapters c on c.id = v.chapter_id
               where pv.playlist_id = pl.id and c.slug = p_chapter))       as ok_chapter,
           (p_institute is null or pl.channel_id = p_institute)            as ok_institute,
           (p_language   is null or pl.language     = any(p_language))     as ok_language,
           (p_type       is null or pl.content_type = any(p_type))         as ok_type,
           (p_difficulty is null or pl.difficulty   = any(p_difficulty))   as ok_difficulty,
           (p_search is null or p_search = ''
              or pl.title ilike '%' || p_search || '%')                    as ok_search
      from public.playlists pl
  ),
  -- RULE 2 in one place: `others` is every predicate EXCEPT the named one.
  -- Writing it as a lateral flag per facet keeps the exclusion honest — there
  -- is no way to forget to drop the facet's own predicate.
  ok as (
    select b.*,
           (ok_goal and ok_class and ok_subject and ok_chapter and ok_institute
            and ok_language and ok_type and ok_difficulty and ok_search) as ok_all
      from base b
  )
  -- goal ------------------------------------------------------------------
  select 'goal'::text, lg.slug, count(distinct o.id)
    from ok o
    join public.playlist_learning_goals g on g.playlist_id = o.id
    join public.learning_goals lg on lg.id = g.learning_goal_id
   where o.ok_class and o.ok_subject and o.ok_chapter and o.ok_institute
     and o.ok_language and o.ok_type and o.ok_difficulty and o.ok_search
   group by lg.slug
  union all
  -- class -----------------------------------------------------------------
  select 'class', cl.slug, count(distinct o.id)
    from ok o
    join public.playlist_class_levels j on j.playlist_id = o.id
    join public.class_levels cl on cl.id = j.class_level_id
   where o.ok_goal and o.ok_subject and o.ok_chapter and o.ok_institute
     and o.ok_language and o.ok_type and o.ok_difficulty and o.ok_search
   group by cl.slug
  union all
  -- subject ---------------------------------------------------------------
  select 'subject', s.slug, count(distinct o.id)
    from ok o
    join public.playlists pl2 on pl2.id = o.id
    join public.subjects s on s.id = pl2.subject_id
   where o.ok_goal and o.ok_class and o.ok_chapter and o.ok_institute
     and o.ok_language and o.ok_type and o.ok_difficulty and o.ok_search
   group by s.slug
  union all
  -- chapter (scoped to the chosen subject by the caller) -------------------
  select 'chapter', c.slug, count(distinct o.id)
    from ok o
    join public.playlist_videos pv on pv.playlist_id = o.id
    join public.videos v  on v.id = pv.video_id
    join public.chapters c on c.id = v.chapter_id
   where o.ok_goal and o.ok_class and o.ok_subject and o.ok_institute
     and o.ok_language and o.ok_type and o.ok_difficulty and o.ok_search
   group by c.slug
  union all
  -- scalar facets ---------------------------------------------------------
  select 'language', o.language, count(distinct o.id)
    from ok o
   where o.language is not null
     and o.ok_goal and o.ok_class and o.ok_subject and o.ok_chapter
     and o.ok_institute and o.ok_type and o.ok_difficulty and o.ok_search
   group by o.language
  union all
  select 'type', o.content_type, count(distinct o.id)
    from ok o
   where o.content_type is not null
     and o.ok_goal and o.ok_class and o.ok_subject and o.ok_chapter
     and o.ok_institute and o.ok_language and o.ok_difficulty and o.ok_search
   group by o.content_type
  union all
  select 'difficulty', o.difficulty, count(distinct o.id)
    from ok o
   where o.difficulty is not null
     and o.ok_goal and o.ok_class and o.ok_subject and o.ok_chapter
     and o.ok_institute and o.ok_language and o.ok_type and o.ok_search
   group by o.difficulty
  union all
  select 'institute', o.channel_id::text, count(distinct o.id)
    from ok o
   where o.channel_id is not null
     and o.ok_goal and o.ok_class and o.ok_subject and o.ok_chapter
     and o.ok_language and o.ok_type and o.ok_difficulty and o.ok_search
   group by o.channel_id;
$$;

comment on function public.browse_facet_counts is
  'Contextual facet counts. Each facet excludes its own predicate; counts are DISTINCT on playlist id. NOT YET APPLIED — see docs/facet_counts.md.';

-- Supabase grants EXECUTE on every new public function to anon, authenticated
-- and service_role by default, so revoke first and then grant deliberately.
revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;
