-- ============================================================================
-- UNIVERSAL SEARCH -- add the study-material pillar ('material' and 'paper').
--
-- WHAT THIS DOES. universal_search() today returns five groups: faculty,
-- chapter, playlist, lecture, institute. All five are video-shaped, so a
-- student who types "kinematics notes" or "jee main 2024 paper" gets lectures
-- and nothing else, while the reviewed material library sits one click away on
-- /materials and is invisible to the one box every student actually uses.
-- This migration re-emits universal_search with two more group blocks:
--
--   'material'  short_notes | formula_sheet | full_notes  ("Notes & sheets")
--   'paper'     previous_year_paper                       ("Previous-year papers")
--
-- WHY TWO GROUPS AND NOT ONE. The data distinguishes them (material_type is a
-- CHECK-constrained column) and so does the site: previous-year papers have
-- their own landing page (/materials/jee-main/previous-year-papers), their own
-- hook (src/useJeeMainPapers.js), their own banner on /materials and their own
-- entry in ON_SITE_TEST_RESOURCES, while notes and sheets live in the
-- /materials directory. They also deserve DIFFERENT destinations, which one
-- merged group could not express. And the words that would tell the two apart
-- -- "notes", "paper", "pdf" -- are all filler tokens (search_filler_tokens),
-- stripped before matching, so the query itself can never disambiguate them.
-- The group heading is the only thing that can, which is the argument for
-- keeping them separate.
--
-- WHAT A STUDENT CAN SEE. study_materials is RLS-protected: the public policy
-- is `review_status = 'approved' AND published_at <= now()`. universal_search
-- is SECURITY INVOKER (it is NOT security definer -- checked against the
-- baseline), so that policy applies to these blocks automatically. The same
-- predicate is ALSO written out in the SQL below, belt and braces, so a future
-- change of the function's security context could not silently leak pending or
-- rejected material. Nothing here grants any new privilege.
--
-- CONTENT GUARD. Same discipline as the chapter block ("never suggest a
-- chapter with no lessons"): a material is only offered if a page that
-- actually lists it exists. get_study_materials() requires at least one
-- study_material_scopes row, so a scope-less material is invisible on
-- /materials and must not be suggested. The one exception is a JEE Main
-- previous-year paper, which the curated papers landing reads straight from
-- study_materials (src/useJeeMainPapers.js) with no scope requirement.
--
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it with `npx supabase db push`, never by pasting
-- into the SQL Editor. `db push` runs EVERY pending migration in timestamp
-- order, so check `npx supabase migration list` first. The frontend already
-- ships the client half and degrades to today's behaviour while this is
-- pending: a group the deployed RPC does not return simply has no rows, and a
-- group with no rows renders nothing at all -- no heading, no chip, no error.
--
-- ROLLBACK. Re-run the universal_search body from the baseline:
--   supabase/migrations/20260831140005_production_baseline.sql, the
--   `CREATE OR REPLACE FUNCTION "public"."universal_search"` block. It is a
--   CREATE OR REPLACE of the same signature, so replacing it restores the
--   five-group version with no drop and no dependency churn. The two indexes
--   are independently droppable and harmless to keep:
--     drop index if exists public.idx_study_materials_title_latin_trgm;
--     drop index if exists public.idx_study_materials_title_latin_pattern;
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '300s';

-- ---------------------------------------------------------------------
-- PREFLIGHT. Abort before touching anything if the world this migration
-- assumes is not there.
-- ---------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.study_materials') is null then
    raise exception 'study_materials is missing -- universal_search cannot search it';
  end if;
  if to_regclass('public.study_material_scopes') is null then
    raise exception 'study_material_scopes is missing -- the content guard cannot run';
  end if;
  if to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_rank_tokens(text, text[], text)') is null
     or to_regprocedure('public.search_filler_tokens()') is null then
    raise exception 'the search helper functions are missing -- apply the baseline first';
  end if;
  if to_regprocedure('public.universal_search(text, text[], integer, integer)') is null then
    raise exception 'universal_search is missing -- this migration replaces it, it does not create it';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------
-- INDEXES. Design note 6 (sargable predicates) only pays off if the
-- indexed expression exists. These mirror the pairs the baseline already
-- ships for chapters, playlists, videos and institutes_channels, verbatim
-- in shape and naming.
-- ---------------------------------------------------------------------
create index if not exists idx_study_materials_title_latin_pattern
  on public.study_materials using btree (public.search_latin_key(title) text_pattern_ops);

create index if not exists idx_study_materials_title_latin_trgm
  on public.study_materials using gin (public.search_latin_key(title) public.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- universal_search, re-emitted whole.
--
-- The faculty / chapter / playlist / lecture / institute blocks below are
-- COPIED VERBATIM from the baseline, comments included. Only two things
-- changed: the `want` default array gained 'material' and 'paper', and the
-- two new blocks were appended after institutes. Re-emitting the whole body
-- is how every previous search migration in this repo has worked -- plpgsql
-- has no way to patch one branch of a function.
-- ---------------------------------------------------------------------
create or replace function public.universal_search(
  p_query text,
  p_types text[] default null::text[],
  p_limit integer default 5,
  p_offset integer default 0
) returns table(
  group_key text, entity_id bigint, title text, subtitle text, aka text,
  slug text, match_type text, match_rank integer, matched_on text,
  is_ambiguous boolean, group_total bigint, extra jsonb
)
    language plpgsql stable
    -- SECURITY INVOKER (the default, and what production has). Do NOT make
    -- this SECURITY DEFINER: every group below relies on the caller's RLS,
    -- and the study-material blocks in particular would start returning
    -- unapproved rows the moment it ran as the owner.
    set search_path to 'public', 'public', 'pg_temp'
    as $_$
declare
  -- Two normalisations, on purpose. q is the Latin key and is what everything
  -- is matched on. q_raw exists only to measure the length of what the student
  -- actually typed, so transliteration cannot smuggle a 1-character query past
  -- the floor in design note 4.
  q_raw    text := public.normalize_search_text(p_query);
  q        text := public.search_latin_key(p_query);
  qlen     int  := least(coalesce(length(q_raw), 0), coalesce(length(q), 0));
  q_tokens text[];
  q_content text[];
  q_long   text;
  lim      int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off      int  := greatest(coalesce(p_offset, 0), 0);
  want     text[] := case when p_types is null or cardinality(p_types) = 0
                          then array['faculty','chapter','playlist','lecture','institute',
                                     'material','paper']
                          else p_types end;
begin
  -- Design note 4. One character is not a query; returning the top of the
  -- alphabet for "a" trains students to ignore the suggestions entirely.
  if qlen < 2 then
    return;
  end if;

  -- Design note 7: pin the %> threshold transaction-locally so behaviour does
  -- not depend on a per-database GUC. Must happen before the first %> below.
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  -- Tokens. q is already lower-cased, punctuation-stripped and single-spaced by
  -- search_latin_key, so splitting on a single space is exact; array_remove is
  -- belt and braces.
  q_tokens := array_remove(string_to_array(q, ' '), '');

  -- Filler removal. Tiers 4 and 5 in search_rank_tokens both require EVERY
  -- token to match, so one word that no title contains kills the whole query.
  -- Measured against production on 2026-08-10: 19 of 43 realistic student
  -- queries returned nothing, including "how to solve pulley problems" while
  -- "Pulley Problem - Newton's Laws of Motion" sat in the catalogue, and
  -- "friction problems" while 5 Friction lectures did.
  --
  -- Tokens are FILTERED, never rewritten. The first deploy also singularised
  -- the surviving tokens here ("problems" -> "problem"), and that broke the
  -- typo tier: "kinamatics" became "kinamatic", whose trigrams lost the shared
  -- 'ics' tail with "kinematics" and fell below the 0.5 fuzzy threshold --
  -- 14 rows -> 0, a measured regression. Plural-widening now lives inside
  -- search_rank_tokens, where each tier accepts a token's typed OR singular
  -- form; the tokens themselves stay exactly as the student typed them, so the
  -- fuzzy tier sees the same strings it always did.
  --
  -- A token is filler if EITHER its typed or its singular form is in the list;
  -- both directions are needed. Typed-only lets "problems" through (the list
  -- holds "problem"); singular-only lets "class" through, because "class"
  -- singularises to "clas", which no list holds.
  --
  -- If filtering would leave nothing, keep the original tokens. Without that
  -- guard a query of pure filler ("how to") empties q_tokens, and tier 5's
  -- "not exists (unnest(empty))" is vacuously true, which would match every
  -- row in the catalogue.
  q_content := array(
    select tok
      from unnest(q_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(q_content) > 0 then
    q_tokens := q_content;
  end if;

  -- The longest token drives the index prefilter (design note 6). Ties are
  -- broken alphabetically so the same query always produces the same plan.
  select tok into q_long
    from unnest(q_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(q_long, q);

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7. Verbatim from the shipped version — faculty ranking is
  -- search_teachers()' business and is deliberately untouched by v11, which is
  -- also why it is passed the RAW p_query and not the Latin key.
  if 'faculty' = any(want) and to_regclass('public.teachers') is not null then
    return query execute $dyn$
      with hits as (
        select s.teacher_id, s.display_name, s.slug, s.match_type, s.match_rank,
               s.matched_on, s.is_ambiguous, s.institutes, s.subjects, s.goals,
               s.verified
          from public.search_teachers($1, 50) s
      ), counted as (
        select h.*, count(*) over () as total from hits h
      )
      select 'faculty'::text,
             c.teacher_id,
             c.display_name,
             -- "Competishun · Physics · JEE" — the context that makes two
             -- people with the same name distinguishable.
             nullif(concat_ws(' · ', nullif(c.institutes,''), nullif(c.subjects,''),
                                     nullif(c.goals,'')), ''),
             -- VERIFIED aliases only. RLS on teacher_aliases enforces this
             -- independently; the predicate here is belt and braces.
             (select string_agg(a.alias, ', ' order by a.alias)
                from public.teacher_aliases a
               where a.teacher_id = c.teacher_id
                 and a.status = 'verified'
                 and public.normalize_person_name(a.alias)
                     is distinct from public.normalize_person_name(c.display_name)),
             c.slug, c.match_type, c.match_rank, c.matched_on, c.is_ambiguous,
             c.total,
             jsonb_build_object('verified', c.verified)
        from counted c
       order by c.match_rank, c.display_name
       limit $2 offset $3
    $dyn$ using p_query, lim, off;
  end if;

  ---------------------------------------------------------------- chapters
  if 'chapter' = any(want) then
    return query
    with m as (
      select ch.id, ch.name,
             public.search_rank_tokens(public.search_latin_key(ch.name), q_tokens, q) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
       -- CONTENT GUARD (from search_hide_empty_chapters.sql, preserved): never
       -- suggest a chapter with no lessons mapped to it, so parked/empty
       -- chapters cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
         -- SARGABLE (design note 6). Every disjunct is a gin_trgm_ops member
         -- applied to the indexed expression verbatim.
         and (   public.search_latin_key(ch.name) like '%' || q_long || '%'
              or public.search_latin_key(ch.name) like q || '%'
              or public.search_latin_key(ch.name) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'chapter'::text, c.id, c.name, c.subject, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('chapter_id', c.id)
      from counted c
     -- Within a tier, the shortest name is the closest match: for "motion",
     -- "Motion" should outrank "Motion in a Straight Line".
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- playlists
  if 'playlist' = any(want) then
    return query
    with m as (
      select pl.id, pl.title,
             public.search_rank_tokens(public.search_latin_key(pl.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', nullif(pl.teacher,''), ic.name, s.name), '') as ctx,
             -- first chapter this playlist teaches, so the result deep-links
             -- to a watchable page rather than a dead end. Now evaluated only
             -- for rows that survived the index prefilter, not for every
             -- playlist in the table.
             (select v.chapter_id
                from public.playlist_videos pv
                join public.videos v on v.id = pv.video_id
               where pv.playlist_id = pl.id and v.chapter_id is not null
               order by pv.position limit 1) as chapter_id
        from public.playlists pl
        left join public.institutes_channels ic on ic.id = pl.channel_id
        left join public.subjects s on s.id = pl.subject_id
       where (   public.search_latin_key(pl.title) like '%' || q_long || '%'
              or public.search_latin_key(pl.title) like q || '%'
              or public.search_latin_key(pl.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'playlist'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object('chapter_id', c.chapter_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- lectures
  if 'lecture' = any(want) then
    return query
    with m as (
      select v.id, v.title,
             public.search_rank_tokens(public.search_latin_key(v.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', ch.name, s.name), '') as ctx,
             v.chapter_id, v.subject_id,
             v.youtube_video_id,
             -- The course this lesson sits in, so a lecture result can open the
             -- LESSON rather than dumping the student on a filtered catalogue
             -- to hunt for what they just found. Lowest playlist_id keeps the
             -- choice deterministic for a lesson shared by several courses;
             -- the subquery runs only on rows the index prefilter returned.
             (select pv.playlist_id
                from public.playlist_videos pv
               where pv.video_id = v.id
               order by pv.playlist_id
               limit 1) as playlist_id
        from public.videos v
        left join public.chapters ch on ch.id = v.chapter_id
        left join public.subjects s  on s.id = v.subject_id
       where (   public.search_latin_key(v.title) like '%' || q_long || '%'
              or public.search_latin_key(v.title) like q || '%'
              or public.search_latin_key(v.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'lecture'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           -- extra is jsonb, so new keys are additive: the RETURNS TABLE
           -- signature is unchanged and older clients ignore what they do not
           -- read (see Home.jsx resultHref, which falls back when absent).
           jsonb_build_object('chapter_id', c.chapter_id, 'subject_id', c.subject_id,
                              'playlist_id', c.playlist_id,
                              'youtube_video_id', c.youtube_video_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- institutes
  if 'institute' = any(want) then
    return query
    with m as (
      select ic.id, ic.name,
             public.search_rank_tokens(public.search_latin_key(ic.name), q_tokens, q) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
       where (   public.search_latin_key(ic.name) like '%' || q_long || '%'
              or public.search_latin_key(ic.name) like q || '%'
              or public.search_latin_key(ic.name) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'institute'::text, c.id, c.name,
           case when c.n = 0 then null
                else c.n || ' course' || case when c.n = 1 then '' else 's' end end,
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('institute_id', c.id)
      from counted c
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;

  ---------------------------------------------------------- notes & sheets
  -- Short notes, formula sheets and full lecture notes. Previous-year papers
  -- are deliberately excluded here and answered by the 'paper' block below.
  if 'material' = any(want) then
    return query
    with m as (
      select sm.id, sm.title, sm.material_type,
             public.search_rank_tokens(public.search_latin_key(sm.title), q_tokens, q) as rk,
             -- ONE scope row, the most specific this material has. It has to be
             -- a single row rather than a mix of columns from several, because
             -- the client turns these slugs into a /materials filter set and
             -- get_study_materials() satisfies them from a SINGLE scope row:
             -- slugs taken from different rows could name a combination that
             -- renders nothing. Evaluated only for rows that survived the
             -- index prefilter, like the playlist/lecture subqueries above.
             -- board_id is deliberately NOT emitted: /materials only applies a
             -- board filter when the goal is 'school', and leaving it out only
             -- ever widens the page the student lands on.
             (select jsonb_build_object(
                       'goal_slug', lg.slug,
                       'class_slug', cl.slug,
                       'subject_slug', sub.slug,
                       'chapter_slug', ch.slug,
                       'subject_name', sub.name,
                       'chapter_name', ch.name)
                from public.study_material_scopes s
                left join public.learning_goals lg on lg.id = s.learning_goal_id
                left join public.class_levels   cl on cl.id = s.class_level_id
                left join public.subjects      sub on sub.id = s.subject_id
                left join public.chapters       ch on ch.id  = s.chapter_id
               where s.material_id = sm.id
               order by (s.chapter_id is not null) desc,
                        (s.subject_id is not null) desc,
                        (s.class_level_id is not null) desc,
                        (s.learning_goal_id is not null) desc,
                        s.id
               limit 1) as scope
        from public.study_materials sm
       -- The public RLS policy on study_materials is exactly this predicate.
       -- Written out anyway: this function is SECURITY INVOKER today, and if
       -- that ever changed the gate would still hold.
       where sm.review_status = 'approved'
         and sm.published_at <= now()
         and sm.material_type <> 'previous_year_paper'
         -- CONTENT GUARD, same idea as the chapter block. /materials lists a
         -- material only if it has at least one scope row (the `exists` clause
         -- in get_study_materials), so a scope-less material has no page to
         -- send the student to and must not be suggested.
         and exists (select 1 from public.study_material_scopes s2
                      where s2.material_id = sm.id)
         -- SARGABLE (design note 6), identical in shape to every block above.
         and (   public.search_latin_key(sm.title) like '%' || q_long || '%'
              or public.search_latin_key(sm.title) like q || '%'
              or public.search_latin_key(sm.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'material'::text, c.id, c.title,
           -- "Formula sheet · Physics · Kinematics". The labels mirror
           -- STUDY_MATERIAL_TYPES in src/useStudyMaterials.js, singularised
           -- because this describes one row rather than a filter.
           nullif(concat_ws(' · ',
                    case c.material_type
                      when 'short_notes'   then 'Short notes'
                      when 'formula_sheet' then 'Formula sheet'
                      when 'full_notes'    then 'Full lecture notes'
                      when 'previous_year_paper' then 'Previous-year paper'
                    end,
                    c.scope->>'subject_name',
                    c.scope->>'chapter_name'), ''),
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object(
             'material_type', c.material_type,
             'goal_slug',     c.scope->>'goal_slug',
             'class_slug',    c.scope->>'class_slug',
             'subject_slug',  c.scope->>'subject_slug',
             'chapter_slug',  c.scope->>'chapter_slug')
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ------------------------------------------------------- previous-year papers
  if 'paper' = any(want) then
    return query
    with m as (
      select sm.id, sm.title, sm.material_type, sm.source_name, sm.exam_year,
             public.search_rank_tokens(public.search_latin_key(sm.title), q_tokens, q) as rk,
             -- Does the curated JEE Main papers landing list this paper? That
             -- page (src/useJeeMainPapers.js) selects previous_year_paper rows
             -- whose title matches JEE_MAIN_PAPERS_TITLE_PATTERN, so this is
             -- the same test, and has to be kept in step with that constant.
             -- ilike is not sargable, but it only ever runs on rows the
             -- trigram prefilter already returned.
             (sm.title ilike 'JEE Main%') as jee_main_landing,
             -- board_id is deliberately NOT emitted: /materials only applies a
             -- board filter when the goal is 'school', and leaving it out only
             -- ever widens the page the student lands on.
             (select jsonb_build_object(
                       'goal_slug', lg.slug,
                       'class_slug', cl.slug,
                       'subject_slug', sub.slug,
                       'chapter_slug', ch.slug,
                       'subject_name', sub.name,
                       'chapter_name', ch.name)
                from public.study_material_scopes s
                left join public.learning_goals lg on lg.id = s.learning_goal_id
                left join public.class_levels   cl on cl.id = s.class_level_id
                left join public.subjects      sub on sub.id = s.subject_id
                left join public.chapters       ch on ch.id  = s.chapter_id
               where s.material_id = sm.id
               order by (s.chapter_id is not null) desc,
                        (s.subject_id is not null) desc,
                        (s.class_level_id is not null) desc,
                        (s.learning_goal_id is not null) desc,
                        s.id
               limit 1) as scope
        from public.study_materials sm
       where sm.review_status = 'approved'
         and sm.published_at <= now()
         and sm.material_type = 'previous_year_paper'
         -- CONTENT GUARD. A paper is offered when SOME page on this site
         -- lists it: the JEE Main landing (which reads study_materials
         -- directly and needs no scope) or the /materials directory (which
         -- needs one).
         and (   sm.title ilike 'JEE Main%'
              or exists (select 1 from public.study_material_scopes s2
                          where s2.material_id = sm.id))
         and (   public.search_latin_key(sm.title) like '%' || q_long || '%'
              or public.search_latin_key(sm.title) like q || '%'
              or public.search_latin_key(sm.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'paper'::text, c.id, c.title,
           -- "2024 · National Testing Agency". The year is the fact a student
           -- picks a paper by, so it leads.
           nullif(concat_ws(' · ', c.exam_year::text, c.source_name), ''),
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object(
             'material_type',    c.material_type,
             'jee_main_landing', c.jee_main_landing,
             'goal_slug',        c.scope->>'goal_slug',
             'class_slug',       c.scope->>'class_slug',
             'subject_slug',     c.scope->>'subject_slug',
             'chapter_slug',     c.scope->>'chapter_slug')
      from counted c
     -- The one deliberate departure from the other blocks' ordering. Papers
     -- from every year share one title shape ("JEE Main 2024 Session 1 ..."),
     -- so "shortest title first" would order them arbitrarily. Newest first is
     -- what a student wants, and is what get_study_materials() already does.
     order by c.rk, c.exam_year desc nulls last, length(c.title), c.title
     limit lim offset off;
  end if;
end; $_$;

alter function public.universal_search(text, text[], integer, integer) owner to postgres;

comment on function public.universal_search(text, text[], integer, integer) is
  'Grouped, server-ranked, paginated search. Sargable trigram predicates, multi-token AND matching, word-similarity typo tolerance, Devanagari/Latin bridge. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters. Material and paper groups return only approved, published study material that some page on this site actually lists.';

-- Grants are re-stated because a from-scratch replay must not depend on
-- CREATE OR REPLACE inheriting the existing ACL. Same set as the baseline.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Abort the whole migration if the function it just
-- wrote is not the function this file promised.
-- ---------------------------------------------------------------------
do $selftest$
declare
  src        text;
  is_definer boolean;
  n_material int;
  n_paper    int;
  gone       text;
begin
  select p.prosrc, p.prosecdef
    into src, is_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'universal_search'
     and pg_get_function_identity_arguments(p.oid)
         = 'p_query text, p_types text[], p_limit integer, p_offset integer';

  if src is null then
    raise exception 'universal_search(text, text[], integer, integer) is missing after replace';
  end if;

  -- The whole point of the migration.
  if position('''material''::text' in src) = 0 then
    raise exception 'universal_search has no material group block';
  end if;
  if position('''paper''::text' in src) = 0 then
    raise exception 'universal_search has no paper group block';
  end if;

  -- The five original groups must still be there.
  select g into gone
    from unnest(array['faculty','chapter','playlist','lecture','institute']) as g
   where position('''' || g || '''::text' in src) = 0
   limit 1;
  if gone is not null then
    raise exception 'universal_search lost a pre-existing group block: %', gone;
  end if;

  -- Never elevate. RLS on study_materials is what keeps unapproved material
  -- out of a student's search results.
  if is_definer then
    raise exception 'universal_search must stay SECURITY INVOKER so study_materials RLS applies';
  end if;

  -- The approved+published gate, written out once per new block.
  if (length(src) - length(replace(src, 'review_status = ''approved''', ''))) /
     length('review_status = ''approved''') <> 2 then
    raise exception 'expected the approved gate in exactly both study-material blocks';
  end if;

  -- The indexes the sargable predicates depend on.
  if to_regclass('public.idx_study_materials_title_latin_pattern') is null
     or to_regclass('public.idx_study_materials_title_latin_trgm') is null then
    raise exception 'the study_materials title search indexes were not created';
  end if;

  -- And it still RUNS. A query no title can match must return zero rows
  -- rather than raise -- this executes every block, the two new ones
  -- included, against the real tables.
  select count(*) into n_material
    from public.universal_search('zzqqxx no such material zzqqxx', array['material'], 5, 0);
  select count(*) into n_paper
    from public.universal_search('zzqqxx no such paper zzqqxx', array['paper'], 5, 0);
  if n_material <> 0 or n_paper <> 0 then
    raise exception 'a nonsense query matched study material (% material, % paper)',
      n_material, n_paper;
  end if;

  raise notice 'SELF-TEST PASSED: universal_search has 7 groups, is SECURITY INVOKER, gates study material on approved+published, and executes.';
end
$selftest$;

commit;
