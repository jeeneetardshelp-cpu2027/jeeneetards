-- ============================================================================
-- CORRECTION to 20260907091500. The server rule is length(q_long) >= 3, with no
-- token-count branch. My floor silently emptied two working queries.
--
-- WHAT I GOT WRONG. 20260907091500 copied isServableQuery from
-- src/useUniversalSearch.js literally:
--
--     one token    -> length(q_long) >= 3
--     two or more  -> length(q_long) >= 4
--
-- The two sides of the wire do not see the same tokens, so that branch does not
-- survive the trip. The hook counts TYPED words. This function is handed
-- search_query_tokens() output, which is POST filler removal. The hook needs
-- its 4 because "p and c" types three words whose longest is "and" -- filler,
-- but still a word to the browser. By the time it reaches here "and" is gone,
-- the query is ["p","c"], and a floor of 3 refuses it on its own.
--
-- Requiring 4 of a POST-filler token therefore refused queries whose longest
-- surviving token is exactly three characters. Measured on production, before
-- 20260907091500 and again after:
--
--     "def int"   ["def","int"]  q_long "def"   33 rows, 1761ms  ->  0 rows
--     "x ray"     ["x","ray"]    q_long "ray"    8 rows,  747ms  ->  0 rows
--
-- Zero rows, HTTP 200. Not slow and not an error -- silently empty, which is
-- the worst of the three, because it looks like an answer.
--
-- THE CORRECTED RULE is simpler than the one it replaces:
--
--     length(q_long) >= 3
--
-- q_long is the longest surviving token and it is what drives the trigram
-- prefilter, so this says exactly what the prefilter needs and nothing more.
-- It still refuses everything 20260907091500 was written to refuse, because
-- filler removal has already reduced each of those to a 1-2 character anchor.
-- Re-measured on production on 7 Sep 2026, AFTER the Hinglish filler list
-- (20260907140000) landed, since that migration changes what survives:
--
--     "ac"       ["ac"]       q_long "ac"  (2)  -> refused
--     "3d"       ["3d"]       q_long "3d"  (2)  -> refused
--     "p c"      ["p","c"]    q_long "c"   (1)  -> refused
--     "a b c"    ["b","c"]    q_long "b"   (1)  -> refused
--     "p and c"  ["p","c"]    q_long "c"   (1)  -> refused
--
-- The only queries this admits that the old rule refused are the ones with two
-- or more surviving tokens whose longest is exactly 3. That is the regression
-- set, and it is why the change is safe: nothing with a 1-2 character needle
-- moves.
--
-- The client keeps its two-branch rule. It is correct THERE, for the reason
-- above, and src/useUniversalSearch.js carries a comment naming this exact
-- hazard. Do not re-sync them.
--
-- KNOWN, NOT FIXED HERE -- "ac ka matlab" answers 0 on /browse.
-- 20260907093000 put a rescue floor in universal_search: when filler removal
-- would drop q_long below 3, keep the RAW tokens instead. It did not put that
-- floor in the shared helper, search_query_tokens(), whose own comment says it
-- exists so "browse search tokenises identically to the homepage". So the two
-- have drifted, and after 20260907140000 made "ka"/"matlab" filler the helper
-- returns ["ac"], q_long "ac", for a query universal_search still answers.
-- That is a real live defect and it predates this file; the fix is not bundled
-- here because the browse matchers alias-expand too, and "p and c" is measured
-- at 500 57014 under alias expansion with an "and" needle -- so moving the
-- rescue floor into the helper could turn a silent zero into an error. It
-- needs its own measurement, not a ride on a hotfix.
--
-- Only the helper changes here. The matchers already call it, so their bodies
-- are untouched and nothing comes under the carry-over contract in
-- src/searchFeatureCarryOverSqlContract.test.js.
--
-- APPLIED 7 Sep 2026. Verified live by calling search_is_servable on production
-- directly, which pins the rule rather than inferring it from row counts:
--
--     ([def,int], "def")  -> true      ([ac], "ac")   -> false
--     ([x,ray],  "ray")  -> true      ([p,c],  "c")  -> false
--
-- and through the matchers: "x ray" 200 / 0.8s / 8 rows, "def int" 200 /
-- 2.4-3.2s / 176 rows over 4 runs, while "ac", "3d", "p c", "a b c" and
-- "p and c" all still return 0 from both. One cold run of "def int" returned
-- 500 57014 before settling: a 3-character needle is admitted by this rule but
-- is not therefore fast, and that query sits near the ceiling. The floor buys
-- protection from 1-2 character needles, not a latency guarantee.
--
-- Rerunnable: create or replace, grants re-stated.
-- ============================================================================

begin;

create or replace function public.search_is_servable(p_tokens text[], p_long text)
returns boolean
    language sql immutable parallel safe
    set search_path to 'public', 'pg_temp'
    as $$
  -- p_tokens is accepted and deliberately unused. The signature is kept so the
  -- two matchers need no re-emission -- see the carry-over note above. It is
  -- NOT an input to the rule: branching on the token count is the bug this
  -- migration exists to undo.
  select coalesce(length(p_long), 0) >= 3;
$$;

alter function public.search_is_servable(text[], text) owner to postgres;

comment on function public.search_is_servable(text[], text) is
  'Whether a tokenised query can drive the trigram prefilter: the longest SURVIVING token (q_long, post filler removal) must be at least 3 characters. Deliberately NOT the client rule in src/useUniversalSearch.js, which needs a 4-character clause because it counts TYPED words including filler. Requiring 4 here wrongly returned 0 rows for "def int" and "x ray".';

revoke all on function public.search_is_servable(text[], text) from public;
grant all on function public.search_is_servable(text[], text) to anon;
grant all on function public.search_is_servable(text[], text) to authenticated;
grant all on function public.search_is_servable(text[], text) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Both directions, driven through search_query_tokens so it
-- tests the real tokens rather than hand-written ones, and naming the two
-- queries the previous version broke.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_row record;
  v_ok  boolean;
  v_cnt int;
begin
  -- Must refuse: nothing long enough to anchor the scan.
  for v_row in
    select * from (values ('ac'), ('3d'), ('p c'), ('a b c'), ('p and c')) as v(q)
  loop
    select public.search_is_servable(t.q_tokens, t.q_long) into v_ok
      from public.search_query_tokens(v_row.q) t;
    if v_ok is not false then
      raise exception
        'search_is_servable calls % servable; a 1-2 character needle is what 57014 is made of', v_row.q;
    end if;
  end loop;

  -- Must allow. "def int" and "x ray" ARE the regression: two surviving tokens
  -- whose longest is exactly 3, which the old rule refused.
  for v_row in
    select * from (values
      ('def int'), ('x ray'), ('acid'), ('and'), ('class 11'), ('s block'), ('kinematics')
    ) as v(q)
  loop
    select public.search_is_servable(t.q_tokens, t.q_long) into v_ok
      from public.search_query_tokens(v_row.q) t;
    if v_ok is not true then
      raise exception
        'search_is_servable refuses %, which answers HTTP 200 on production -- this is the 20260907091500 regression', v_row.q;
    end if;
  end loop;

  -- And through a matcher, so the guard is exercised where it actually runs.
  for v_row in select * from (values ('ac'), ('p c'), ('p and c')) as v(q) loop
    select count(*)::int into v_cnt from public.search_video_ids(v_row.q);
    if v_cnt <> 0 then
      raise exception 'search_video_ids(%) returned % ids; it should refuse', v_row.q, v_cnt;
    end if;
  end loop;

  raise notice 'search_is_servable corrected to length(q_long) >= 3; def int and x ray restored';
end;
$verify$;

commit;
