-- ============================================================================
-- DO NOT APPLY YET -- FOUR DEFECTS FOUND IN REVIEW, LISTED BELOW.
--
-- The design is right and the payoff is real: on a replay over the whole live
-- catalogue, universal_search("ac") goes 500/57014 -> 60 rows, ("3d") -> 8,
-- ("p and c") -> 36, and the five Hinglish shapes anchor on real words instead
-- of collapsing. Three adversarial reviews agreed on that. They also found the
-- following, each demonstrated rather than argued.
--
-- 1. THE SAFETY ARGUMENT IN THIS HEADER IS FALSE, and it is the reason the
--    change was believed to be free. It claims no healthy query has content
--    tokens all shorter than three characters "because such a query is exactly
--    the 500". Measured on production 2026-09-07, five runs each:
--        "ac notes"     200 / 857-1285 ms / 41 rows   (content tokens ["ac"])
--        "ac class 12"  200 / 1781-1964 ms / 36 rows  (content tokens ["ac"])
--    Both are exactly the shape the header says cannot be healthy, and both are
--    consistently healthy. So the floor DOES move real queries, with measured
--    row losses ("ac class 12" 61 -> 35, "ac question" 56 -> 35, "ac notes"
--    48 -> 35). The lost rows look like substring coincidences -- "Lactation",
--    "The Lac Operon", "The Necklace" -- so the trade is probably good. But it
--    is a trade, and it was never weighed, because the analysis concluded it
--    did not exist.
--
-- 2. THE EARLY RETURN THROWS AWAY A DISJUNCT THIS FILE CALLS SERVABLE. When the
--    anchor floors to null the function returns immediately, discarding the
--    `like q || '%'` prefix branch -- which the header itself describes as an
--    index range scan on a btree, and which works at two characters.
--    universal_search("ph") today returns 50 rows over five runs (one 500, four
--    200 at ~3.1 s: the coin-flip band, not health, but the rows are real
--    prefix matches -- Physics One Shot, Photosynthesis, Phenol). After the
--    change it returns 0. Keeping the prefix disjunct would have cost nothing.
--
-- 3. THE SELF-TEST CANNOT REPORT ITS OWN FAILURES. Fifteen assertions append an
--    UNTYPED literal to a text[]: `v_fail := v_fail || 'message'`. Postgres
--    binds that as anyarray||anyarray and tries to parse the message AS an
--    array. Proved by mutation -- setting search_min_anchor_len() to 2 yields
--        error: malformed array literal: "search_min_anchor_len() is not 3"
--    instead of the intended "Q_LONG FLOOR SELF-TEST FAILED (rolled back): %".
--    It is fail-safe (the block still raises, the transaction still rolls back)
--    but the whole point of the design -- collect every failure, report them
--    together -- is lost: anything already accumulated is discarded. One
--    character per line fixes it: '...'::text. NOTE this is an inherited house
--    pattern, not invented here: 20260902180000 has eight of the same appends
--    and is already applied, so the same latent problem is live.
--
-- 4. ONE PAYOFF TEST ASSERTS NOTHING. In the rehearsal,
--    it("loses no row any of the five already returned") compares against
--    baselines that are all EMPTY -- pre-parked, all five Hinglish shapes
--    return zero rows -- so it compares five empty arrays and can never fail.
--    Separately, universal_search's INLINE token block is unconstrained:
--    reverting the floor there alone still passes 85/85, because the rehearsal
--    measures the shared helpers rather than that block.
--
-- ALSO WORTH KNOWING, not a defect in this file:
--   * REACH. After this ships, isServableQuery (src/useUniversalSearch.js) and
--     useBrowse.js both still refuse a bare "ac" or "3d", so two of the three
--     headline rescues never reach these functions from the UI. Only "p and c"
--     becomes reachable, and only on /browse. The rescue is mostly for callers
--     that bypass the hook.
--   * THE FALLBACK ANCHOR IS A FILLER WORD BY CONSTRUCTION, because filler
--     removal is what shortened the content anchor. Measured as bare needles:
--     "and" 200/2225 ms/240 rows, "class" 200/1440 ms/112, "lecture"
--     200/1254 ms/64 -- against a ~3 s statement timeout. That is one catalogue
--     growth away from the very 57014 this file exists to prevent.
--   * THREE CHARACTERS IS NECESSARY, NOT SUFFICIENT. Selectivity decides, not
--     length: "ion" (3 chars, 3062 of 6774 titles) is a 500; "ation" (5 chars)
--     is a 500; "tion" (4 chars, 2644 titles) scrapes 200 at 3079 ms. Rare
--     3-character needles are fine ("abc", "aaa", "xyz"). No real student token
--     looks like "ion", but the floor should not be described as making the
--     cliff go away, because it does not.
--
-- WHY PARKED RATHER THAN LEFT IN THE CHAIN BEHIND A COMMENT: `supabase db push`
-- has no per-file selection and applies everything pending. On 2 Sep a
-- migration here went live swept along by another session's unrelated push.
-- Being outside supabase/migrations/ is what actually stops that.
--
-- Note the FEATURES rows this migration added to
-- src/searchFeatureCarryOverSqlContract.test.js were reverted when it was
-- parked -- that guard requires a `since` file to be in the chain. Re-add them
-- in the same change that returns this file to it.
-- ============================================================================
--
-- A FLOOR UNDER q_long: never scan the catalogue on a needle the trigram
-- index cannot anchor.
--
-- THE DEFECT. Every search path in this schema picks q_long -- the LONGEST
-- SURVIVING TOKEN after filler removal -- and uses it as the index prefilter:
--
--     search_latin_key(title) like '%' || q_long || '%'
--
-- pg_trgm extracts no full trigram from a one- or two-character LIKE pattern,
-- so the GIN indexes (idx_videos_title_latin_trgm and its five siblings,
-- 20260831140005 lines 9639-9891) cannot qualify a single candidate. The
-- planner scans all 5,533 videos re-evaluating search_latin_key per row, and
-- the statement is cancelled: HTTP 500, SQLSTATE 57014, ~3.3s.
--
-- MEASURED AGAINST PRODUCTION on 2026-09-07 through the anon key that already
-- ships in the browser bundle. Read-only; nothing was written. Companion
-- tokens are held at English filler ("the", "of") so q_long is the ONLY
-- variable, and the tokenisation column is production's own answer from
-- search_query_tokens(), not a re-derivation:
--
--   "q the of"    q_long=q     500  3258ms  57014
--   "qz the of"   q_long=qz    500  3256ms  57014
--   "ac the of"   q_long=ac    500  3302ms  57014
--   "qzx the of"  q_long=qzx   200   888ms   0 rows
--   "xyz the of"  q_long=xyz   200   589ms   4 rows
--
-- and the queries a student actually types:
--
--   "ac"      q_long=ac  500 3253ms      "3d"   q_long=3d  500 3269ms
--   "p and c" q_long=c   500 3274ms      "p c"  q_long=c   500 3242ms
--   "2d"      q_long=2d  200 3113ms  <- a 200 at 3.1s is a coin flip, not health
--
-- "ac", "3d" and "p and c" are SEEDED ALIAS ROWS (20260902170000). Three of the
-- 31 curated shorthands a student is invited to type cannot be answered at all.
--
-- WHAT THE RULE ACTUALLY IS, and where this file diverges from the client.
-- src/useUniversalSearch.js carries isServableQuery, measured over fifteen
-- production queries: one token needs 3 characters, two or more need one token
-- of 4. That is the right rule for the tokens the CLIENT can see -- the ones
-- the student typed. It is the wrong rule here, because the RPC applies it
-- AFTER filler removal, and re-measured on 2026-09-07 the post-filler boundary
-- is a single number:
--
--   "def int"  q_tokens ["def","int"]  q_long=def  200 1761ms  33 rows
--   "x ray"    q_tokens ["x","ray"]    q_long=ray  200  747ms   8 rows
--
-- Both are two-token queries whose longest surviving token is THREE characters,
-- and both are healthy; "def int" is a seeded alias. A floor of 4 on two-token
-- queries would newly break them. Meanwhile "p and c" -- the case that made the
-- client's rule need a 4 -- tokenises to ["p","c"] here, because "and" is
-- already filler, so a floor of 3 on the post-filler tokens catches it anyway.
--
-- So: ONE floor, THREE characters, applied to the anchor rather than to the
-- token count. public.search_min_anchor_len() is the only place the number
-- lives.
--
-- WHAT THIS FLOOR IS NOT. Three characters is NECESSARY, NOT SUFFICIENT.
-- Selectivity of the trigram decides, not its length: measured the same day,
-- "ion" (3 characters) returns 500 and "ation" (5) returns 500, because both
-- are ubiquitous substrings of this catalogue, while "abc", "aaa" and "xyz"
-- are fine at 3. No length rule can catch those, and this one does not claim
-- to. It is a floor against catastrophe -- the shapes a student really types,
-- where the anchor collapses to one or two characters -- not a performance
-- guarantee. Said plainly here so nobody reads a passing floor as a fast query.
--
-- ----------------------------------------------------------------------------
-- THE FIX, in two halves.
--
-- HALF ONE -- filler removal may not eat the anchor. The existing code already
-- reverts to the RAW tokens when filtering leaves NOTHING:
--
--     if cardinality(q_content) > 0 then q_tokens := q_content; end if;
--
-- That guard exists so a pure-filler query ("how to") cannot empty q_tokens and
-- make tier 5's "not exists (unnest(empty))" vacuously match the catalogue.
-- This file extends the SAME condition: take the filtered tokens only when they
-- still leave an anchor that clears the floor. An empty array has no anchor, so
-- the new condition subsumes the old one rather than sitting beside it.
--
-- This is what makes docs/sql/search_filler_tokens_hinglish_2026-09-07.sql safe
-- to un-park. Today "ac ka matlab" tokenises to ["ac","ka","matlab"] and
-- anchors on "matlab" (measured 200, 606ms as a bare needle). The moment "ka"
-- and "matlab" become filler, q_content collapses to ["ac"] and the query joins
-- the 500 family. With this floor it reverts to the raw tokens instead and
-- keeps a real anchor -- "kaise" (611ms), "samjhe", "matlab" -- exactly the
-- behaviour it has today.
--
-- HALF TWO -- when nothing typed can anchor, use the curated expansion, and if
-- there is no expansion either, return instead of scanning.
--
--   public.search_anchor(typed_content_anchor, alias_anchor, fallback_anchor)
--
--   1. The anchor from the CONTENT tokens, whenever it clears the floor. This
--      is every ordinary query, and it is why an alias can never take a literal
--      match away -- "shm" keeps anchoring on "shm", not on "harmonic", so the
--      LAW in 20260902170000 ("the alias pass can never remove or demote a
--      literal match") is untouched.
--   2. Otherwise the longest of the ALIAS expansion's anchor and the raw-token
--      fallback anchor. Both are measured fast where they apply, and the
--      expansion is preferred when it is longer because it is a curated
--      catalogue phrase rather than whatever filler word happened to survive:
--
--        "p and c" fallback anchor "and"          200 2706ms  135 rows
--        "p and c" alias anchor    "combinations" 200  775ms   39 rows
--        "ac"      alias anchor    "alternating"  200  628ms   31 rows
--        "3d"      alias anchor    "dimensional"  200  656ms   16 rows
--
--      ("permutations" and "combinations" are both twelve characters;
--      search_token_anchor breaks the tie alphabetically so one query always
--      produces one plan. "permutations" measures 200 733ms 29 rows -- the
--      choice between two equally long tokens is arbitrary, being DETERMINISTIC
--      is not.)
--
--      That is the difference between technically-a-200 at the edge of the
--      timeout and a real answer, and it is what turns the three dead alias
--      rows into results rather than into a fast empty.
--   3. Otherwise NULL: "2d", "zq", "p c", "a b c" have no anchor anywhere, and
--      the caller returns with no rows. A fast honest zero beats a 3.3s error
--      banner, and it is what the client's own gate already does for these.
--
-- WHY THE ALIAS BRANCH IS ENOUGH ON ITS OWN. Each prefilter is a five-way
-- disjunction and one unselective disjunct poisons all of it, so the fix
-- REPLACES q_long rather than adding to it. Every remaining disjunct is then
-- index-servable: the two like '%anchor%' / %> anchor pairs against the
-- gin_trgm_ops indexes, and like q || '%' against the btree text_pattern_ops
-- indexes the baseline builds on the same expression (20260831140005 lines
-- 9639, 9667, 9719, 9879, plus idx_study_materials_haystack_pattern from
-- 20260902180000). A two-character prefix is an index RANGE SCAN on a btree; it
-- is only the '%needle%' and %> forms that need trigrams. The alias anchors are
-- also floored, so a future alias with a short expansion cannot smuggle the
-- scan back in through the second pass.
--
-- ----------------------------------------------------------------------------
-- WHERE THE FLOOR IS INSTALLED. Four functions, because the tokenisation is
-- duplicated in the schema and a floor in one copy is worse than no floor at
-- all -- it would leave /browse timing out on the queries the search box just
-- learned to answer.
--
--   public.search_query_tokens  the shared tokeniser. Re-emitted from the
--                               baseline, which is the only file that has ever
--                               emitted it.
--   public.universal_search     the search box. INLINES its own copy of the
--                               token block. Re-emitted from
--                               20260902180000_universal_search_material_words
--                               -- the NEWEST body, never the baseline.
--   public.search_video_ids     /browse, Individual Lectures. Re-emitted from
--                               20260902170000_search_aliases.
--   public.search_playlist_ids  /browse, Courses (the DEFAULT tab). Re-emitted
--                               from 20260902240000_browse_course_relevance.
--
-- WHY universal_search STILL INLINES ITS TOKEN BLOCK instead of calling
-- search_query_tokens, which would delete the duplication for good. It was the
-- first thing considered and it was rejected, for one reason: the two are not
-- actually the same computation. universal_search needs the CONTENT anchor and
-- the RAW fallback anchor as separate values (rule 1 versus rule 2 above), and
-- search_query_tokens returns one q_long that is already the choice between
-- them. Exposing both would mean changing its RETURNS TABLE, which cannot be
-- done with CREATE OR REPLACE -- it is a DROP and a re-CREATE of a function
-- three other functions call, on the same push that re-emits all of them.
--
-- The duplication is removed a different way, which costs nothing and cannot
-- drift: the RULE is extracted into functions both copies call.
-- search_content_tokens is now the ONLY definition of filler removal,
-- search_token_anchor the ONLY definition of "longest token", search_anchor the
-- ONLY definition of the floor, and search_min_anchor_len the ONLY place the
-- number 3 appears. What is left duplicated in universal_search is four lines
-- of plumbing that call them, and the self-verification below proves the two
-- sites agree on real queries rather than trusting that they do. That keeps the
-- promise in search_query_tokens' own comment -- "browse search tokenises
-- identically to the homepage" -- structurally, instead of by inspection.
--
-- CARRY-OVER. Re-emitting these three puts this file under
-- src/searchFeatureCarryOverSqlContract.test.js. Every guarded marker is
-- carried forward: the material and paper pillars ('material'), the curated
-- alias pass (search_rank_aliased) and the kind-word haystack
-- (study_material_haystack) in universal_search; search_rank_aliased in the
-- WHERE and in the ORDER BY of both browse functions; the 500-id cap in
-- search_playlist_ids. That file gains a row for the floor itself, keyed on
-- search_anchor, so the next re-emission that drops it fails at author time.
--
-- NOT RE-EMITTED HERE, on purpose: study_material_kind_words,
-- study_material_haystack and the two indexes 20260902180000 builds. They are
-- unchanged, and re-emitting an object this file does not modify is how a
-- feature gets reverted by a file that had no reason to touch it.
--
-- WHAT DOES NOT CHANGE. A query whose content tokens already clear the floor
-- takes rule 1 and every value in the function is what it is today. Only two
-- families move, and BOTH of them are broken today:
--   * content tokens that are all one or two characters -- which means today's
--     q_long is one or two characters, which is the 500;
--   * content tokens empty AND raw tokens all short -- "p c", "a b c".
-- No measured healthy query has non-empty content tokens that are all shorter
-- than three characters, because such a query is exactly the 500. That is why
-- the healthy corpus is untouched rather than merely believed to be.
--
-- Rehearsed on the COMPOSED chain in db-push order on PGlite in
-- src/searchQLongFloorSqlRehearsal.test.js, which also loads the PARKED
-- Hinglish filler list ON TOP of this migration to show the five shapes that
-- list would otherwise break still resolve to a selective anchor. The parked
-- file is NOT un-parked here; making that safe is this migration's job, doing
-- it is a separate decision (src/searchFillerHinglishHoldContract.test.js).
--
-- APPLIED WITH: npx supabase db push. Staged only -- nothing here has run
-- against production.
--
-- FILENAME TIMESTAMP. `ls supabase/migrations/` was run immediately before
-- choosing this number; the chain's newest file was 20260904120000 and real UTC
-- at authoring time was 20260907085610. This chain gained files from three
-- sessions inside one hour on 2 Sep 2026 and a number was twice written onto a
-- slot already taken -- the second time onto an APPLIED migration, which would
-- have made db push skip it in silence. Check again before renaming this file.
--
-- ROLLBACK: re-apply the three function bodies from
-- 20260831140005_production_baseline.sql (search_query_tokens),
-- 20260902180000_universal_search_material_words.sql (universal_search),
-- 20260902170000_search_aliases.sql (search_video_ids) and
-- 20260902240000_browse_course_relevance.sql (search_playlist_ids). The five
-- helpers below can stay: nothing else calls them.
-- ============================================================================

-- ---------------------------------------------------------------------
-- PREFLIGHT. This file re-emits four functions WHOLE, which is a
-- last-writer-wins statement: anything a re-emitted body does not carry
-- forward is silently discarded. Refuse rather than replace something that is
-- not what this body was built from.
-- ---------------------------------------------------------------------
do $preflight$
begin
  if to_regprocedure('public.universal_search(text,text[],integer,integer)') is null
     or to_regprocedure('public.search_query_tokens(text)') is null
     or to_regprocedure('public.search_video_ids(text)') is null
     or to_regprocedure('public.search_playlist_ids(text)') is null then
    raise exception 'REFUSING: one of the four search functions this file re-emits does not exist; this database is not the production chain';
  end if;
  if to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_rank_tokens(text,text[],text)') is null
     or to_regprocedure('public.search_filler_tokens()') is null
     or to_regprocedure('public.search_singular(text)') is null
     or to_regprocedure('public.normalize_search_text(text)') is null then
    raise exception 'REFUSING: a baseline search helper is missing';
  end if;

  -- ORDERING GUARD, the same one 20260902180000 wrote and for the same reason.
  -- universal_search is re-emitted from the alias-aware, haystack-aware body;
  -- applying this onto a database that never got those would leave a function
  -- calling helpers that do not exist -- accepted at CREATE time, because
  -- plpgsql bodies are not resolved until first call, and failing on a
  -- student's first search.
  if to_regprocedure('public.search_expand_aliases(text)') is null
     or to_regprocedure('public.search_rank_aliased(text,text[],text,text[],text)') is null then
    raise exception 'REFUSING: the alias pass (20260902170000_search_aliases.sql) is not applied, and this body is built on it';
  end if;
  if to_regprocedure('public.study_material_haystack(text,text)') is null then
    raise exception 'REFUSING: the kind-word haystack (20260902180000_universal_search_material_words.sql) is not applied, and this body is built on it';
  end if;

  -- The features must ALREADY be in the bodies being replaced. If they are not,
  -- something upstream re-emitted from an older copy and the carry-over rule is
  -- already broken; carrying "forward" from here would cement the loss.
  if position('search_rank_aliased' in
              (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'universal_search')) = 0
     or position('study_material_haystack' in
              (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'universal_search')) = 0 then
    raise exception 'REFUSING: the deployed universal_search has lost the alias pass or the kind-word haystack -- fix that regression before layering a floor on top of it';
  end if;
  if position('limit 500' in
              (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'search_playlist_ids')) = 0 then
    raise exception 'REFUSING: the deployed search_playlist_ids has no 500-id cap -- 20260902240000_browse_course_relevance.sql is not applied';
  end if;
end
$preflight$;


-- ---------------------------------------------------------------------
-- THE RULE, as five functions so that the four call sites cannot drift apart.
-- All of them are IMMUTABLE and PARALLEL SAFE with a pinned search_path: they
-- are pure string work, they are called once per search, and being IMMUTABLE
-- is what would let one appear in an expression index later without a lie.
-- ---------------------------------------------------------------------

-- The number, in one place. THREE, measured: a one- or two-character LIKE
-- pattern yields pg_trgm no full trigram at all, so no GIN index can qualify a
-- candidate and the planner scans. See this file's header for the sweep.
create or replace function public.search_min_anchor_len()
returns integer
language sql
immutable
parallel safe
set search_path to ''
as $$
  select 3;
$$;

comment on function public.search_min_anchor_len() is
  'Shortest needle a trigram prefilter may scan on. Below this pg_trgm extracts no full trigram, the GIN index cannot narrow candidates, and the statement is cancelled (57014). Measured against production 2026-09-07.';

-- An anchor, or nothing. The one place the floor is enforced.
create or replace function public.search_floor_anchor(p_anchor text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select case
    when length(coalesce(p_anchor, '')) >= public.search_min_anchor_len()
      then p_anchor
    else null
  end;
$$;

comment on function public.search_floor_anchor(text) is
  'The needle if it can anchor a trigram scan, otherwise null. A null anchor makes every LIKE and %> disjunct built from it null, which is exactly the intent: a needle below the floor must contribute no disjunct at all.';

-- Filler removal, extracted. This body is character-for-character the filter
-- that universal_search and search_query_tokens each carried their own copy of;
-- now they call it, so "browse search tokenises identically to the homepage"
-- is structural rather than a promise.
--
-- A token is filler if EITHER its typed or its singular form is in the list;
-- both directions are needed. Typed-only lets "problems" through (the list
-- holds "problem"); singular-only lets "class" through, because "class"
-- singularises to "clas", which no list holds.
create or replace function public.search_content_tokens(p_tokens text[])
returns text[]
language sql
immutable
parallel safe
set search_path to ''
as $$
  select array(
    select tok
      from unnest(coalesce(p_tokens, '{}'::text[])) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
$$;

comment on function public.search_content_tokens(text[]) is
  'The subject-matter tokens: filler words, their plurals and bare 1-2 digit numbers removed. The single definition of filler removal for universal_search, search_query_tokens and both /browse id functions.';

-- The longest token, ties broken alphabetically so one query always produces
-- one plan. Null for an empty array, which is what makes the floor test below
-- subsume the old "cardinality > 0" guard instead of sitting beside it.
create or replace function public.search_token_anchor(p_tokens text[])
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select tok
    from unnest(coalesce(p_tokens, '{}'::text[])) as tok
   where tok <> ''
   order by length(tok) desc, tok
   limit 1;
$$;

comment on function public.search_token_anchor(text[]) is
  'The token a prefilter should scan on: the longest, ties alphabetical. Null when there is none.';

-- THE FLOOR. Which needle the index prefilter actually scans on.
--
--   1. the typed CONTENT anchor whenever it clears the floor -- the ordinary
--      path, and the reason an alias can never displace a literal match;
--   2. otherwise the longest of the alias expansion's anchor and the raw-token
--      fallback anchor, both floored;
--   3. otherwise null, and the caller must return rather than scan.
create or replace function public.search_anchor(
  p_typed    text,
  p_alias    text,
  p_fallback text
) returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select coalesce(
    public.search_floor_anchor(p_typed),
    (select tok
       from unnest(array[public.search_floor_anchor(p_alias),
                         public.search_floor_anchor(p_fallback)]) as tok
      where tok is not null
      order by length(tok) desc, tok
      limit 1)
  );
$$;

comment on function public.search_anchor(text, text, text) is
  'The needle the index prefilter scans on: the typed content anchor when it clears search_min_anchor_len(), else the longest floored alias or raw-token fallback anchor, else null. Null means the query has no anchor and must return no rows rather than force a catalogue scan.';

-- Every function in this schema is revoked from PUBLIC and granted to the three
-- Supabase roles by name. The four callers are SECURITY INVOKER, so the anon
-- role executes these directly on every search.
revoke all on function public.search_min_anchor_len() from public;
grant all on function public.search_min_anchor_len() to anon;
grant all on function public.search_min_anchor_len() to authenticated;
grant all on function public.search_min_anchor_len() to service_role;

revoke all on function public.search_floor_anchor(text) from public;
grant all on function public.search_floor_anchor(text) to anon;
grant all on function public.search_floor_anchor(text) to authenticated;
grant all on function public.search_floor_anchor(text) to service_role;

revoke all on function public.search_content_tokens(text[]) from public;
grant all on function public.search_content_tokens(text[]) to anon;
grant all on function public.search_content_tokens(text[]) to authenticated;
grant all on function public.search_content_tokens(text[]) to service_role;

revoke all on function public.search_token_anchor(text[]) from public;
grant all on function public.search_token_anchor(text[]) to anon;
grant all on function public.search_token_anchor(text[]) to authenticated;
grant all on function public.search_token_anchor(text[]) to service_role;

revoke all on function public.search_anchor(text, text, text) from public;
grant all on function public.search_anchor(text, text, text) to anon;
grant all on function public.search_anchor(text, text, text) to authenticated;
grant all on function public.search_anchor(text, text, text) to service_role;


-- ---------------------------------------------------------------------
-- public.search_query_tokens -- the shared tokeniser.
--
-- Re-emitted from 20260831140005_production_baseline.sql line 5837, which is
-- the only file that has ever emitted it, so this is a clean re-emission with
-- nothing to carry forward. The signature is unchanged, so the three functions
-- that select from it keep working with no edit of their own.
--
-- Exactly two things changed. The filler filter and the longest-token pick are
-- now calls to the shared helpers instead of two inline copies, and the
-- condition that chooses between the filtered and the raw tokens gained the
-- floor.
-- ---------------------------------------------------------------------
create or replace function public.search_query_tokens(p_query text)
returns table(qlen integer, q text, q_tokens text[], q_long text)
    language plpgsql immutable parallel safe
    set search_path to 'public', 'pg_temp'
    as $tokens$
declare
  q_raw     text := public.normalize_search_text(p_query);
  v_q       text := public.search_latin_key(p_query);
  v_tokens  text[];
  v_content text[];
begin
  qlen := least(coalesce(length(q_raw), 0), coalesce(length(v_q), 0));
  q := v_q;

  v_tokens := array_remove(string_to_array(coalesce(v_q, ''), ' '), '');
  v_content := public.search_content_tokens(v_tokens);

  -- THE FLOOR, half one. Take the filtered tokens only when they still leave an
  -- anchor a trigram index can scan on; otherwise keep the tokens the student
  -- typed, so the anchor survives even though the meaning-bearing words did
  -- not. This SUBSUMES the pure-filler guard it replaces -- an empty array has
  -- no anchor, so "how to" still keeps its raw tokens and tier 5's
  -- "not exists (unnest(empty))" still cannot match the whole catalogue.
  if public.search_floor_anchor(public.search_token_anchor(v_content)) is not null then
    v_tokens := v_content;
  end if;

  q_tokens := v_tokens;
  q_long   := coalesce(public.search_token_anchor(v_tokens), v_q);

  return next;
end; $tokens$;

alter function public.search_query_tokens(text) owner to postgres;

comment on function public.search_query_tokens(text) is
  'universal_search tokenisation as a reusable helper (latin key, filler-filtered tokens, longest token, length floor). Lets browse search tokenise identically to the homepage. Filler removal is skipped when it would leave no token long enough to anchor a trigram scan -- see search_anchor.';

revoke all on function public.search_query_tokens(text) from public;
grant all on function public.search_query_tokens(text) to anon;
grant all on function public.search_query_tokens(text) to authenticated;
grant all on function public.search_query_tokens(text) to service_role;


-- ---------------------------------------------------------------------
-- public.search_video_ids -- /browse, Individual Lectures.
--
-- Re-emitted from 20260902170000_search_aliases.sql line 1066, its newest body.
-- CARRIED FORWARD: search_rank_aliased in the WHERE and, separately guarded
-- because losing it errors nowhere, in the ORDER BY -- src/useBrowse.js
-- reconstructs relevance purely from the POSITION of each id in the returned
-- array, so a dropped ORDER BY silently serves database-id order under a
-- control that says "Best match".
--
-- CHANGED: two declarations, the anchor block, and q_long replaced by the
-- floored anchor in the two disjuncts that scan on it. Measured before this
-- file: search_video_ids('ac') 500 3232ms 57014, ('3d') 500 3322ms,
-- ('p and c') 500 3237ms -- and src/useBrowse.js gates on term.length alone,
-- so "p and c" (7 characters) and "3d ka question" (14) are sent and the
-- student gets "Couldn't search lessons."
-- ---------------------------------------------------------------------
create or replace function public.search_video_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $vids$
declare
  t      record;
  ta     record;
  a_q    text;
  a_hit  boolean := false;
  anchor text;
  alias_anchor text;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  a_q := public.search_expand_aliases(t.q);
  if a_q is not null and a_q is distinct from t.q then
    select * into ta from public.search_query_tokens(a_q);
    a_hit := (ta.q is not null);
  end if;
  if not a_hit then
    ta := t;
  end if;

  -- THE FLOOR, half two. search_content_tokens is idempotent, so applying it to
  -- t.q_tokens recovers the CONTENT anchor whether or not the tokeniser fell
  -- back to the raw tokens -- which is what lets this site apply the identical
  -- rule to universal_search without a signature change. A null anchor means
  -- nothing here can be scanned on: return, rather than burn the timeout.
  anchor := public.search_anchor(
              public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
              ta.q_long,
              t.q_long);
  if anchor is null then
    return;
  end if;
  alias_anchor := public.search_floor_anchor(ta.q_long);

  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || anchor || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> anchor
            or public.search_latin_key(v.title) like '%' || alias_anchor || '%'
            or public.search_latin_key(v.title) %> alias_anchor )
       and public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null
     order by public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                         ta.q_tokens, ta.q),
              length(v.title), v.id
     limit 500;
end; $vids$;

alter function public.search_video_ids(text) owner to postgres;

comment on function public.search_video_ids(text) is
  'Lecture ids whose title matches p_query with universal_search''s lecture logic, curated shorthand included. Relevance-ordered, capped at 500 so a broad query cannot overflow a URL id-filter. Returns nothing rather than scanning when no needle clears search_min_anchor_len().';

revoke all on function public.search_video_ids(text) from public;
grant all on function public.search_video_ids(text) to anon;
grant all on function public.search_video_ids(text) to authenticated;
grant all on function public.search_video_ids(text) to service_role;


-- ---------------------------------------------------------------------
-- public.search_playlist_ids -- /browse, Courses, the DEFAULT tab.
--
-- Re-emitted from 20260902240000_browse_course_relevance.sql line 140, its
-- newest body. CARRIED FORWARD: search_rank_aliased in the WHERE, the ORDER BY
-- that ranks (src/usePlaylistBrowse.js reads it as array position), and the
-- 500-id cap the whole-set fetch depends on.
--
-- CHANGED: the same three things as search_video_ids, in the same shape.
-- ---------------------------------------------------------------------
create or replace function public.search_playlist_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $pls$
declare
  t      record;
  ta     record;   -- the same tokenisation, of the alias expansion
  a_q    text;
  a_hit  boolean := false;
  anchor text;
  alias_anchor text;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  a_q := public.search_expand_aliases(t.q);
  if a_q is not null and a_q is distinct from t.q then
    select * into ta from public.search_query_tokens(a_q);
    a_hit := (ta.q is not null);
  end if;
  -- No alias: the second pass becomes a copy of the first, every added
  -- disjunct becomes a duplicate, and search_rank_aliased short-circuits.
  if not a_hit then
    ta := t;
  end if;

  -- THE FLOOR, half two. Identical to search_video_ids and to universal_search.
  anchor := public.search_anchor(
              public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
              ta.q_long,
              t.q_long);
  if anchor is null then
    return;
  end if;
  alias_anchor := public.search_floor_anchor(ta.q_long);

  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || anchor || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> anchor
            or public.search_latin_key(pl.title) like '%' || alias_anchor || '%'
            or public.search_latin_key(pl.title) %> alias_anchor )
       and public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null
     order by public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                         ta.q_tokens, ta.q),
              length(pl.title), pl.id
     limit 500;
end; $pls$;

alter function public.search_playlist_ids(text) owner to postgres;

comment on function public.search_playlist_ids(text) is
  'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish, curated shorthand). Relevance-ordered, capped at 500 so the /browse course list can fetch the whole match set and keep the ranking. src/usePlaylistBrowse.js reads that ranking as the POSITION of each id -- there is no rank column. Returns nothing rather than scanning when no needle clears search_min_anchor_len().';

revoke all on function public.search_playlist_ids(text) from public;
grant all on function public.search_playlist_ids(text) to anon;
grant all on function public.search_playlist_ids(text) to authenticated;
grant all on function public.search_playlist_ids(text) to service_role;


-- ---------------------------------------------------------------------
-- public.universal_search -- the search box.
--
-- Re-emitted VERBATIM from 20260902180000_universal_search_material_words.sql
-- lines 202-679, the newest body, comments included. Exactly two edits were
-- made to it and nothing else:
--   1. the token block calls the shared helpers and gained the floor, so it is
--      the same computation search_query_tokens performs;
--   2. after the alias pass, q_long is replaced by search_anchor(...) and the
--      function returns when there is none.
--
-- q_long is REASSIGNED rather than shadowed by a new variable on purpose: it
-- appears in twelve disjuncts across the six pillars, and reassigning one
-- declaration leaves all twelve untouched. From that line on, q_long means "the
-- needle the prefilter scans on" rather than "the longest surviving token" --
-- which is what every one of those twelve uses it for.
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
  -- The filter itself now lives in public.search_content_tokens(), which is the
  -- ONE definition of filler removal in this schema. search_query_tokens()
  -- calls the same function, which is what makes the promise in its comment --
  -- "browse search tokenises identically to the homepage" -- structural rather
  -- than a matter of two copies being kept in step by hand.
  q_content := public.search_content_tokens(q_tokens);

  -- THE FLOOR, half one (20260907090000_search_q_long_floor.sql). The condition
  -- that chose the filtered tokens used to be `cardinality(q_content) > 0`.
  -- It is now "...and they still leave an anchor a trigram index can scan on",
  -- which SUBSUMES the old test: an empty array has no anchor. Filler removal
  -- can only SHORTEN the longest token, and a one- or two-character prefilter
  -- needle is a guaranteed sequential scan and a 57014 -- so when removing
  -- filler would eat the anchor, keep the tokens the student typed and let a
  -- meaningless word carry the scan rather than nothing at all.
  --
  -- This is what makes the parked Hinglish filler list safe to apply: the
  -- moment "ka" and "matlab" become filler, "ac ka matlab" filters down to
  -- ["ac"], and without this line it would join the 500 family.
  if public.search_floor_anchor(public.search_token_anchor(q_content)) is not null then
    q_tokens := q_content;
  end if;

  -- The longest token drives the index prefilter (design note 6). Ties are
  -- broken alphabetically so the same query always produces the same plan.
  q_long := coalesce(public.search_token_anchor(q_tokens), q);

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

  -- THE FLOOR, half two (20260907090000_search_q_long_floor.sql). Decide the
  -- ONE needle every prefilter below scans on, now that both the typed and the
  -- expanded tokenisations are in hand.
  --
  --   1. the typed CONTENT anchor whenever it clears the floor -- every
  --      ordinary query, and the reason an alias can never displace a literal
  --      match ("shm" still anchors on "shm", not on "harmonic");
  --   2. otherwise the longest of the expansion's anchor and the raw-token
  --      fallback -- which is what turns "ac", "3d" and "p and c" from a 3.3s
  --      HTTP 500 into Alternating Current, 3D Geometry and Permutations &
  --      Combinations;
  --   3. otherwise nothing at all, and this function returns rather than scan
  --      the catalogue for three seconds to produce an error banner.
  --
  -- q_long is REASSIGNED rather than shadowed: it appears in twelve disjuncts
  -- across the six pillars below, and one assignment reaches all twelve without
  -- editing a line of them. From here down it means "the needle the prefilter
  -- scans on", which is the only thing those twelve ever used it for.
  --
  -- search_content_tokens is idempotent, so applying it to q_tokens recovers
  -- the content anchor whether or not half one fell back to the raw tokens.
  -- The expression is written identically here, in search_video_ids and in
  -- search_playlist_ids, on purpose.
  q_long := public.search_anchor(
              public.search_token_anchor(public.search_content_tokens(q_tokens)),
              q_alias_long,
              q_long);
  if q_long is null then
    return;
  end if;
  -- The expansion's own anchor is floored too. Nothing forbids a future alias
  -- whose expansion tokenises short, and its two disjuncts would put the
  -- sequential scan straight back. A null needle makes `like '%' || null || '%'`
  -- and `%> null` null, so those disjuncts simply contribute nothing.
  q_alias_long := public.search_floor_anchor(q_alias_long);

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

-- Grants are re-stated, exactly as every re-emission of this function has done,
-- because a from-scratch replay must not depend on CREATE OR REPLACE
-- inheriting the existing ACL.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;


-- ---------------------------------------------------------------------
-- SELF-VERIFICATION, inside the transaction. A failure here rolls the whole
-- migration back, so a body that lost a feature, a floor that is not actually
-- applied, or a curated alias left without an anchor can never reach a student.
--
-- It runs against THIS database's real rows, not against a fixture: the alias
-- assertions read public.search_aliases, and for every shorthand this
-- migration claims to fix it EXECUTES public.universal_search over the real
-- catalogue and requires an answer. Every assertion below can fail.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_fail   text[] := array[]::text[];
  v_src    text;
  v_fn     text;
  v_alias  record;
  t        record;
  ta       record;
  a_q      text;
  v_anchor text;
  v_typed  text;
  v_probe  text;
  v_want   text;
  v_rows   bigint;
  i        int;
  -- query, then the anchor it must resolve to. '' means "no anchor at all", so
  -- the caller returns no rows instead of scanning the catalogue.
  v_probes constant text[] := array[
    'kinematics', 'kinematics',
    'zzqqxx',     'zzqqxx',
    'def int',    'def',
    'x ray',      'ray',
    'p c',        '',
    'a b c',      '',
    'zq',         ''
  ];
begin
  ------------------------------------------------------------------ the number
  if public.search_min_anchor_len() <> 3 then
    v_fail := v_fail || 'search_min_anchor_len() is not 3';
  end if;
  if public.search_floor_anchor('ac') is not null
     or public.search_floor_anchor('abc') is null then
    v_fail := v_fail || 'search_floor_anchor does not cut at three characters';
  end if;

  -------------------------------------------------------------------- the rule
  -- 1. The typed content anchor wins whenever it clears the floor. This is THE
  --    LAW of 20260902170000 restated as arithmetic: an alias may never
  --    displace a literal match, however much longer the expansion is.
  if public.search_anchor('shm', 'harmonic', 'shm') is distinct from 'shm' then
    v_fail := v_fail || 'search_anchor let an alias expansion displace a typed anchor that clears the floor';
  end if;
  -- 2. It does not clear the floor: the longest floored rescue wins.
  if public.search_anchor('ac', 'alternating', 'ac') is distinct from 'alternating' then
    v_fail := v_fail || 'search_anchor did not fall back to the alias expansion';
  end if;
  if public.search_anchor('ac', 'and', 'matlab') is distinct from 'matlab' then
    v_fail := v_fail || 'search_anchor did not prefer the longer of the two rescue anchors';
  end if;
  if public.search_anchor(null, null, 'kaise') is distinct from 'kaise' then
    v_fail := v_fail || 'search_anchor lost the raw-token fallback, which is what protects the Hinglish shapes';
  end if;
  -- 3. Nothing clears the floor: null, and the caller returns.
  if public.search_anchor('c', 'c', 'c') is not null then
    v_fail := v_fail || 'search_anchor returned a needle below the floor';
  end if;

  -------------------------------------------- the property both sites rely on
  -- search_content_tokens must be IDEMPOTENT. /browse recovers the content
  -- anchor by re-applying it to t.q_tokens, which may already be the content
  -- set; if that were not a no-op the two sites would compute different
  -- anchors and "browse tokenises identically to the homepage" would be false.
  if public.search_content_tokens(
       public.search_content_tokens(array['ac','the','notes','12','kinematics']))
     is distinct from
     public.search_content_tokens(array['ac','the','notes','12','kinematics']) then
    v_fail := v_fail || 'search_content_tokens is not idempotent, so /browse and the search box would disagree';
  end if;

  --------------------------------------------- the floor is really in the code
  -- Markers, not comments: deleting the feature deletes these.
  foreach v_fn in array array['universal_search', 'search_query_tokens',
                              'search_video_ids', 'search_playlist_ids']
  loop
    select p.prosrc into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn
     limit 1;
    if position('search_content_tokens' in coalesce(v_src, '')) = 0
       or position('search_token_anchor' in coalesce(v_src, '')) = 0 then
      v_fail := v_fail || (v_fn || ' does not call the shared tokenisation helpers');
    end if;
    if v_fn <> 'search_query_tokens'
       and position('search_anchor(' in coalesce(v_src, '')) = 0 then
      v_fail := v_fail || (v_fn || ' has no anchor floor: this migration did nothing for it');
    end if;
  end loop;

  --------------------------------------------------- nothing was carried away
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'universal_search' limit 1;
  if position('search_rank_aliased' in coalesce(v_src, '')) = 0 then
    v_fail := v_fail || 'universal_search no longer calls search_rank_aliased: the curated alias pass was reverted by this re-emit';
  end if;
  if position('study_material_haystack' in coalesce(v_src, '')) = 0 then
    v_fail := v_fail || 'universal_search no longer calls study_material_haystack: the kind-word pillars were reverted by this re-emit';
  end if;
  if position('''material''' in coalesce(v_src, '')) = 0 then
    v_fail := v_fail || 'universal_search no longer emits the material pillar';
  end if;
  foreach v_fn in array array['search_video_ids', 'search_playlist_ids']
  loop
    select p.prosrc into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn limit 1;
    if position('order by public.search_rank_aliased' in coalesce(v_src, '')) = 0 then
      v_fail := v_fail || (v_fn || ' lost the relevance ORDER BY the /browse client reads as array position');
    end if;
    if position('limit 500' in coalesce(v_src, '')) = 0 then
      v_fail := v_fail || (v_fn || ' lost the 500-id cap');
    end if;
  end loop;

  -------------------------------------------------------------- half one, live
  -- Filler removal must not eat the anchor. "notes" is ALREADY filler in the
  -- deployed list, so "ac notes" is today's exact stand-in for what the parked
  -- Hinglish list would do to "ac ka matlab" -- provable now, with no new word.
  if 'notes' = any (public.search_filler_tokens()) then
    select * into t from public.search_query_tokens('ac notes');
    if t.q_long is distinct from 'notes' then
      v_fail := v_fail || ('filler removal still eats the anchor: "ac notes" resolved to '
                           || coalesce(t.q_long, '<null>') || ' instead of notes');
    end if;
    if not ('notes' = any (t.q_tokens)) then
      v_fail := v_fail || 'the raw-token fallback did not fire for "ac notes"';
    end if;
  end if;
  -- ...and it must still fire for a query of PURE filler, or tier 5's
  -- "not exists (unnest(empty))" matches every row in the catalogue.
  select * into t from public.search_query_tokens('how to');
  if t.q_tokens is null or cardinality(t.q_tokens) = 0 then
    v_fail := v_fail || 'the pure-filler guard was lost: "how to" tokenises to nothing';
  end if;

  -------------------------------------------------------------- half two, live
  i := 1;
  while i < cardinality(v_probes) loop
    v_probe := v_probes[i];
    v_want  := v_probes[i + 1];
    select * into t from public.search_query_tokens(v_probe);
    a_q := public.search_expand_aliases(t.q);
    if a_q is not null and a_q is distinct from t.q then
      select * into ta from public.search_query_tokens(a_q);
    else
      ta := t;
    end if;
    v_anchor := public.search_anchor(
                  public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
                  ta.q_long,
                  t.q_long);
    if coalesce(v_anchor, '') is distinct from v_want then
      v_fail := v_fail || ('anchor for ' || quote_literal(v_probe) || ' is '
                           || coalesce(quote_literal(v_anchor), 'null') || ', expected '
                           || case when v_want = '' then 'null' else quote_literal(v_want) end);
    end if;
    i := i + 2;
  end loop;

  ------------------------------------------- every curated shorthand is usable
  -- Data-driven, over the rows this database actually holds. Before this
  -- migration "ac", "3d" and "p and c" resolved to a one- or two-character
  -- anchor and answered HTTP 500. Every active alias must now resolve to an
  -- anchor that clears the floor, and a future alias seeded with a short
  -- expansion fails here instead of in front of a student.
  for v_alias in
    select a.alias, a.alias_key, a.expansion_key
      from public.search_aliases a
     where a.is_active
  loop
    select * into t from public.search_query_tokens(v_alias.alias_key);
    a_q := public.search_expand_aliases(t.q);
    if a_q is not null and a_q is distinct from t.q then
      select * into ta from public.search_query_tokens(a_q);
    else
      ta := t;
    end if;
    v_typed  := public.search_token_anchor(public.search_content_tokens(t.q_tokens));
    v_anchor := public.search_anchor(v_typed, ta.q_long, t.q_long);

    if v_anchor is null then
      v_fail := v_fail || ('curated alias ' || quote_literal(v_alias.alias)
                           || ' has no anchor that clears the floor, so it can never be answered');
    end if;

    -- END TO END, for the shorthands this migration exists to rescue: the ones
    -- whose own tokens cannot anchor a scan. When the catalogue really holds
    -- the expansion as a phrase, the search must return something. This is the
    -- assertion that would catch "ac" answering a fast EMPTY instead of
    -- Alternating Current -- a bug no shape or marker check can see.
    if public.search_floor_anchor(v_typed) is null
       and exists (select 1 from public.chapters c
                    where public.search_latin_key(c.name)
                          like '%' || v_alias.expansion_key || '%'
                      and exists (select 1 from public.videos v
                                   where v.chapter_id = c.id))
    then
      select count(*) into v_rows
        from public.universal_search(v_alias.alias, null, 5, 0);
      if v_rows = 0 then
        v_fail := v_fail || ('universal_search(' || quote_literal(v_alias.alias)
                             || ') still returns nothing although a chapter named '
                             || quote_literal(v_alias.expansion_key) || ' exists');
      end if;
      -- /browse must be fixed by the same push, or the lecture tab keeps
      -- showing "Couldn't search lessons." for a query the box now answers.
      if (select count(*) from public.search_video_ids(v_alias.alias)) = 0
         and exists (select 1 from public.videos v
                      where public.search_latin_key(v.title)
                            like '%' || v_alias.expansion_key || '%') then
        v_fail := v_fail || ('search_video_ids(' || quote_literal(v_alias.alias)
                             || ') returns nothing although a lesson title contains '
                             || quote_literal(v_alias.expansion_key));
      end if;
    end if;
  end loop;

  -------------------------------------------------------------------- controls
  -- An ordinary query must be untouched end to end. This executes the
  -- re-emitted body over the real catalogue rather than reading its text.
  select count(*) into v_rows from public.universal_search('kinematics', null, 5, 0);
  if v_rows = 0 and exists (select 1 from public.chapters c
                             where public.search_latin_key(c.name) like '%kinematics%') then
    v_fail := v_fail || 'universal_search(''kinematics'') returned nothing although the chapter exists';
  end if;
  -- The one-character floor the function has always had is still first.
  if (select count(*) from public.universal_search('a', null, 5, 0)) <> 0 then
    v_fail := v_fail || 'the qlen < 2 early return was lost';
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'Q_LONG FLOOR SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'Q_LONG FLOOR SELF-TEST PASSED: every prefilter needle clears % characters, every active curated shorthand resolves to one, and the material/alias/haystack features survived the re-emit.',
    public.search_min_anchor_len();
end
$verify$;
