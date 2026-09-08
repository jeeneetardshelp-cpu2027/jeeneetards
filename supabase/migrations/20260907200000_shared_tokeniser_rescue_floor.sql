-- ============================================================================
-- search_query_tokens: the rescue floor the shared helper never got.
--
-- 20260907093000 added a rescue floor -- if filler removal would drop q_long
-- below three characters, keep the RAW tokens instead -- and put it inside
-- universal_search only. public.search_query_tokens(), whose own COMMENT says
-- it exists so "browse search tokenises identically to the homepage", did not
-- get it. The two then drifted, and 20260907140000 (144 Hinglish filler words)
-- turned that drift into a visible split. Measured on production 7 Sep 2026:
--
--   query            q_long   /browse            /search
--   "ac ka matlab"   ac (2)   200, 0 rows        200, 26 rows
--   "ac kya hai"     ac (2)   200, 0 rows        200, 26 rows
--   "ph kya hai"     ph (2)   200, 0 rows        200, 22 rows
--   "ac the of"      ac (2)   200, 0 rows        200, 26 rows
--
-- Same catalogue, same student, two answers. /browse is the one that is wrong.
--
-- WHY THE ZERO. The helper hands the browse matchers q_long "ac", two
-- characters, and 20260907160000's floor refuses it before any scan. The floor
-- is right to: a two-character needle is what 57014 is made of. The mistake is
-- upstream -- filler removal should not have reduced the query to "ac" in the
-- first place, because "ka" and "matlab" only became filler on 7 Sep.
--
-- WHY THIS FIXES IT, which is NOT the obvious reason and is worth writing down.
-- Keeping the raw tokens does not make the three typed words match a title.
-- public.search_rank_tokens has exactly two matching tiers and both are
-- conjunctions -- tier 4 needs EVERY token present, tier 5 needs every token
-- over a 0.5 word-similarity threshold. No title contains all three. The rows
-- come from the ALIAS pass: "ac" expands to "Alternating Current", and tier 4
-- matches on the ALIAS tokens. search_rank_aliased takes least() of the typed
-- and aliased ranks, and least() ignores the NULL from the typed side.
--
-- That is exactly how /search already answers this query -- all of its rows
-- come back at tier 4 on "Alternating Current" titles -- and the browse
-- matchers run the same alias pass. They simply never reach it. Verified on
-- production by finding a query that clears the floor today and therefore does
-- reach it:
--
--   "ac one shot"  tokens [ac, one, shot], q_long "shot"  ->  29 rows
--   "ac notes"     tokens [ac],            q_long "ac"    ->   0 rows
--
-- Same "ac", same alias, same matcher. The only variable is whether the needle
-- survived filler removal. This migration is what makes it survive.
--
-- THE CHANGE is one condition, the same one 20260907093000 put in
-- universal_search: filter the filler only when what survives can still drive
-- the index.
--
-- COST, measured rather than assumed. After this, the needle for these queries
-- becomes a raw token that filler removal had been discarding. Each was timed
-- on the browse matcher BEFORE applying, using all-filler queries, which are
-- the one case where the helper already falls back to raw tokens today:
--
--   "kya hai"        needle "hai"          200, 0.36s / 0.40s,  4 rows
--   "ka matlab"      needle "matlab"       200, 0.30s / 0.37s,  0 rows
--   "kaise padhe"    needle "kaise"        200, 0.33s / 0.30s,  0 rows
--   "ke numericals"  needle "numericals"   200, 0.29s / 0.29s,  0 rows
--
-- None is near the ceiling, and none of the rescued Hinglish queries became a
-- timeout. "p and c" did -- see below; the sentence that used to sit here said
-- "this does not turn a silent zero into a timeout" without that exception, and
-- it was wrong.
--
-- APPLIED 7 Sep 2026, and measured immediately. What it bought:
--
--   query           /browse lectures + courses      was
--   "ac ka matlab"  200, 0.59s, 29 + 4              0 + 0
--   "ac kya hai"    200, 1.47s, 29 + 4              0 + 0
--   "ac the of"     200, 2.37s, 48 + 4              0 + 0
--   "ph kya hai"    200, 0.50s,  0 + 0              0 + 0   (unchanged)
--
-- Three of the four. "ph kya hai" is still empty on /browse while /search
-- answers 22; "ph" has no alias reaching a lecture title, so the rescue gives
-- it a needle and there is still nothing for the needle to find here. Not a
-- regression, and not something this file claimed to fix.
--
-- Nothing that worked regressed: "kinematics" 172, "s block" 65, "iit jee" 195,
-- "x ray" 8, "def int" 176, "kinematics ka one shot" 7, "ac one shot" 29,
-- "shm kya hai" 376. "emi ka matlab", which the note below expected to stay
-- broken, answers 200 / 1.47s / 452 rows -- so the single 500 recorded for it
-- earlier was a cold run rather than a standing failure. Every refusal still
-- refuses: "ac", "3d", "p c", "a b c" and "p n c" all return 0 from both
-- matchers.
--
-- WHAT THIS DOES NOT FIX, so nobody credits it later with more than it did:
--
--   * "emi ka matlab" is 500 57014 on /browse and 200 / 82 rows on /search.
--     Its content token "emi" is already three characters, so the rescue never
--     fires and nothing here touches it. The browse matchers are simply more
--     expensive than universal_search for the same needle; that is a query-cost
--     problem and needs its own work.
--   * "p and c" gains a path it did not have: content [p, c] is too short, so
--     the rescue keeps [p, and, c] and the needle becomes "and", which clears
--     the floor. THIS COST WAS PAID. Measured after applying: 500 57014, 3/3
--     runs, ~3.3s, where before it was 200 with 0 rows.
--
--     I had guessed it might come in under the ceiling, on the grounds that
--     these matchers run at about half the cost of universal_search for the
--     same needle ("the and for" is 1.3s here against 2.4s there). That guess
--     was wrong: with the alias expansion on top it lands at 3.3s, the same as
--     universal_search. An "and" needle alone really is cheap; the alias pass
--     is what tips it, and it costs the same on both surfaces.
--
--     Kept, deliberately. universal_search has answered 500 for this query
--     since 20260907093000, so /browse now agrees with /search instead of
--     disagreeing, and no student reaches it on either: isServableQuery refuses
--     "p and c" client-side because its only three-letter word is a connective.
--     The trade is one unreachable query going from a silent zero to a loud
--     error, against three real Hinglish query shapes going from zero to
--     answers. Reverse it with the rollback beside this file if that judgement
--     ever changes -- restoring the pre-rescue body is a create-or-replace.
--
-- ONE FUNCTION, and deliberately so. universal_search, search_video_ids and
-- search_playlist_ids all call search_query_tokens() at RUNTIME, so they pick
-- this up with no re-emission. Re-emitting any of them would drag this under
-- the carry-over contract in src/searchFeatureCarryOverSqlContract.test.js for
-- no benefit. universal_search computes its typed tokens inline and is
-- unaffected on that path; it calls this helper only for the alias pass, where
-- the rescue is a no-op because an expansion's tokens are real words.
--
-- Rerunnable: create or replace, grants re-stated.
-- ============================================================================

begin;

create or replace function public.search_query_tokens(p_query text)
returns table(qlen integer, q text, q_tokens text[], q_long text)
    language plpgsql immutable parallel safe
    set search_path to 'public', 'pg_temp'
    as $_$
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

  -- TWO conditions, not one, and the second is the rescue floor. It is the
  -- same condition 20260907093000 put in universal_search, moved here so both
  -- surfaces get it from one place -- which is the entire reason this helper
  -- exists (see its COMMENT).
  --
  -- q_long is the longest surviving token and it drives the index prefilter.
  -- Filler removal can only shorten it, and a two-character needle yields too
  -- few trigrams for the GIN index. So filter only when what survives can
  -- still anchor a scan:
  --
  --   "kinematics ka one shot"  survivors include "kinematics"  -> filter
  --   "ac ka matlab"            survivors are [ac] alone        -> keep raw,
  --                                                                needle
  --                                                                "matlab"
  if cardinality(v_content) > 0
     and (select max(length(tok)) from unnest(v_content) as tok) >= 3 then
    v_tokens := v_content;
  end if;
  q_tokens := v_tokens;

  select tok into v_long
    from unnest(v_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(v_long, v_q);

  return next;
end; $_$;

alter function public.search_query_tokens(text) owner to postgres;

comment on function public.search_query_tokens(text) is
  'universal_search tokenisation as a reusable helper (latin key, filler-filtered tokens, longest token, length floor). Lets browse search tokenise identically to the homepage. Filler removal applies only when a surviving token is still at least 3 characters -- the rescue floor from 20260907093000, moved here on 7 Sep 2026 so the browse matchers get it too; without it "ac ka matlab" reduced to "ac" and /browse answered 0 rows while /search answered 26.';

revoke all on function public.search_query_tokens(text) from public;
grant all on function public.search_query_tokens(text) to anon;
grant all on function public.search_query_tokens(text) to authenticated;
grant all on function public.search_query_tokens(text) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. The rescue is a behaviour, so check the behaviour, in
-- both directions -- a floor that fired always would pass a one-sided check.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_long   text;
  v_tokens text[];
  v_row    record;
begin
  -- The rescue fires: survivors are too short, so the raw tokens are kept and
  -- the needle is a real word again.
  select t.q_long, t.q_tokens into v_long, v_tokens
    from public.search_query_tokens('ac ka matlab') t;
  if v_long <> 'matlab' then
    raise exception 'rescue did not fire: q_long for "ac ka matlab" is %, expected matlab', v_long;
  end if;
  if cardinality(v_tokens) <> 3 then
    raise exception 'rescue kept % tokens for "ac ka matlab", expected the 3 raw ones', cardinality(v_tokens);
  end if;

  -- The rescue does NOT fire when filtering leaves something usable. This is
  -- the half a floor written too eagerly would break.
  select t.q_long, t.q_tokens into v_long, v_tokens
    from public.search_query_tokens('kinematics ka one shot') t;
  if v_long <> 'kinematics' then
    raise exception 'q_long for "kinematics ka one shot" is %, expected kinematics', v_long;
  end if;
  if 'ka' = any (v_tokens) then
    raise exception 'filler survived a query that had a usable token: %', v_tokens;
  end if;

  -- Queries with no usable token anywhere are still refused. The rescue must
  -- not manufacture an anchor that never existed.
  for v_row in
    select * from (values ('ac'), ('3d'), ('p c'), ('a b c')) as v(query)
  loop
    if (select public.search_is_servable(t.q_tokens, t.q_long)
          from public.search_query_tokens(v_row.query) t) is not false then
      raise exception 'rescue made % servable; it has no anchor at all', v_row.query;
    end if;
  end loop;

  -- And the queries this migration exists for are servable now.
  for v_row in
    select * from (values ('ac ka matlab'), ('ac kya hai'), ('ph kya hai'), ('ac the of')) as v(query)
  loop
    if (select public.search_is_servable(t.q_tokens, t.q_long)
          from public.search_query_tokens(v_row.query) t) is not true then
      raise exception '% is still unservable after the rescue', v_row.query;
    end if;
  end loop;

  raise notice 'search_query_tokens: rescue floor applied; browse now tokenises like the homepage';
end;
$verify$;

commit;
