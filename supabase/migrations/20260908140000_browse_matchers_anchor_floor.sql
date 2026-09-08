-- ============================================================================
-- The browse matchers choose their needle the way universal_search does.
--
-- THE SPLIT THIS CLOSES. 20260907170000 gave universal_search an anchor floor:
-- scan on the typed CONTENT anchor when it clears three characters, else on the
-- alias expansion's anchor, else refuse. The browse matchers kept a LENGTH rule
-- (search_is_servable, length(q_long) >= 3), and after the search gate dropped
-- to two characters on 8 Sep the two surfaces disagreed in front of students.
-- Measured on production that day:
--
--     "ac"   /search  200, 0.9s, 33 rows -- Alternating Current is row 1
--            /browse  200, 0.25s, 0 rows -- "No courses match this view."
--
-- Same catalogue, same moment, same word. /browse was fast precisely because it
-- REFUSED: q_long is "ac", two characters, so search_is_servable returned false
-- and the function returned before the alias pass ever ran. The catalogue has
-- an Alternating Current chapter, seven playlists and forty-five lectures.
--
-- WHY LOWERING THE LENGTH RULE IS THE WRONG FIX. Dropping the floor to two
-- would let a two-character needle drive the prefilter, and that is the
-- original 57014: too few trigrams for the GIN index, so the planner scans
-- 5,533 titles until Postgres cancels the statement. The needle has to get
-- BETTER, not shorter. "ac" expands to "Alternating Current", so a good needle
-- was available the whole time -- one guard stood between the query and it.
--
-- THE CHANGE, and it is the same three statements 20260907170000 put in
-- universal_search, moved here so both surfaces choose a needle by one rule:
--
--     v_anchor := search_anchor(typed content anchor, alias anchor, raw q_long)
--     if v_anchor is null then return; end if;
--     v_alias  := search_floor_anchor(ta.q_long)
--
-- search_anchor subsumes search_is_servable rather than sitting beside it:
--
--     q_long >= 3               -> the fallback clears the floor, as before
--     q_long < 3, alias good    -> NEW: scans on the alias anchor
--     q_long < 3, no alias      -> null, and the caller returns, as before
--
-- so the length rule is removed rather than kept alongside. Keeping it would
-- veto the middle row, which is the entire point of this file.
--
-- WHAT IT FIXES, verified on production before writing this (see the rehearsal
-- for the same assertions against a real engine):
--
--     "ac"       /browse 0 rows -> the Alternating Current catalogue
--     "3d"       /browse 0 rows -> Vectors and Three-Dimensional Geometry
--     "p and c"  3.1s against a ~3.2s ceiling -> anchors on "permutations"
--
-- That last one matters beyond its own row. "p and c" sat one tenth of a second
-- under the statement timeout and flipped to 500 under load; its typed content
-- anchor is "c", so it now falls through to the alias anchor "permutations"
-- (selective) instead of scanning on "and" (1328 of 5533 titles).
--
-- STILL REFUSED, and they must be: "p c", "a b c", "p n c" -- every token one
-- character, no alias, so search_anchor returns null and the function returns
-- without scanning. A query with nothing to search on still has nothing to
-- search on; this file gives an existing needle a chance, it does not invent
-- one.
--
-- RANKING IS NOT TOUCHED. search_rank_aliased is still called with
-- t.q_tokens/t.q/ta.q_tokens/ta.q and never with the anchor, so this changes
-- which rows are OFFERED to the ranker, not how any row scores. The ORDER BY
-- and the 500-id cap are carried forward verbatim -- both are guarded features
-- in src/searchFeatureCarryOverSqlContract.test.js, because usePlaylistBrowse
-- reads array position as relevance and fetches the whole set in one request.
--
-- BODIES CARRIED FORWARD from 20260907091500, their newest deployed copy, with
-- the guard swapped and the two prefilter needles renamed. t and ta are
-- records, so the anchors are local variables rather than a reassignment of
-- t.q_long the way universal_search does it -- record fields are not
-- assignable in plpgsql.
--
-- Rerunnable: create or replace, grants re-stated.
-- ============================================================================

begin;

do $guard$
begin
  -- This file is only correct on a database that already has the anchor
  -- helpers. Refusing loudly beats silently emitting a body that cannot run.
  if to_regprocedure('public.search_anchor(text,text,text)') is null then
    raise exception 'REFUSING: search_anchor() is missing; 20260907170000 must be applied first';
  end if;
  if to_regprocedure('public.search_content_tokens(text[])') is null then
    raise exception 'REFUSING: search_content_tokens() is missing; 20260907170000 must be applied first';
  end if;
end;
$guard$;

create or replace function public.search_video_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $$
declare
  t       record;
  ta      record;   -- the same tokenisation, of the alias expansion
  a_q     text;
  a_hit   boolean := false;
  v_anchor text;    -- the needle the prefilter scans on
  v_alias  text;    -- the expansion's needle, floored
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

  -- THE FLOOR, and it runs AFTER the alias pass on purpose. The rule this
  -- replaced ran before it, so "ac" was refused on the length of its typed
  -- token and never learned that "Alternating Current" was available.
  -- search_content_tokens is idempotent, so applying it to t.q_tokens recovers
  -- the content anchor whether or not the tokeniser's own rescue floor already
  -- fell back to raw tokens.
  v_anchor := public.search_anchor(
                public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
                ta.q_long,
                t.q_long);
  if v_anchor is null then
    return;
  end if;
  -- Floored too: a future alias whose expansion tokenises short would otherwise
  -- put the sequential scan straight back through its two disjuncts. A null
  -- needle makes `like '%' || null || '%'` and `%> null` null, so they simply
  -- contribute nothing.
  v_alias := public.search_floor_anchor(ta.q_long);

  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || v_anchor || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> v_anchor
            or public.search_latin_key(v.title) like '%' || v_alias || '%'
            or public.search_latin_key(v.title) %> v_alias )
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
  t       record;
  ta      record;   -- the same tokenisation, of the alias expansion
  a_q     text;
  a_hit   boolean := false;
  v_anchor text;
  v_alias  text;
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

  -- Same floor, same order, same reason as search_video_ids above. /browse
  -- opens on this tab, so this is the one students land on.
  v_anchor := public.search_anchor(
                public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
                ta.q_long,
                t.q_long);
  if v_anchor is null then
    return;
  end if;
  v_alias := public.search_floor_anchor(ta.q_long);

  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || v_anchor || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> v_anchor
            or public.search_latin_key(pl.title) like '%' || v_alias || '%'
            or public.search_latin_key(pl.title) %> v_alias )
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
-- SELF-VERIFICATION. Both directions: the queries this exists to admit, and
-- the ones it must still refuse. A floor that admitted everything would pass
-- half of this and is exactly the failure worth catching here.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_row record;
  v_cnt int;
  v_src text;
begin
  -- Must still refuse: nothing to search on, typed or expanded.
  for v_row in select * from (values ('p c'), ('a b c'), ('p n c')) as v(query) loop
    select count(*)::int into v_cnt from public.search_video_ids(v_row.query);
    if v_cnt <> 0 then
      raise exception 'search_video_ids(%) returned % ids; it has no anchor and must refuse',
        v_row.query, v_cnt;
    end if;
    select count(*)::int into v_cnt from public.search_playlist_ids(v_row.query);
    if v_cnt <> 0 then
      raise exception 'search_playlist_ids(%) returned % ids; it has no anchor and must refuse',
        v_row.query, v_cnt;
    end if;
  end loop;

  -- Must now be admitted. "ac" is the query this file exists for: two typed
  -- characters, refused before, and its alias reaches a real chapter.
  if public.search_anchor(
       public.search_token_anchor(public.search_content_tokens(array['ac'])),
       (select t.q_long from public.search_query_tokens(public.search_expand_aliases('ac')) t),
       'ac') is null then
    raise exception 'the anchor for "ac" is null; the alias expansion is not reaching the floor';
  end if;

  -- And end to end, against whatever catalogue this database holds. Guarded on
  -- the fixture existing so the check fails for the right reason.
  select count(*)::int into v_cnt
    from public.playlists
   where public.search_latin_key(title) like '%alternating current%';
  if v_cnt > 0 then
    select count(*)::int into v_cnt from public.search_playlist_ids('ac');
    if v_cnt = 0 then
      raise exception 'search_playlist_ids("ac") is still empty although the catalogue has Alternating Current playlists';
    end if;
  end if;

  -- The length rule must be GONE from both bodies, not merely bypassed. A body
  -- that still calls it would veto the middle case above, and the row counts in
  -- this database might be too small to notice.
  for v_row in select * from (values ('search_video_ids'), ('search_playlist_ids')) as v(fn) loop
    select pg_get_functiondef(('public.' || v_row.fn || '(text)')::regprocedure) into v_src;
    if v_src like '%search_is_servable%' then
      raise exception '% still calls search_is_servable; the length rule vetoes the alias anchor', v_row.fn;
    end if;
    if v_src not like '%search_anchor%' then
      raise exception '% does not call search_anchor; this migration did not take', v_row.fn;
    end if;
    if v_src not like '%order by public.search_rank_aliased%' then
      raise exception '% lost its relevance ordering', v_row.fn;
    end if;
    if v_src not like '%limit 500%' then
      raise exception '% lost the 500-id cap the client depends on', v_row.fn;
    end if;
  end loop;

  raise notice 'browse matchers now choose their needle through search_anchor, like universal_search';
end;
$verify$;

commit;
