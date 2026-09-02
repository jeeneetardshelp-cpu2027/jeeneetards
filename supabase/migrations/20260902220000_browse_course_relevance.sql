-- ---------------------------------------------------------------------
-- /browse COURSES: give the course search a best-match order.
--
-- STAGED, NOT APPLIED. Nothing here has run against production.
--
-- WHAT IS WRONG TODAY. public.search_playlist_ids(text) has no ORDER BY and no
-- LIMIT. It answers /browse's Courses tab -- the DEFAULT tab -- so a student
-- who types a query gets the matching courses in whatever ?sort= says, with no
-- concept of "best match" anywhere in the chain. Its sibling
-- public.search_video_ids(text), which answers the Individual Lectures tab,
-- already ends
--     order by public.search_rank_aliased(...), length(v.title), v.id limit 500
-- so the two halves of one results page disagree about what a search means.
--
-- MEASURED against production (project kezelafqhgqrprpadmlf) on 2 Sep 2026,
-- through the anon key that already ships in the browser bundle. Nothing below
-- is estimated:
--
--   "kinematics" -> 48 course matches. FOUR of them are literal matches
--   (tier 3/4); the other 44 are trigram-fuzzy tier 5, almost all of them
--   *Mathematics* courses, because "mathematics" is within word_similarity 0.5
--   of "kinematics". Today's default order shows, as page 1 (12 cards):
--     Rectilinear Motion (Kinematics) / Rank Boosters - Mathematics /
--     Functions | JEE Mathematics / Mathematics One Shot / Statistics I
--     Class - XI Mathematics / Parabola | Class XI Mathematics / Chemical
--     Kinetics I / Determinants / Straight Line I / Complex Numbers I /
--     Permutation & combination I / Sequence & Series I
--   The two courses actually CALLED Kinematics -- "Kinematics 1D" and
--   "Kinematics| Irodov solutions" -- are not on page 1 at all. Under the
--   ordering below they are rows 1 and 2.
--
--   "physics" -> 47 matches: 12 prefix-tier, 32 all-tokens, 3 fuzzy. Today the
--   prefix-tier rows are scattered below "MISSION 30 : COMPLETE PHYSICAL
--   CHEMISTRY in One Shot"; after this they lead.
--
--   "organic chemistry" -> 18 matches, ALL tier 4. When every match shares a
--   tier the order falls to the same length(title), id tie-break the lecture
--   list uses. That is a wash for this query, neither better nor worse -- said
--   plainly rather than claimed as a win.
--
-- WHY A LIMIT OF 500, when today there is none. It is the number
-- search_video_ids already uses, and it is what lets the client fetch the
-- WHOLE filtered match set in one request and re-apply the ranking (see
-- src/usePlaylistBrowse.js -- PostgREST cannot ORDER BY position in a
-- client-supplied array, and this RPC returns no rank column, so the ranking
-- reaches the client only as the ORDER of the ids). Measured: production holds
-- 484 playlists in total, and the broadest real query ("che"/"chemistry")
-- matches 96. The cap therefore cannot bind on today's catalogue -- it is a
-- ceiling for later growth and a bound the client can rely on, not a change in
-- what any student sees now.
--
-- CARRY-OVER. This body is the one from
-- 20260902170000_search_aliases.sql -- the curated-shorthand pass
-- (search_expand_aliases + search_rank_aliased, the ta/a_hit second
-- tokenisation, and the two extra alias disjuncts) is carried forward
-- verbatim. Re-emitting from 20260831140005_production_baseline.sql would have
-- silently deleted all of it, because CREATE OR REPLACE is a whole-body
-- replacement and not a merge. src/searchFeatureCarryOverSqlContract.test.js
-- is the guard that makes that failure loud; this migration adds its own row
-- to that file's search_playlist_ids entry.
--
-- FILENAME TIMESTAMP. Migrations apply in lexical order, and this file must
-- run after the alias migration or its preflight aborts. Real UTC at authoring
-- time was 20260902165402, which sorts BEFORE the chain's newest file, so this
-- takes the next free slot in the chain's own numbering rather than wall-clock
-- UTC.
--
-- It was first written as 20260902210000, which COLLIDED: while it was being
-- authored, the parked search-gap-log migration was unparked into the chain
-- and took that exact slot. A version string identifies a migration, so two
-- files sharing one is not a style problem -- it is an ambiguous chain and a
-- `db push` that cannot say which ran. Renamed to 20260902220000, after both.
-- Check `ls supabase/migrations/` before choosing a number: this chain gains
-- files from several sessions on the same day.
--
-- NOT CHANGED HERE: search_video_ids, universal_search, the alias table and
-- its seed, and every helper. This migration re-emits exactly one function.
--
-- ROLLBACK: re-run the search_playlist_ids block from
-- 20260902170000_search_aliases.sql (the same body without the ORDER BY /
-- LIMIT). The client falls back cleanly -- an unordered id list simply means
-- the "Best match" branch reorders by an order that carries no information,
-- which is exactly today's behaviour.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- PREFLIGHT. This file depends on objects an EARLIER migration creates. If it
-- is ever applied out of order -- or onto a database that never got the alias
-- migration -- it must stop here rather than emit a body calling functions
-- that do not exist, which would be accepted at CREATE time (plpgsql bodies
-- are not resolved until first call) and fail on a student's first search.
-- ---------------------------------------------------------------------
do $preflight$
begin
  if to_regprocedure('public.search_expand_aliases(text)') is null then
    raise exception
      'search_expand_aliases(text) does not exist -- apply 20260902170000_search_aliases.sql first';
  end if;
  if to_regprocedure('public.search_rank_aliased(text, text[], text, text[], text)') is null then
    raise exception
      'search_rank_aliased(text, text[], text, text[], text) does not exist -- apply 20260902170000_search_aliases.sql first';
  end if;
  -- The helpers the body has always used. Named separately so a missing one
  -- reports itself by name instead of as a runtime error later.
  if to_regprocedure('public.search_query_tokens(text)') is null
     or to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_rank_tokens(text, text[], text)') is null then
    raise exception 'a baseline search helper is missing -- this database is not the production chain';
  end if;
  if to_regprocedure('public.search_playlist_ids(text)') is null then
    raise exception 'search_playlist_ids(text) does not exist -- there is nothing here to re-emit';
  end if;

  -- The alias pass must ALREADY be in the body being replaced. If it is not,
  -- something re-emitted this function from the baseline and the carry-over
  -- rule has already been broken upstream; carrying "forward" from here would
  -- cement the loss.
  if position('search_rank_aliased' in
              (select p.prosrc from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'search_playlist_ids')) = 0 then
    raise exception
      'the deployed search_playlist_ids has no alias pass -- fix that regression before adding an ordering on top of it';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------
-- THE FUNCTION. Identical to the alias migration's body except for the last
-- three lines: an ORDER BY that ranks and a LIMIT that bounds.
--
-- The ORDER BY expression is the SAME call the WHERE clause already makes, so
-- ordering can never contradict matching: a row is included exactly when its
-- rank is not null, and sorted by that rank. Ties fall to length(pl.title) --
-- the shorter title is the more specific course -- and then to pl.id, which is
-- unique, so the order is TOTAL. That matters more here than it looks: the
-- client pages over this order, and a non-deterministic order would let one
-- course appear on two pages and another on none.
-- ---------------------------------------------------------------------
create or replace function public.search_playlist_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $$
declare
  t     record;
  ta    record;   -- the same tokenisation, of the alias expansion
  a_q   text;
  a_hit boolean := false;
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

  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || t.q_long || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> t.q_long
            or public.search_latin_key(pl.title) like '%' || ta.q_long || '%'
            or public.search_latin_key(pl.title) %> ta.q_long )
       and public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null
     order by public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                         ta.q_tokens, ta.q),
              length(pl.title), pl.id
     limit 500;
end; $$;

alter function public.search_playlist_ids(text) owner to postgres;

comment on function public.search_playlist_ids(text) is
  'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish, curated shorthand). Relevance-ordered, capped at 500 so the /browse course list can fetch the whole match set and keep the ranking. src/usePlaylistBrowse.js reads that ranking as the POSITION of each id -- there is no rank column.';

-- CREATE OR REPLACE inherits the existing ACL; these are re-stated so the file
-- is a complete description of the object, exactly as the alias migration did.
revoke all on function public.search_playlist_ids(text) from public;
grant all on function public.search_playlist_ids(text) to anon;
grant all on function public.search_playlist_ids(text) to authenticated;
grant all on function public.search_playlist_ids(text) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Inside the transaction: a failure here rolls the whole
-- migration back, so a body that lost a feature or an ordering that does not
-- actually rank can never reach a student.
--
--   A. the shape of what was just written -- alias pass, ORDER BY, LIMIT,
--      security posture, and every shipped disjunct;
--   B. the ordering RANKS: on the exact expression the function uses, a
--      literal match for a real query beats a fuzzy one, deterministically and
--      without depending on what is in the catalogue;
--   C. the DEPLOYED function agrees, against whatever catalogue this database
--      actually has: the first id it returns is a best-ranked one.
-- ---------------------------------------------------------------------
do $verify$
declare
  src        text;
  is_definer boolean;
  cfg        text;
  v_n        int;
  v_row      record;
  t          record;
  ta         record;
  a_q        text;
  v_first    text;
  v_lit      int;
  v_fuzzy    int;
  v_best     int;
  v_got      int;
  v_id       bigint;
  v_count    int;
  v_probed   int := 0;
begin
  ------------------------------------------------------------------ A. shape
  select p.prosrc, p.prosecdef, array_to_string(p.proconfig, ',')
    into src, is_definer, cfg
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'search_playlist_ids'
     and pg_get_function_identity_arguments(p.oid) = 'p_query text';

  if src is null then
    raise exception 'search_playlist_ids(text) is missing after replace';
  end if;

  -- Never elevate. RLS is what decides which playlists a reader may see, and
  -- this function must keep asking that question as the reader, not as owner.
  if is_definer then
    raise exception 'search_playlist_ids must stay SECURITY INVOKER';
  end if;
  if cfg is null or position('search_path=' in cfg) = 0 then
    raise exception 'search_playlist_ids lost its pinned search_path';
  end if;

  -- THE CARRY-OVER, asserted rather than trusted. Twice: once in the WHERE
  -- (the match) and once in the ORDER BY (the ranking). A body that calls it
  -- only in the WHERE keeps the alias feature and silently loses this one.
  v_n := (length(src) - length(replace(src, 'search_rank_aliased(', '')))
         / length('search_rank_aliased(');
  if v_n < 2 then
    raise exception
      'search_playlist_ids calls search_rank_aliased % time(s) -- it needs one in the WHERE and one in the ORDER BY', v_n;
  end if;
  if src !~* 'order\s+by\s+public\.search_rank_aliased' then
    raise exception 'search_playlist_ids does not ORDER BY the rank -- the Courses tab would have no best match';
  end if;
  if position('limit 500' in src) = 0 then
    raise exception 'search_playlist_ids has no LIMIT -- the client cannot bound its whole-set fetch';
  end if;
  -- The tie-break that makes the order TOTAL. Without pl.id two courses with
  -- equal rank and equal title length can swap between requests, which shows
  -- up as a card appearing on two pages while another appears on none.
  if position('length(pl.title), pl.id' in src) = 0 then
    raise exception 'search_playlist_ids lost its unique tie-break -- paging over this order would not be stable';
  end if;

  -- Every shipped disjunct survived, so the CANDIDATE SET can only be what it
  -- was. This migration is an ordering change; it must not narrow matching.
  for v_row in
    select unnest(array[
      'like ''%'' || t.q_long || ''%''',
      'like t.q || ''%''',
      '%> t.q_long',
      'like ''%'' || ta.q_long || ''%''',
      '%> ta.q_long'
    ]) as frag
  loop
    if position(v_row.frag in src) = 0 then
      raise exception 'search_playlist_ids lost a match disjunct: %', v_row.frag;
    end if;
  end loop;
  -- And the alias plumbing itself, not just the ranker call.
  if position('search_expand_aliases' in src) = 0 then
    raise exception 'search_playlist_ids no longer expands aliases -- /browse would disagree with the search box';
  end if;

  --------------------------------------------------- B. the ordering RANKS
  -- On the EXACT expression the function orders by, over synthetic titles
  -- shaped like the ones production actually holds. Pure functions, no
  -- catalogue dependency, so this assertion means the same thing on every
  -- database -- including a fresh rehearsal one.
  select * into t from public.search_query_tokens('kinematics');
  a_q := public.search_expand_aliases(t.q);
  if a_q is not null and a_q is distinct from t.q then
    select * into ta from public.search_query_tokens(a_q);
  else
    ta := t;
  end if;

  -- "mathematics" is within trigram word_similarity 0.5 of "kinematics", which
  -- is why 44 of the 48 production matches for that query are Mathematics
  -- courses. The literal must win.
  v_lit := public.search_rank_aliased(
             public.search_latin_key('Kinematics 1D'), t.q_tokens, t.q, ta.q_tokens, ta.q);
  v_fuzzy := public.search_rank_aliased(
             public.search_latin_key('Mathematics Foundation Series'), t.q_tokens, t.q, ta.q_tokens, ta.q);
  if v_lit is null then
    raise exception 'the literal match for "kinematics" does not match at all -- the ranker is broken';
  end if;
  if v_fuzzy is null then
    raise exception 'the fuzzy control for "kinematics" no longer matches -- this assertion has gone vacuous, fix the fixture';
  end if;
  if not (v_lit < v_fuzzy) then
    raise exception
      'a literal match does not outrank a fuzzy one for "kinematics" (literal %, fuzzy %) -- ordering by this expression would not help anyone',
      v_lit, v_fuzzy;
  end if;

  -- The whole ORDER BY, tie-break included, applied to a stand-in catalogue.
  select v.h into v_first
    from (values ('Kinematics 1D'),
                 ('Kinematics| Irodov solutions'),
                 ('Rectilinear Motion (Kinematics)'),
                 ('Mathematics Foundation Series'),
                 ('Rank Boosters - Mathematics'),
                 ('Chemical Kinetics I Class - XII Chemistry')) as v(h)
   where public.search_rank_aliased(public.search_latin_key(v.h), t.q_tokens, t.q,
                                    ta.q_tokens, ta.q) is not null
   order by public.search_rank_aliased(public.search_latin_key(v.h), t.q_tokens, t.q,
                                       ta.q_tokens, ta.q),
            length(v.h), v.h
   limit 1;
  if v_first is distinct from 'Kinematics 1D' then
    raise exception
      'the ORDER BY does not put the best match first: got % for "kinematics"', coalesce(v_first, '<nothing>');
  end if;

  -------------------------------------- C. the DEPLOYED function agrees
  -- Against whatever playlists this database holds. LIMIT 1 on the function
  -- scan reads the FIRST row the function emits -- no sort node in between --
  -- so this compares the ordering that actually shipped against the best rank
  -- present in the match set. A query that matches nothing is skipped, and at
  -- least one query must have matched, so the check cannot pass by doing
  -- nothing at all.
  for v_row in
    select unnest(array['kinematics', 'physics', 'chemistry', 'maths', 'motion']) as q
  loop
    select * into t from public.search_query_tokens(v_row.q);
    a_q := public.search_expand_aliases(t.q);
    if a_q is not null and a_q is distinct from t.q then
      select * into ta from public.search_query_tokens(a_q);
    else
      ta := t;
    end if;

    select count(*)::int into v_count from public.search_playlist_ids(v_row.q);
    if v_count = 0 then
      continue;
    end if;
    if v_count > 500 then
      raise exception 'search_playlist_ids("%") returned % ids -- the LIMIT is not being applied', v_row.q, v_count;
    end if;

    select min(public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                          ta.q_tokens, ta.q))
      into v_best
      from public.search_playlist_ids(v_row.q) s
      join public.playlists pl on pl.id = s.id;

    select s.id into v_id from public.search_playlist_ids(v_row.q) s limit 1;
    select public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q)
      into v_got
      from public.playlists pl
     where pl.id = v_id;

    if v_got is distinct from v_best then
      raise exception
        'search_playlist_ids("%") leads with a course of rank % when rank % exists in the same match set -- the ordering did not take',
        v_row.q, v_got, v_best;
    end if;
    v_probed := v_probed + 1;
  end loop;

  if v_probed = 0 then
    raise exception
      'no query in the probe corpus matched a single course -- this database has no catalogue to verify the ordering against';
  end if;

  raise notice 'search_playlist_ids: relevance ordering verified against % live quer(ies)', v_probed;
end;
$verify$;
