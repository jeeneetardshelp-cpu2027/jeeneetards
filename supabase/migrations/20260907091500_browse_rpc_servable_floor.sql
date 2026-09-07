-- ============================================================================
-- BROWSE MATCHERS: floor on the longest TOKEN, not the whole string.
--
-- THE BUG. Both browse matchers already refuse a query, but they measure the
-- wrong thing:
--
--     if t.qlen is null or t.qlen < 2 then return; end if;
--
-- `qlen` is the length of the whole normalised query. The prefilter three lines
-- below matches on `t.q_long`, the LONGEST SURVIVING TOKEN:
--
--     public.search_latin_key(v.title) like '%' || t.q_long || '%'
--
-- Those come apart the moment a query has more than one token. A 1-character
-- token contributes at most one trigram however long the whole string is, so
-- the GIN index cannot narrow candidates, the planner scans, and Postgres
-- cancels the statement (57014). Measured on production 2026-09-03 and again
-- 2026-09-07, against search_video_ids:
--
--     "ac"        qlen 2  q_long "ac"    -> refused by the old guard
--     "p c"       qlen 3  q_long "p"     -> HTTP 500 57014, ~3.2s
--     "a b c"     qlen 5  q_long "a"     -> HTTP 500 57014
--     "p and c"   qlen 7  q_long "c"*    -> HTTP 500 57014, ~3.2s
--     "acid"      qlen 4  q_long "acid"  -> HTTP 200, 325ms, 71 rows
--
--   * "and" is a filler token, so it is removed before q_long is chosen.
--
-- The client stopped sending these in #282 by calling isServableQuery. This is
-- the same rule at the only place that can enforce it for every caller --
-- useUniversalSearch.js:74 has said so all along: "This belongs in the RPC as
-- well -- a caller that skips this hook can still reach the cliff."
--
-- THE RULE, identical to src/useUniversalSearch.js's isServableQuery:
--     one token    -> at least 3 characters
--     two or more  -> at least one token of 4, because 3 is not selective
--                     enough once it is OR-ed with 1-character noise
-- and since q_long IS the longest token, "at least one token of N" is exactly
-- "length(q_long) >= N".
--
-- WHAT THIS IS NOT. It does not narrow what a servable query matches: the
-- disjuncts, the ranker, the ORDER BY, the LIMIT and the grants are carried
-- over byte-identical from the newest deployed bodies, and the verification
-- block below asserts that rather than trusting it. An unservable query changes
-- from "HTTP 500 after 3.2s" to "0 rows immediately".
--
-- Two-character SINGLE-token queries were already refused by `qlen < 2`... and
-- that is the one place this is stricter: "ac" (qlen 2) hit `qlen < 2` = false
-- and was NOT refused. It is refused now, which is the fix for the lecture tab.
--
-- Rerunnable: create or replace, plus grants that are re-stated rather than
-- assumed, so a second run is a no-op.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------
-- The rule, once. Both matchers call it, so they cannot drift from each
-- other the way the client's two copies drifted from isServableQuery.
--
-- IMMUTABLE and PARALLEL SAFE: it reads nothing but its arguments, which is
-- what lets the callers stay `stable` and lets the planner keep folding it.
-- ---------------------------------------------------------------------
create or replace function public.search_is_servable(p_tokens text[], p_long text)
returns boolean
    language sql immutable parallel safe
    set search_path to 'public', 'pg_temp'
    as $$
  select case
           -- No usable token at all: nothing can drive the index.
           when p_long is null or length(p_long) = 0 then false
           -- One token has to carry the whole prefilter on its own.
           when coalesce(cardinality(p_tokens), 1) <= 1 then length(p_long) >= 3
           -- Several tokens: 3 characters is not selective enough once it is
           -- OR-ed with 1-character noise. "p and c" has a 3-character token
           -- (before filler removal) and still times out; "and" alone does not.
           else length(p_long) >= 4
         end;
$$;
alter function public.search_is_servable(text[], text) owner to postgres;
comment on function public.search_is_servable(text[], text) is
  'Whether a tokenised query can drive the trigram index, or will scan and hit the statement timeout. Mirrors isServableQuery in src/useUniversalSearch.js: one token needs 3 characters, several need one of 4. q_long is the longest token, so "a token of N" is length(q_long) >= N.';
revoke all on function public.search_is_servable(text[], text) from public;
grant all on function public.search_is_servable(text[], text) to anon;
grant all on function public.search_is_servable(text[], text) to authenticated;
grant all on function public.search_is_servable(text[], text) to service_role;


-- ---------------------------------------------------------------------
-- The two browse matchers, re-emitted from their newest bodies with the
-- floor added. Everything else is byte-identical to what is deployed:
--   search_video_ids     <- 20260902170000_search_aliases.sql
--   search_playlist_ids  <- 20260902240000_browse_course_relevance.sql
-- ---------------------------------------------------------------------
create or replace function public.search_video_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $$
declare
  t     record;
  ta    record;
  a_q   text;
  a_hit boolean := false;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  -- The floor that matters. qlen measures the WHOLE string; the prefilter below
  -- matches on q_long, the longest surviving token. Those come apart exactly
  -- where this used to fail: "p and c" is 7 characters and its longest token is
  -- 3, so qlen passed and the index could not narrow. See the header.
  if not public.search_is_servable(t.q_tokens, t.q_long) then
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

  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || t.q_long || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> t.q_long
            or public.search_latin_key(v.title) like '%' || ta.q_long || '%'
            or public.search_latin_key(v.title) %> ta.q_long )
       and public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null
     order by public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                         ta.q_tokens, ta.q),
              length(v.title), v.id
     limit 500;
end; $$;
alter function public.search_video_ids(text) owner to postgres;
revoke all on function public.search_video_ids(text) from public;
grant all on function public.search_video_ids(text) to anon;
grant all on function public.search_video_ids(text) to authenticated;
grant all on function public.search_video_ids(text) to service_role;

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
  -- The floor that matters. qlen measures the WHOLE string; the prefilter below
  -- matches on q_long, the longest surviving token. Those come apart exactly
  -- where this used to fail: "p and c" is 7 characters and its longest token is
  -- 3, so qlen passed and the index could not narrow. See the header.
  if not public.search_is_servable(t.q_tokens, t.q_long) then
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
revoke all on function public.search_playlist_ids(text) from public;
grant all on function public.search_playlist_ids(text) to anon;
grant all on function public.search_playlist_ids(text) to authenticated;
grant all on function public.search_playlist_ids(text) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Inside the transaction, so a body that lost a feature
-- rolls the whole migration back rather than reaching a student.
--
--   A. the rule agrees with the measurements it came from, in BOTH
--      directions -- a floor that refuses everything would also pass a
--      refuse-only check;
--   B. both matchers actually call it;
--   C. neither matcher lost a disjunct, its ranker, its ordering or its
--      LIMIT -- this is a refusal change, it must not narrow matching;
--   D. the deployed functions refuse the measured failures and still answer
--      a servable query against whatever catalogue this database holds.
-- ---------------------------------------------------------------------
do $verify$
declare
  src     text;
  v_row   record;
  v_n     int;
  v_ok    boolean;
  v_cnt   int;
  v_ans   int := 0;
begin
  ------------------------------------------------------ A. the rule itself
  -- Unservable: every shape measured at HTTP 500 57014.
  for v_row in
    select * from (values
      ('ac'),        -- one token, 2 chars
      ('3d'),        -- one token, 2 chars
      ('p c'),       -- two 1-char tokens, 3 chars overall
      ('a b c'),     -- three 1-char tokens, 5 chars overall
      ('p and c')    -- longest surviving token is 1-3, 7 chars overall
    ) as v(q)
  loop
    select public.search_is_servable(t.q_tokens, t.q_long) into v_ok
      from public.search_query_tokens(v_row.q) t;
    if v_ok is not false then
      raise exception
        'search_is_servable calls % servable, but it was measured at HTTP 500 57014', v_row.q;
    end if;
  end loop;

  -- Servable: every shape measured at HTTP 200. Without this half the floor
  -- could refuse everything and still pass the block above.
  for v_row in
    select * from (values
      ('acid'), ('and'), ('org'), ('class 11'), ('p block'), ('jee 2025')
    ) as v(q)
  loop
    select public.search_is_servable(t.q_tokens, t.q_long) into v_ok
      from public.search_query_tokens(v_row.q) t;
    if v_ok is not true then
      raise exception
        'search_is_servable refuses %, which answers HTTP 200 in production -- the floor is too high', v_row.q;
    end if;
  end loop;

  ------------------------------------------- B and C. the two matchers
  for v_row in
    select unnest(array['search_video_ids', 'search_playlist_ids']) as fn
  loop
    select p.prosrc into src
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_row.fn
       and pg_get_function_identity_arguments(p.oid) = 'p_query text';

    if src is null then
      raise exception '%(text) is missing after replace', v_row.fn;
    end if;
    if position('search_is_servable' in src) = 0 then
      raise exception '% does not call search_is_servable -- the floor did not take', v_row.fn;
    end if;

    -- The candidate set must be untouched: this is a refusal change.
    if position('search_expand_aliases' in src) = 0 then
      raise exception '% lost its alias expansion', v_row.fn;
    end if;
    v_n := (length(src) - length(replace(src, 'search_rank_aliased(', '')))
           / length('search_rank_aliased(');
    if v_n < 2 then
      raise exception
        '% calls search_rank_aliased % time(s) -- it needs one in the WHERE and one in the ORDER BY', v_row.fn, v_n;
    end if;
    if src !~* 'order\s+by\s+public\.search_rank_aliased' then
      raise exception '% no longer orders by rank', v_row.fn;
    end if;
    if position('limit 500' in src) = 0 then
      raise exception '% lost its LIMIT', v_row.fn;
    end if;
    if position('%> t.q_long' in src) = 0
       or position('like ''%'' || t.q_long || ''%''' in src) = 0
       or position('like t.q || ''%''' in src) = 0
       or position('%> ta.q_long' in src) = 0
       or position('like ''%'' || ta.q_long || ''%''' in src) = 0 then
      raise exception '% lost a match disjunct -- this migration must not narrow matching', v_row.fn;
    end if;
  end loop;

  ------------------------------------------ D. the deployed functions
  -- Every measured failure must now return nothing, from both matchers.
  for v_row in
    select * from (values ('ac'), ('p c'), ('a b c'), ('p and c')) as v(q)
  loop
    select count(*)::int into v_cnt from public.search_video_ids(v_row.q);
    if v_cnt <> 0 then
      raise exception 'search_video_ids("%") returned % ids -- it should refuse', v_row.q, v_cnt;
    end if;
    select count(*)::int into v_cnt from public.search_playlist_ids(v_row.q);
    if v_cnt <> 0 then
      raise exception 'search_playlist_ids("%") returned % ids -- it should refuse', v_row.q, v_cnt;
    end if;
  end loop;

  -- And a servable query must still be answered, or this migration has simply
  -- switched search off. Catalogue-dependent, so a query that matches nothing
  -- here is skipped -- but at least one must match, or the check is vacuous.
  for v_row in
    select unnest(array['physics', 'chemistry', 'kinematics', 'motion']) as q
  loop
    select count(*)::int into v_cnt from public.search_playlist_ids(v_row.q);
    if v_cnt > 0 then
      v_ans := v_ans + 1;
    end if;
  end loop;
  if v_ans = 0 then
    raise exception
      'no servable query matched a single course -- either the floor is wrong or this database has no catalogue to verify against';
  end if;

  raise notice 'browse matchers: floor verified, % servable quer(ies) still answered', v_ans;
end;
$verify$;


commit;
