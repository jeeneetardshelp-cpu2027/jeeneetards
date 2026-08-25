-- browse_search_2026-08-25.sql
--
-- The /browse catalogue had its OWN search box that never used the site's real
-- search engine. The homepage / `/search` route call universal_search (multi-
-- token AND, trigram typo tolerance, Devanagari->Latin "Hinglish" bridge, filler
-- and singular handling). But the browse LIST hooks ran a raw single-column
-- `title ilike '%term%'`, so the box a student actually uses while filtering
-- returned ZERO for content that plainly exists:
--
--     query                    homepage (universal_search)   /browse (ilike)
--     "friction problems"      39 lectures + 3 courses        0 / 0
--     "projctile motin" (typo)  6 lectures                    0
--     "kabir ki sakhi" (Hinglish) 3 lectures                  0
--
-- A blank page for content we host is a direct bounce back to YouTube. This
-- migration adds three small, anon-executable functions so the browse list can
-- match with EXACTLY the homepage's logic, then the browse hooks swap their
-- ILIKE for `id in (search_*_ids(term))`.
--
-- DESIGN. Rather than reimplement the matcher (and risk it drifting from the
-- homepage), this reuses the primitives universal_search already uses and
-- reproduces its tokenisation prelude VERBATIM in search_query_tokens(). The two
-- id functions then apply the identical sargable prefilter + search_rank_tokens
-- predicate that universal_search applies to playlists and lectures. The
-- self-test at the bottom PROVES equivalence against universal_search itself, so
-- any future drift fails the deploy loudly.
--
-- WHY plpgsql + a pinned search_path: `%>` (pg_trgm word-similarity) lives in
-- the 'extensions' schema on Supabase and 'public' elsewhere. A `language sql`
-- function resolves its body at CREATE, so `%>` would fail to create on a bare
-- path; plpgsql resolves at first EXECUTION, so we create on a plain path and
-- then ALTER the path to include pg_trgm's real schema (looked up, not guessed)
-- -- the same trap and fix documented in universal_search_v11.sql / the filler
-- tokens file. set_config pins the 0.5 threshold transaction-locally, exactly as
-- universal_search does, so the `%>` prefilter admits the same fuzzy candidates.
--
-- Safe to re-run. Self-verifying at the bottom.

begin;

-- ------------------------------------------------------------
-- 1. Tokenisation, reproduced VERBATIM from universal_search's prelude
--    (universal_search_v11.sql / search_filler_tokens_2026-08-10.sql, lines that
--    build q / q_tokens / q_long). Extracted here so the browse id functions
--    below tokenise a query byte-for-byte the way the homepage does. Returns the
--    latin key, the (filler-filtered) token list, the longest token that drives
--    the index prefilter, and the length floor input.
-- ------------------------------------------------------------
create or replace function public.search_query_tokens(p_query text)
returns table (qlen int, q text, q_tokens text[], q_long text)
language plpgsql immutable parallel safe
set search_path = public, pg_temp
as $$
declare
  q_raw     text := public.normalize_search_text(p_query);
  v_q       text := public.search_latin_key(p_query);
  v_tokens  text[];
  v_content text[];
  v_long    text;
begin
  -- qlen mirrors universal_search: the SHORTER of the raw and transliterated
  -- lengths, so transliteration cannot smuggle a 1-character query past the
  -- 2-character floor the callers enforce.
  qlen := least(coalesce(length(q_raw), 0), coalesce(length(v_q), 0));
  q := v_q;

  -- q is already lower-cased, punctuation-stripped and single-spaced by
  -- search_latin_key, so a single-space split is exact; array_remove is belt
  -- and braces.
  v_tokens := array_remove(string_to_array(coalesce(v_q, ''), ' '), '');

  -- Filler removal: a token survives unless its typed OR singular form is in the
  -- filler list, and bare 1-2 digit numbers are dropped. Tokens are FILTERED,
  -- never rewritten (rewriting them broke typo queries once -- see the filler
  -- tokens file). If filtering would leave nothing, keep the originals, or an
  -- all-filler query would match everything through the tiers' empty-array path.
  v_content := array(
    select tok
      from unnest(v_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(v_content) > 0 then
    v_tokens := v_content;
  end if;
  q_tokens := v_tokens;

  -- Longest token drives the trigram prefilter; ties broken alphabetically so a
  -- query always produces the same plan.
  select tok into v_long
    from unnest(v_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(v_long, v_q);

  return next;
end; $$;

comment on function public.search_query_tokens(text) is
  'universal_search tokenisation as a reusable helper (latin key, filler-filtered tokens, longest token, length floor). Lets browse search tokenise identically to the homepage.';

revoke all on function public.search_query_tokens(text) from public;
grant execute on function public.search_query_tokens(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Playlist (course) ids whose title matches, using the SAME predicate
--    universal_search applies to its playlist group. No LIMIT: there are only a
--    few hundred courses, so the caller can safely `id in (...)` the whole set.
-- ------------------------------------------------------------
create or replace function public.search_playlist_ids(p_query text)
returns table (id bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  -- Design note 4: one character is not a query.
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  -- Pin the word-similarity threshold transaction-locally, as universal_search
  -- does, so the `%>` prefilter admits the same fuzzy candidates.
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || t.q_long || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(pl.title), t.q_tokens, t.q) is not null;
end; $$;

comment on function public.search_playlist_ids(text) is
  'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish). For the /browse course list to search as well as the homepage.';

revoke all on function public.search_playlist_ids(text) from public;
grant execute on function public.search_playlist_ids(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Lecture (video) ids whose title matches, same predicate on videos.title.
--    Capped and relevance-ordered: there are thousands of lectures, and the
--    caller passes the result to a URL `id in (...)` filter, so an unbounded
--    broad query would blow the request-line length. 500 most-relevant ids is
--    far more than any student pages through; the cap is documented, not silent.
-- ------------------------------------------------------------
create or replace function public.search_video_ids(p_query text)
returns table (id bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare t record;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || t.q_long || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> t.q_long )
       and public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q) is not null
     order by public.search_rank_tokens(public.search_latin_key(v.title), t.q_tokens, t.q),
              length(v.title), v.id
     limit 500;
end; $$;

comment on function public.search_video_ids(text) is
  'Lecture ids whose title matches p_query with universal_search''s lecture logic. Relevance-ordered, capped at 500 so a broad query cannot overflow a URL id-filter.';

revoke all on function public.search_video_ids(text) from public;
grant execute on function public.search_video_ids(text) to anon, authenticated, service_role;

commit;

-- The `%>` operator lives in pg_trgm's schema (extensions on Supabase, public
-- elsewhere). plpgsql resolves body SQL at first EXECUTION, so the creates above
-- succeed on a plain path -- but the first call would fail with "operator does
-- not exist: text %> text" unless that schema is on the path. Add it, looked up
-- from pg_extension. Must run AFTER the creates (create-or-replace resets SET).
do $pin_search_path$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'alter function public.search_playlist_ids(text) set search_path = public, %I, pg_temp', v_schema);
  execute format(
    'alter function public.search_video_ids(text) set search_path = public, %I, pg_temp', v_schema);
end
$pin_search_path$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION -- proves the browse id functions match universal_search,
-- so browse search quality equals homepage search quality. Runs outside the
-- transaction so a failure reports loudly without rolling back a correct deploy.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_row       record;
  v_mine      bigint[];
  v_universal bigint[];
  v_total     bigint;
  v_fail      text[] := '{}';
begin
  -- 1. EQUIVALENCE. For each probe, every playlist id universal_search returns
  --    must appear in search_playlist_ids (no under-matching); and when the
  --    universal result is NOT truncated (group_total <= 50), the two id sets
  --    must be identical. This ties the new function to the canonical one.
  for v_row in
    select unnest(array[
      'friction problems',      -- multi-word, the headline failure
      'projectile motion',      -- multi-word exact-ish
      'thermodynamics',         -- single strong token
      'rotatinal motion',       -- typo
      'mole concept'            -- multi-word exact chapter
    ]) as q
  loop
    select array(select id from public.search_playlist_ids(v_row.q) order by id) into v_mine;
    select array(select entity_id from public.universal_search(v_row.q, array['playlist'], 50, 0) order by entity_id)
      into v_universal;
    select coalesce(max(group_total), 0) into v_total
      from public.universal_search(v_row.q, array['playlist'], 50, 0);

    -- no under-matching: universal's ids must be a subset of mine
    if exists (select 1 from unnest(v_universal) u where u <> all (coalesce(v_mine, array[]::bigint[]))) then
      v_fail := v_fail || (v_row.q || ' [playlist: universal id missing from browse]');
    end if;
    -- exact set when not truncated
    if v_total <= 50 and v_mine is distinct from v_universal then
      v_fail := v_fail || (v_row.q || ' [playlist: set differs from universal, total=' || v_total || ']');
    end if;
  end loop;

  -- 2. THE LEAK IS CLOSED. The headline query returned 0 on /browse before; it
  --    must return something now (courses OR lectures).
  if (select count(*) from public.search_playlist_ids('friction problems'))
   + (select count(*) from public.search_video_ids('friction problems')) = 0 then
    v_fail := v_fail || 'friction problems [still zero on browse]';
  end if;

  -- 3. Lecture equivalence (subset): every lecture universal_search returns for
  --    a small-result query must be in search_video_ids. Guarded on the total so
  --    a truncated universal result is not compared against a capped browse one.
  for v_row in select unnest(array['projectile motion', 'friction problems']) as q loop
    select coalesce(max(group_total), 0) into v_total
      from public.universal_search(v_row.q, array['lecture'], 50, 0);
    if v_total <= 500 then
      if exists (
        select entity_id from public.universal_search(v_row.q, array['lecture'], 50, 0)
        except
        select id from public.search_video_ids(v_row.q)
      ) then
        v_fail := v_fail || (v_row.q || ' [lecture: universal id missing from browse]');
      end if;
    end if;
  end loop;

  -- 4. The 2-character floor holds: a single character is not a query.
  if (select count(*) from public.search_playlist_ids('a')) <> 0
   or (select count(*) from public.search_video_ids('a')) <> 0 then
    v_fail := v_fail || 'single-char floor regressed';
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'browse-search self-test FAILED: %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'SELF-TEST PASSED: browse search id functions match universal_search; the friction-problems leak is closed; floor intact.';
end
$verify$;
