-- ============================================================================
-- universal_search: choose a needle the trigram index can scan, instead of
-- scanning the catalogue until Postgres cancels the statement.
--
-- THE DEFECT. 20260907093000 put a LENGTH floor under q_long. Length is not the
-- property that matters. Measured on production, 7 Sep 2026, 5,533 videos:
--
--     q_long   matches  % of corpus   universal_search
--     ent          721        13%     200, 1368 ms
--     the          685        12%     200, 2321 ms
--     and         1328        24%     500 57014, ~3.3 s
--     tio         2393        43%     500 57014
--
-- All four clear three characters. And the floor's own rescue is what produces
-- the worst case: when filler removal leaves nothing usable it reverts to the
-- RAW tokens, whose longest member is very often the stopword it just stripped.
-- "p and c" anchors on "and". So 20260907093000 meets two of the three
-- acceptance queries in its own header and misses the third:
--
--     "ac the of"  -> 200 (3/3)          as it predicts
--     "ph the of"  -> 200 (3/3)          as it predicts
--     "p and c"    -> 500 57014 (0/3)    where it says 200
--
-- CONTROL, proving the variable is the needle and not what was typed:
-- "combinations" answers 200 in 719 ms and "permutations and combinations" 200
-- in 1336 ms -- the expansion of that same alias, same catalogue, same moment.
-- "p and c" is a shorthand this site SHIPS (20260902170000 maps it to
-- Permutations and Combinations) and then cannot answer.
--
-- WHY NOT THE FLOOR THE BROWSE RPCs USE. search_is_servable (20260907091500)
-- guards both browse matchers and mirrors isServableQuery in the client. It is
-- the wrong instrument here, and this was measured before it was rejected: it
-- refuses "ac the of" (11 rows), "ph the of" (7 rows) and "ac kya hai" (11
-- rows) -- Hinglish queries that answer today, for exactly the students the
-- Hinglish filler list exists to serve. Its threshold is correct for the
-- surface it was measured against; universal_search answers more, because of
-- the alias pass and seven pillars. Refusing is the wrong shape for this
-- function. Choosing a better needle is the right one.
--
-- THE RULE, as five new IMMUTABLE helpers so the call sites cannot drift:
--   search_min_anchor_len()   the number, in ONE place
--   search_floor_anchor()     an anchor, or null if it cannot drive the index
--   search_content_tokens()   filler removal, idempotent
--   search_token_anchor()     the longest token, ties broken alphabetically
--   search_anchor()           typed content anchor if it clears the floor, else
--                             the longest floored alias or raw fallback, else
--                             NULL -- meaning return nothing rather than scan
--
-- WHAT DOES NOT CHANGE. Ranking. search_rank_aliased is called with q_tokens,
-- q, q_alias_tokens and q_alias_needle, never with q_long, so this alters which
-- rows are OFFERED to the ranker and not how any row scores.
--
-- THE RISK THIS CARRIES, NAMED. The q_long prefilter is a lossless superset of
-- the rank tiers only while q_long is one of q_tokens: tier 4 requires every
-- token as a substring, so a tier-4 row necessarily contains it. An anchor
-- taken from the ALIAS expansion is not one of the typed tokens, so in
-- principle it can exclude a row the ranker would have matched -- silently, with
-- no error. That is the failure mode to watch, and it is why
-- src/universalSearchAnchorFloorSqlRehearsal.test.js snapshots the rows every
-- control query returns BEFORE this migration and asserts afterwards that the
-- set never shrinks. Case 1 above is what keeps the risk narrow: a query whose
-- own content anchor clears the floor never reaches the alias branch at all.
--
-- PROVENANCE. The design is not mine. It is recovered from
-- docs/sql/search_q_long_floor_2026-09-07.sql, deleted in 6104b8b because it
-- re-emitted universal_search from a body predating the Hinglish list and
-- browse relevance and would have clobbered them. The five helpers are its text
-- verbatim. What is new here is that the function body below is the DEPLOYED
-- text of 20260907093000, copied from the file rather than retyped, with the
-- anchor decision inserted -- so nothing is clobbered. The browse RPCs are
-- deliberately untouched: they already have their own floor.
--
-- CARRY-OVER. By construction the material and paper pillars (20260901160000),
-- the alias pass (20260902170000), the kind-word haystack (20260902180000) and
-- the q_long length floor (20260907093000) are all present -- the length floor
-- is kept, not replaced: it still decides q_tokens, and the anchor decision
-- runs after it. src/searchFeatureCarryOverSqlContract.test.js gains a fifth
-- row naming the anchor so the next re-emission cannot quietly drop it.
--
-- Re-runnable: create or replace throughout.
-- ============================================================================

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

do $preflight$
begin
  if to_regprocedure('public.universal_search(text,text[],integer,integer)') is null then
    raise exception 'REFUSING: universal_search is missing; this migration replaces it, it does not create it';
  end if;
  -- The body below calls all three. Refuse rather than write a function whose
  -- helpers are not there.
  if to_regprocedure('public.search_rank_aliased(text,text[],text,text[],text)') is null then
    raise exception 'REFUSING: the alias pass (20260902170000) is not applied';
  end if;
  if to_regprocedure('public.study_material_haystack(text,text)') is null then
    raise exception 'REFUSING: the kind-word haystack (20260902180000) is not applied';
  end if;
  if to_regprocedure('public.search_filler_tokens()') is null then
    raise exception 'REFUSING: search_filler_tokens() is missing';
  end if;
  -- This migration reassigns q_long through the anchor helpers it defines
  -- above. If they failed to create, the body below would reference functions
  -- that do not exist and every search would error at run time, not now.
  if to_regprocedure('public.search_anchor(text,text,text)') is null then
    raise exception 'REFUSING: search_anchor() was not created; the helper block above did not run';
  end if;
end
$preflight$;

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
  -- TWO conditions now, not one. The second is the q_long floor.
  --
  -- q_long is the LONGEST surviving token and it drives the index prefilter.
  -- Removing filler can only shorten it, and a two-character needle yields too
  -- few trigrams for the GIN index -- so the planner scans the whole catalogue
  -- and the statement is cancelled. The student sees "Search is unavailable".
  --
  -- So filler removal is applied only when what survives can still drive the
  -- index. "kinematics ka one shot" keeps its filter, because "kinematics"
  -- survives. "ac ka matlab" does not: filtering would leave "ac" alone, so
  -- the raw tokens are kept and q_long stays "matlab", exactly as today.
  --
  -- This is the same shape as the guard it extends -- if filtering would leave
  -- the query unable to answer, do not filter -- and it exists so the Hinglish
  -- particle list in docs/sql/search_filler_tokens_hinglish_2026-09-07.sql can
  -- be applied without turning six working queries into errors.
  if cardinality(q_content) > 0
     and (select max(length(tok)) from unnest(q_content) as tok) >= 3 then
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

  -- THE ANCHOR. Decide the ONE needle every prefilter below scans on, now that
  -- both the typed and the expanded tokenisations are in hand.
  --
  --   1. the typed CONTENT anchor whenever it clears the floor -- every
  --      ordinary query, and the reason an alias can never displace a literal
  --      match ("shm" still anchors on "shm", not on "harmonic");
  --   2. otherwise the longest of the expansion's anchor and the raw-token
  --      fallback -- which is what turns "p and c" from a 3.3s HTTP 500 into
  --      Permutations and Combinations;
  --   3. otherwise nothing at all, and this function returns rather than scan
  --      the catalogue for three seconds to produce an error banner.
  --
  -- WHY NOT search_is_servable, which the two browse RPCs use. Measured on
  -- production 7 Sep 2026, that rule refuses "ac the of" (11 rows), "ph the of"
  -- (7 rows) and "ac kya hai" (11 rows) -- every one of them a Hinglish query
  -- that answers today. Its threshold is right for the browse matchers it was
  -- measured against and wrong here, because universal_search has the alias
  -- pass and seven pillars and answers more. Refusing is the wrong shape for
  -- this function; choosing a better needle is the right one.
  --
  -- q_long is REASSIGNED rather than shadowed: it appears in twelve disjuncts
  -- across the six pillars below, and one assignment reaches all twelve without
  -- editing a line of them. From here down it means "the needle the prefilter
  -- scans on", which is the only thing those twelve ever used it for.
  --
  -- RANKING IS NOT TOUCHED. search_rank_aliased is called with q_tokens, q,
  -- q_alias_tokens and q_alias_needle -- never with q_long. So this changes
  -- which rows are OFFERED to the ranker, not how any row scores. The
  -- rehearsal asserts the offered set does not shrink for queries that answer
  -- today, because a needle outside q_tokens is not a lossless prefilter and
  -- the failure mode is silent.
  --
  -- search_content_tokens is idempotent, so applying it to q_tokens recovers
  -- the content anchor whether or not the floor above fell back to raw tokens.
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

-- Grants are re-stated because a from-scratch replay must not depend on
-- CREATE OR REPLACE inheriting the existing ACL. Same set as the baseline.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. The floor is a behaviour, so check the behaviour, not
-- the text: a body that kept the marker and lost the condition would pass a
-- grep and fail here.
-- ---------------------------------------------------------------------
do $verify$
declare
  src   text;
  v_fail text[] := array[]::text[];
begin
  select p.prosrc into src
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'universal_search'
     and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_types text[], p_limit integer, p_offset integer';

  -- Carry-over: every feature that existed before this re-emission.
  if position('search_rank_aliased' in src) = 0 then
    v_fail := v_fail || 'the curated shorthand alias pass was dropped by this re-emission';
  end if;
  if position('study_material_haystack' in src) = 0 then
    v_fail := v_fail || 'the material kind-word haystack was dropped by this re-emission';
  end if;
  if position('''material''' in src) = 0 then
    v_fail := v_fail || 'the material pillar was dropped by this re-emission';
  end if;
  -- The floor itself.
  if position('max(length(tok))' in src) = 0 then
    v_fail := v_fail || 'the q_long floor is not in the body this migration just wrote';
  end if;

  -- The anchor decision took. Text first, because a body that never reassigned
  -- q_long would pass every law below and still scan on "and".
  if position('search_anchor' in src) = 0 then
    v_fail := v_fail || 'the anchor decision is not in the body this migration just wrote';
  end if;

  -- LAWS, on synthetic input. Pure functions and hand-written arguments, so
  -- these assert the same thing on production, on staging and in a rehearsal,
  -- regardless of what is in the catalogue.
  if public.search_min_anchor_len() <> 3 then
    v_fail := v_fail || 'the floor is not three characters, and twelve disjuncts depend on it';
  end if;
  if public.search_floor_anchor('ac') is not null then
    v_fail := v_fail || 'a two-character anchor cleared the floor';
  end if;
  if public.search_floor_anchor('shm') is distinct from 'shm' then
    v_fail := v_fail || 'a three-character anchor was rejected by the floor';
  end if;
  -- An alias may never displace a literal match. This is the law of
  -- 20260902170000, restated for the anchor: whenever the typed content anchor
  -- clears the floor it wins outright, whatever the expansion offers.
  if public.search_anchor('shm', 'harmonic', 'shm') is distinct from 'shm' then
    v_fail := v_fail || 'an alias displaced a literal match; the typed content anchor must win';
  end if;
  -- Only when the typed side has nothing does the expansion get to carry it,
  -- and then the LONGEST candidate wins -- which is what stops "and" being
  -- chosen over "combinations".
  if public.search_anchor(null, 'combinations', 'and') is distinct from 'combinations' then
    v_fail := v_fail || 'the raw-token fallback beat a longer alias anchor';
  end if;
  -- Nothing usable anywhere means no anchor, which the body reads as "return
  -- nothing" rather than "scan the catalogue".
  if public.search_anchor(null, 'ab', 'cd') is not null then
    v_fail := v_fail || 'an anchor was invented from candidates that cannot drive the index';
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'ANCHOR FLOOR SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'ANCHOR FLOOR APPLIED: the prefilter now scans on the typed content anchor when it clears three characters, else the longest floored alias or raw fallback, else nothing at all. The q_long length floor, alias pass, material pillars and kind-word haystack are all carried forward.';
end
$verify$;
