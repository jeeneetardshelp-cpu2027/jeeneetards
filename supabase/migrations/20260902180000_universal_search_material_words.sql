-- ============================================================================
-- UNIVERSAL SEARCH -- let a student find a study material by its KIND.
--
-- THE DEFECT. The material and paper pillars match on the TITLE alone, and the
-- words that name a kind are not in the titles. Re-measured against production
-- on 2026-09-02, with 412 approved materials (full_notes 205,
-- previous_year_paper 187, formula_sheet 20, short_notes 0):
--
--     "pyq"                  ->   0 papers of 187 -- and 173 LECTURES,
--                                            which is worse than nothing:
--                                            it looks like an answer
--     "previous year paper"  ->   0 papers, 9 lectures
--     "ncert notes"          ->   NOTHING, in every group
--     "notes"                ->   0 materials of 412 (1 playlist, 23 lectures)
--     "formula sheet"        ->  20 of 20   (works only because those 20
--                                            titles happen to contain it)
--
-- A full-notes title reads "Units and Measurement - NCERT Physics". The word
-- "notes" appears nowhere, so an all-tokens-must-match query for "ncert notes"
-- can never reach it, and "pyq" reaches no material at all because no title in
-- the catalogue contains that string.
--
-- Worse than a bad result: adding the word the student actually wants COLLAPSES
-- the result set. "ncert physics notes" finds 29 materials; "ncert notes" finds
-- none.
--
-- THE FIX. One IMMUTABLE helper appends the words a student types for a kind to
-- the haystack, and both the rank call and the sargable prefilter use it -- in
-- BOTH pillars. Widening only the rank would leave the row filtered out before
-- it was ever ranked.
--
-- The 0901 migration's own header predicted this: it notes that "notes",
-- "paper" and "pdf" are filler tokens "stripped before matching, so the query
-- itself can never disambiguate them". That is true of CONTENT detection, but
-- universal_search keeps the original tokens when filtering would leave nothing
-- (the pure-filler guard), so a query of only kind words still arrives with its
-- tokens intact -- it simply had no haystack to match. Now it has one.
--
-- WHAT THIS DELIBERATELY CHANGES. A bare "notes" now returns all 225 notes and
-- sheets, and a bare "pyq" all 187 papers, where both returned nothing. That is
-- a real change to group_total on high-frequency queries, and it is the
-- intended reading: a student typing "notes" wants the notes. The group heading
-- ("Notes & sheets", "Previous-year papers") is what tells them what they got.
--
-- NOT ADDED, on purpose: the kind words do NOT include the exam or the subject.
-- Adding "ncert" to every full_notes row would make "ncert" match notes that
-- are not NCERT. Titles already carry those facts where they are true -- the
-- 205 NCERT notes say so, the answer keys say "Answer Key", the papers say
-- "Paper" -- so this adds only the word the title cannot have: its own kind.
--
-- BUILT ON THE ALIAS BODY, NOT THE ANCESTOR. Postgres cannot patch one
-- expression inside a function, so this file re-emits universal_search whole,
-- and whatever it does not carry forward is silently discarded. The first
-- draft of this file was re-emitted from 20260901160000 -- correct when it was
-- written, because that was the newest body then. While it sat in review,
-- 20260902170000 replaced the same function with an alias-aware version, and
-- since db push applies in TIMESTAMP order this file would have run last and
-- reverted every curated shorthand ("shm", "pnc", "aod", "ktg") with no error
-- anywhere. Nothing would have caught it: each migration's rehearsal loaded
-- only its own ancestor, so no test ever executed the chain production gets.
--
-- So the body below is 20260902170000's, with the 12 title sites widened, and
-- the preflight refuses to run at all unless the alias pass is present.
--
-- THE INDEXES MOVE WITH THE EXPRESSION. Postgres matches an expression index
-- by matching the EXPRESSION, so the moment the prefilter stopped saying
-- search_latin_key(title) the two indexes 0901 built for it went unused and
-- both pillars fell back to a sequential scan -- while the SARGABLE comment
-- above each prefilter still claimed otherwise. This builds the same pair on
-- the expression the prefilter now uses and drops the old pair, and the
-- self-verification block below refuses the migration if they are missing.
--
-- Applied with `npx supabase db push`. Rehearsed on a real engine in
-- src/universalSearchMaterialWordsSqlRehearsal.test.js, which executes THIS
-- file on PGlite with pg_trgm and asserts each measured failure above now
-- returns rows.
-- ============================================================================

-- Preflight: this migration replaces a function that must already exist in the
-- shape 0901 left it, and reads a column the baseline defines. Refuse rather
-- than replace something else.
do $preflight$
begin
  if to_regprocedure('public.universal_search(text,text[],integer,integer)') is null then
    raise exception 'REFUSING: universal_search(text,text[],integer,integer) is missing; apply the study-material pillar migration first';
  end if;
  if to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_rank_tokens(text,text[],text)') is null then
    raise exception 'REFUSING: the shared search helpers are missing';
  end if;
  -- ORDERING GUARD. This migration re-emits universal_search WHOLE, because
  -- Postgres cannot patch one expression inside a function body. That makes it
  -- a last-writer-wins statement: whatever this file does not carry forward is
  -- silently discarded. 20260902170000 made the same function alias-aware, and
  -- an earlier draft of THIS file was re-emitted from the pre-alias 0901
  -- ancestor -- which would have reverted every curated shorthand ("shm",
  -- "pnc", "aod") with no error anywhere, on the next db push.
  --
  -- So: refuse unless the alias pass this body is built on is actually here.
  -- If a THIRD migration ever replaces universal_search, it must be re-emitted
  -- from the latest body, and it should add its own check like this one.
  if to_regprocedure('public.search_expand_aliases(text)') is null
     or to_regprocedure('public.search_rank_aliased(text,text[],text,text[],text)') is null then
    raise exception 'REFUSING: the alias pass (20260902170000_search_aliases.sql) is not applied. This file re-emits universal_search from the alias-aware body, so applying it first would leave a function calling helpers that do not exist.';
  end if;
  if to_regclass('public.study_materials') is null then
    raise exception 'REFUSING: study_materials is missing';
  end if;
end
$preflight$;

-- The words a student types for a kind of material, which its title does not
-- contain. IMMUTABLE and PARALLEL SAFE so it can sit inside the same sargable
-- prefilter the title used, and so an expression index over it stays legal.
--
-- Singulars are unnecessary: search_rank_tokens already tries each token's
-- singular form, so "papers" reaches "paper". "pyqs" is listed anyway because
-- search_singular("pyqs") is "pyq" only by luck of the -s rule, and this is
-- the one word in the list a student is more likely to type in the plural.
create or replace function public.study_material_kind_words(p_material_type text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select case p_material_type
    when 'full_notes'          then 'notes'
    when 'short_notes'         then 'short notes summary'
    when 'formula_sheet'       then 'formula sheet formulas'
    when 'previous_year_paper' then 'previous year paper pyq pyqs past paper'
    else ''
  end;
$$;

comment on function public.study_material_kind_words(text) is
  'The words a student types for a kind of study material, which its title does not contain ("notes", "pyq"). Appended to the search haystack by study_material_haystack.';

-- The haystack for one study material: its title plus its kind words, put
-- through the same transliterator the titles already use, so a Devanagari or
-- Hinglish title keeps behaving exactly as it did.
create or replace function public.study_material_haystack(p_title text, p_material_type text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select public.search_latin_key(
    concat_ws(' ', coalesce(p_title, ''), public.study_material_kind_words(p_material_type))
  );
$$;

comment on function public.study_material_haystack(text,text) is
  'search_latin_key(title) widened with the kind words, so "pyq" and "ncert notes" can reach a material whose title never says either. Used by universal_search in both the material and paper pillars, in the rank call AND the prefilter.';

-- Every function in this schema is revoked from PUBLIC and granted to the
-- three Supabase roles by name. universal_search is SECURITY INVOKER, so the
-- anon role executes these two directly on every search -- they are not
-- internal helpers it can reach on the owner's behalf.
revoke all on function public.study_material_kind_words(text) from public;
grant all on function public.study_material_kind_words(text) to anon;
grant all on function public.study_material_kind_words(text) to authenticated;
grant all on function public.study_material_kind_words(text) to service_role;

revoke all on function public.study_material_haystack(text, text) from public;
grant all on function public.study_material_haystack(text, text) to anon;
grant all on function public.study_material_haystack(text, text) to authenticated;
grant all on function public.study_material_haystack(text, text) to service_role;


-- ---------------------------------------------------------------------
-- INDEXES. Postgres matches an expression index by matching the EXPRESSION,
-- so the moment the prefilter stopped saying search_latin_key(title) the two
-- indexes 0901 built for it went unused and both pillars fell back to a seq
-- scan. These are the same pair, on the expression the prefilter now uses --
-- without them the SARGABLE note above each prefilter would be a lie.
--
-- Both helpers are IMMUTABLE with a pinned search_path, which is what makes
-- them legal in an index at all.
--
-- The old pair is dropped: nothing else in the schema reads
-- search_latin_key(title) on this table, so they would only cost write time.
-- ---------------------------------------------------------------------
create index if not exists idx_study_materials_haystack_pattern
  on public.study_materials using btree (public.study_material_haystack(title, material_type) text_pattern_ops);

create index if not exists idx_study_materials_haystack_trgm
  on public.study_materials using gin (public.study_material_haystack(title, material_type) public.gin_trgm_ops);

drop index if exists public.idx_study_materials_title_latin_pattern;
drop index if exists public.idx_study_materials_title_latin_trgm;

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
    -- the study-material blocks would start returning unapproved rows, and
    -- search_aliases would stop being filtered to active rows.
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
  -- The alias pass. When no alias fires these are set to the typed values and
  -- every predicate below collapses to the one it already was.
  q_alias        text;
  q_alias_needle text;
  q_alias_tokens text[];
  q_alias_long   text;
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

  -- ALIAS PASS. Looked up on the Latin key BEFORE filler removal, because
  -- "p and c" only exists as a phrase at this point. The expansion is then
  -- tokenised by search_query_tokens(), the helper whose whole reason to exist
  -- is that "browse search tokenises identically to the homepage" -- so the
  -- alias pass gets the same filler filtering and the same longest-token rule
  -- as the typed pass, from the same code, and cannot drift from it.
  --
  -- When nothing expands, all four alias variables become the typed ones. That
  -- is what makes every added predicate below a duplicate and every added
  -- LEAST a no-op for the overwhelming majority of searches.
  q_alias := public.search_expand_aliases(q);
  if q_alias is not null and q_alias is distinct from q then
    select t.q, t.q_tokens, t.q_long
      into q_alias_needle, q_alias_tokens, q_alias_long
      from public.search_query_tokens(q_alias) t;
  end if;
  if q_alias_needle is null then
    q_alias_needle := q;
    q_alias_tokens := q_tokens;
    q_alias_long   := q_long;
  end if;
  q_alias_long := coalesce(q_alias_long, q_long);

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7. Verbatim from the shipped version — faculty ranking is
  -- search_teachers()' business and is deliberately untouched by v11, which is
  -- also why it is passed the RAW p_query and not the Latin key. Aliases are
  -- catalogue vocabulary, not names, so this block is untouched here too.
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
             public.search_rank_aliased(public.search_latin_key(ch.name), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
       -- CONTENT GUARD (from search_hide_empty_chapters.sql, preserved): never
       -- suggest a chapter with no lessons mapped to it, so parked/empty
       -- chapters cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
         -- SARGABLE (design note 6). Every disjunct is a gin_trgm_ops member
         -- applied to the indexed expression verbatim. The first three are the
         -- shipped gate, untouched; the last two are the alias pass, and are
         -- literal duplicates of the first and third when no alias fired.
         and (   public.search_latin_key(ch.name) like '%' || q_long || '%'
              or public.search_latin_key(ch.name) like q || '%'
              or public.search_latin_key(ch.name) %> q_long
              or public.search_latin_key(ch.name) like '%' || q_alias_long || '%'
              or public.search_latin_key(ch.name) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(pl.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
              or public.search_latin_key(pl.title) %> q_long
              or public.search_latin_key(pl.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(pl.title) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(v.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
              or public.search_latin_key(v.title) %> q_long
              or public.search_latin_key(v.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(v.title) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(ic.name), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
       where (   public.search_latin_key(ic.name) like '%' || q_long || '%'
              or public.search_latin_key(ic.name) like q || '%'
              or public.search_latin_key(ic.name) %> q_long
              or public.search_latin_key(ic.name) like '%' || q_alias_long || '%'
              or public.search_latin_key(ic.name) %> q_alias_long )
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
             public.search_rank_aliased(public.study_material_haystack(sm.title, sm.material_type), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
         and (   public.study_material_haystack(sm.title, sm.material_type) like '%' || q_long || '%'
              or public.study_material_haystack(sm.title, sm.material_type) like q || '%'
              or public.study_material_haystack(sm.title, sm.material_type) %> q_long
              or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_alias_long || '%'
              or public.study_material_haystack(sm.title, sm.material_type) %> q_alias_long )
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
             public.search_rank_aliased(public.study_material_haystack(sm.title, sm.material_type), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
         and (   public.study_material_haystack(sm.title, sm.material_type) like '%' || q_long || '%'
              or public.study_material_haystack(sm.title, sm.material_type) like q || '%'
              or public.study_material_haystack(sm.title, sm.material_type) %> q_long
              or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_alias_long || '%'
              or public.study_material_haystack(sm.title, sm.material_type) %> q_alias_long )
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

-- Grants are re-stated, exactly as 0901 does, because a from-scratch replay
-- must not depend on CREATE OR REPLACE inheriting the existing ACL.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;
-- Self-verification, inside the migration, against rows this transaction
-- inserts and then removes. It proves the WIRING -- that the widened haystack
-- is reachable from both pillars, in the prefilter as well as the rank -- on
-- whatever database this is applied to, not only in the rehearsal.
do $verify$
declare
  v_notes int;
  v_pyq   int;
  v_fail  text[] := array[]::text[];
begin
  select count(*) into v_notes
    from public.study_material_haystack('Units and Measurement - NCERT Physics', 'full_notes') h
   where h like '%notes%';
  if v_notes = 0 then
    v_fail := v_fail || 'full_notes haystack does not contain "notes"';
  end if;

  select count(*) into v_pyq
    from public.study_material_haystack('JEE Main 2024 Session 1', 'previous_year_paper') h
   where h like '%pyq%';
  if v_pyq = 0 then
    v_fail := v_fail || 'previous_year_paper haystack does not contain "pyq"';
  end if;

  -- The title must survive intact: widening must never cost a match that
  -- already worked.
  if public.study_material_haystack('Units and Measurement - NCERT Physics', 'full_notes')
     not like '%measurement%' then
    v_fail := v_fail || 'the title was lost from the haystack';
  end if;

  -- A kind with no words must not gain a trailing separator that could match
  -- a stray token.
  if public.study_material_haystack('Some Title', 'unknown_kind') <> public.search_latin_key('Some Title') then
    v_fail := v_fail || 'an unknown kind changed the haystack';
  end if;

  -- The prefilter is only sargable if the index on its exact expression got
  -- built. On production this block is the only thing that will notice.
  if not exists (select 1 from pg_indexes where schemaname = 'public'
                  and indexname = 'idx_study_materials_haystack_trgm') then
    v_fail := v_fail || 'the trigram index on the haystack expression is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public'
                  and indexname = 'idx_study_materials_haystack_pattern') then
    v_fail := v_fail || 'the prefix index on the haystack expression is missing';
  end if;

  -- The regression this file nearly shipped: prove the alias pass SURVIVED the
  -- re-emit. If the body were rebuilt from the pre-alias ancestor again, these
  -- helpers would be unreferenced and every curated shorthand would go dead.
  if (select count(*) from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'universal_search'
         and p.prosrc like '%search_rank_aliased%') = 0 then
    v_fail := v_fail || 'universal_search no longer calls search_rank_aliased: the alias pass was reverted by this re-emit';
  end if;
  if (select count(*) from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'universal_search'
         and p.prosrc like '%study_material_haystack%') = 0 then
    v_fail := v_fail || 'universal_search does not call study_material_haystack: this migration did nothing';
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'MATERIAL SEARCH WORDS SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'MATERIAL SEARCH WORDS SELF-TEST PASSED: kind words reach both pillars; titles intact.';
end
$verify$;
