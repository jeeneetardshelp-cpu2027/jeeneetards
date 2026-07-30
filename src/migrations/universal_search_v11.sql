-- =====================================================================
--  universal_search_v11.sql — ranking + search function, rewritten.
--
--  Replaces the ranking half of universal_search.sql / search_hide_empty_chapters.sql.
--  The RPC SIGNATURE and the RETURNS TABLE column list are byte-identical to the
--  version in production, so useUniversalSearch.js / UniversalSearch.jsx need no
--  change: same four match_type strings ('exact' | 'prefix' | 'partial' | 'fuzzy'),
--  same group_total, same extra payloads, same ordering rules.
--
--  APPLY THIS FILE AS ONE TRANSACTION. Pasting the whole script into the
--  Supabase SQL editor does that. It matters: the self-test at the bottom raises
--  an exception when search is still broken, and that only rolls the DDL back if
--  the DDL and the test share a transaction. A half-applied search is worse than
--  an unapplied one.
--
--  Depends on: pg_trgm, schema.sql, and public.search_latin_key(text) (shipped
--  separately — the preflight below refuses to continue without it).
--
--  ---------------------------------------------------------------------
--  WHAT WAS WRONG, AND WHAT CHANGED
--  ---------------------------------------------------------------------
--
--  P1  NOT SARGABLE. Every group filtered on
--          where public.search_rank(public.normalize_search_text(col), q) is not null
--      A function result compared to NULL exposes nothing to the planner. All
--      seven trigram indexes were dead weight and every keystroke seq-scanned
--      the table, running three regexp_replace calls plus similarity() per row.
--      FIX: the WHERE clause now contains only operators that are members of
--      gin_trgm_ops (LIKE / %>) applied DIRECTLY to the indexed expression. The
--      tier is computed afterwards, on the handful of rows the index returned.
--
--  P2  TYPO TOLERANCE WAS DEAD. similarity() compares WHOLE strings. A 15-char
--      query against a 90-char lecture title scores ~0.13, nowhere near the 0.4
--      threshold, so "projctile motin" returned nothing at all. FIX: word_
--      similarity() / the %> operator, which score the best-matching extent at
--      word boundaries instead of the whole haystack — and, unlike similarity(),
--      %> is GIN-indexable in the form  indexed_expression %> 'needle'.
--
--  P3  MULTI-WORD QUERIES FAILED. The query was one literal string, so
--      "motion gravity" could never be a substring of anything. FIX:
--      tier 4 is now ALL TOKENS PRESENT (see design note 5).
--
--  P4  NO HINGLISH BRIDGE. 48 lesson titles and 33 chapters are Devanagari
--      (कबीर की साखी, मीरा के पद, बड़े भाई साहब, पर्वत प्रदेश में पावस) and a student
--      typing "kabir ki sakhi" got nothing. FIX: every comparison — column AND
--      query — goes through public.search_latin_key(), which transliterates
--      Devanagari to Latin and is the identity transform for Latin input. ONE
--      key therefore serves all four combinations: Latin query/Latin row, Latin
--      query/Devanagari row, Devanagari query/Latin row, Devanagari both.
--
--  ---------------------------------------------------------------------
--  DESIGN NOTES YOU SHOULD READ BEFORE CHANGING ANYTHING HERE
--  ---------------------------------------------------------------------
--
--  1. ALL RANKING AND PAGING HAPPEN HERE, IN THE DATABASE. (unchanged)
--     The browser never receives the catalogue. It sends a query string and
--     receives at most p_limit rows per group plus a total count.
--
--  2. FACULTY IS CAPABILITY-GATED, NOT FAKED. (unchanged, verbatim below)
--     Real faculty identity lives in teachers_v7.sql, which is NOT applied to
--     production, so the faculty branch is reached through dynamic SQL guarded
--     by to_regclass(): where the teacher tables exist there is a real Faculty
--     group; where they do not, the group is ABSENT. It is never synthesised
--     from playlists.teacher. An absent group is honest; a fabricated identity
--     is not. Faculty ranking belongs to search_teachers() and is deliberately
--     NOT touched by this file.
--
--  3. SECURITY INVOKER on purpose. (unchanged)
--     Catalogue rows stay subject to RLS, so this function can never become a
--     way to read something the caller could not already read. That is also why
--     every helper it calls by name must be executable by anon — see GRANTS.
--
--  4. SHORT-QUERY PROTECTION. (unchanged)
--     Under 2 characters nothing is returned at all. Prefix needs 2, the token
--     tier needs 3, fuzzy needs 4. On "ab", trigram matching hits almost every
--     row: it buries the right answer and makes an ambiguous match look
--     decisive. The floor is measured on the SHORTER of the raw normalised query
--     and its Latin key, so a single Devanagari character that transliterates to
--     two Latin letters is still one character and still returns nothing.
--
--  5. RANK ORDER is a single integer so it sorts trivially:
--       1 exact        2 verified alias (faculty only)     3 prefix
--       4 ALL TOKENS PRESENT                               5 guarded fuzzy
--     Tier 4 is the change. For a one-word query it is exactly the old 'partial'
--     tier (needle is a substring of haystack). For "motion gravity" it
--     means every token is a substring — which is why multi-word queries work
--     now. AND-ing tokens can only NARROW a result set, never broaden it, so no
--     per-token length guard is needed; the guard belongs on the whole needle.
--     Tier 4 keeps the label 'partial' and tier 5 keeps 'fuzzy' so the UI is
--     unchanged.
--
--  6. SARGABILITY IS THE WHOLE POINT — DO NOT REINTRODUCE A FUNCTION-RESULT
--     PREDICATE. Each group filters with
--         where  k like '%' || q_longest_token || '%'   -- gin_trgm_ops strategy 2
--            or  k like q || '%'                        -- strategy 2 + btree prefix
--            or  k %> q_long                            -- gin_trgm_ops strategy 7
--     where k is literally  public.search_latin_key(<column>)  and nothing else.
--     The expression is SPELLED OUT at every use instead of being aliased
--     through a CTE or subquery column: an expression index only matches an
--     expression the planner can see verbatim, and an alias is how P1 gets
--     reintroduced by accident.
--
--     WHY PREFILTERING ON THE LONGEST TOKEN IS RECALL-SAFE. Tier 4 requires
--     EVERY token to be a substring of the haystack; the longest token is one of
--     them, so any tier-4 row necessarily contains the longest token and
--     necessarily satisfies the first disjunct. Tier 1 (haystack = needle) and
--     tier 3 (haystack LIKE needle || '%') both contain the whole needle, hence
--     every token, hence the longest one. Tier 5 is caught by the third
--     disjunct, k %> q_long: tier 5 requires EVERY token to clear the
--     word-similarity threshold, and the longest token is one of them, so a
--     tier-5 row always satisfies that disjunct too (it is a superset, not an
--     equality — the disjunct admits rows where only the longest token is
--     similar, which the ranker then discards). So the disjunction is a
--     superset of the true match set for every tier — it can never drop a row
--     search_rank_tokens would have ranked. The second disjunct is redundant for
--     recall and is there for speed: on a 2-character query the substring
--     pattern yields no trigrams, and prefix is then the only reachable tier, so
--     this is the disjunct that keeps the commonest query length off a seq scan.
--
--  7. THE WORD-SIMILARITY THRESHOLD IS SET IN THE FUNCTION, NOT IN THE DATABASE.
--     %> compares against the pg_trgm.word_similarity_threshold GUC, whose
--     default is 0.6. Relying on a per-database GUC means search quality depends
--     on invisible server state: a restored backup, a different Supabase
--     project, or somebody's stray SET and the fuzzy tier silently changes
--     behaviour. So the function calls
--         perform set_config('pg_trgm.word_similarity_threshold', '0.5', true)
--     — transaction-local (the `true`), so it cannot leak into anyone else's
--     session, and PostgREST already gives each request its own transaction.
--     0.5 is the SAME number hardcoded in search_rank_tokens tier 5, so the
--     index prefilter and the tier calculation agree exactly. If you change one,
--     change both, or the prefilter starts dropping rows the ranker would keep.
--
--  8. THE OLD normalize_search_text INDEXES ARE LEFT IN PLACE ON PURPOSE.
--     idx_*_trgm and idx_*_pattern (on public.normalize_search_text(...)) are no
--     longer used by universal_search, but normalize_search_text() itself is
--     still a public, granted function and another consumer may depend on it, so
--     dropping the indexes is a separate decision from this migration. If you
--     later confirm nothing else uses them, they are pure write overhead and can
--     go; the ones this file creates end in _latin_trgm / _latin_pattern.
--
--  9. public.search_rank(text, text) IS KEPT AND UNCHANGED. Other code and the
--     staging test suite reference it. It is simply no longer called from here.
--     Its replacement is public.search_rank_tokens(text, text[], text).
--
--  Apply order: after schema.sql, after search_latin_key, after
--  universal_search.sql / search_hide_empty_chapters.sql. Independent of
--  teachers_v7.sql.
-- =====================================================================


-- ------------------------------------------------------------
-- PREFLIGHT. Fail early and legibly rather than three statements later with
-- "function search_latin_key(text) does not exist" buried in an index build.
-- ------------------------------------------------------------
do $preflight$
declare v_volatile "char";
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'universal_search_v11: pg_trgm extension is not installed.';
  end if;

  if to_regprocedure('public.search_latin_key(text)') is null then
    raise exception
      'universal_search_v11: missing dependency public.search_latin_key(text). Apply the search_latin_key migration first.';
  end if;

  -- An expression index REQUIRES an immutable expression. If search_latin_key
  -- were declared stable, CREATE INDEX below would fail with a much less
  -- helpful message and the real defect (wrong volatility label) would be
  -- hidden.
  select p.provolatile into v_volatile
    from pg_proc p
   where p.oid = to_regprocedure('public.search_latin_key(text)');
  if v_volatile is distinct from 'i' then
    raise exception
      'universal_search_v11: public.search_latin_key(text) must be IMMUTABLE (it is %), otherwise it cannot be indexed.',
      case v_volatile when 's' then 'STABLE' when 'v' then 'VOLATILE' else coalesce(v_volatile::text, 'missing') end;
  end if;
end
$preflight$;


-- ------------------------------------------------------------
-- word_similarity, schema-qualified.
--
-- pg_trgm's schema is not uniform across Supabase projects (extensions here,
-- public there), and universal_search runs with a pinned search_path. Compile
-- one wrapper against the schema pg_trgm actually lives in, exactly as
-- catalog_similarity() already does for similarity().
--
-- This wrapper is used ONLY by search_rank_tokens, for the tier calculation.
-- The sargable predicate in universal_search must use the %> OPERATOR, not this
-- function: a function call is not a member of gin_trgm_ops and would put us
-- straight back into P1.
-- ------------------------------------------------------------
do $install_catalog_word_similarity$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'create or replace function public.catalog_word_similarity(text, text)
       returns real language sql immutable strict set search_path = ''''
       as $fn$ select %I.word_similarity($1, $2) $fn$', v_schema);
end
$install_catalog_word_similarity$;

comment on function public.catalog_word_similarity(text, text) is
  'Schema-stable wrapper for pg_trgm word_similarity(needle, haystack): best-matching word-boundary extent, not whole-string similarity.';


-- ------------------------------------------------------------
-- INDEXES on the Latin key.
--
-- Expression indexes must match the expression used in the query EXACTLY or
-- Postgres will not use them and every search becomes a seq scan again. The
-- expression is public.search_latin_key(<column>) — no cast, no coalesce, no
-- alias — and universal_search spells it out identically.
--
-- The gin_trgm_ops operator class is schema-qualified for the same reason
-- catalog_word_similarity is: pg_trgm may not be in the session search_path
-- when this file is applied. That is the only reason these four are created
-- through dynamic SQL.
--
-- Note 8 applies: the older idx_*_trgm / idx_*_pattern indexes over
-- normalize_search_text() are intentionally NOT dropped.
--
-- These are plain (non-CONCURRENT) builds, so each takes a brief ACCESS
-- EXCLUSIVE lock on its table. That is deliberate: CONCURRENTLY cannot run
-- inside a transaction block, and this migration must be atomic so the
-- self-test at the bottom can roll it back. On this catalogue (hundreds of
-- rows, not millions) the lock is measured in milliseconds. If these tables
-- ever grow to the point where that matters, split the index builds out into
-- their own CONCURRENTLY-per-statement file and apply it BEFORE this one — the
-- eight CREATE INDEX statements here are then no-ops thanks to IF NOT EXISTS.
-- ------------------------------------------------------------
do $install_search_indexes$
declare
  v_schema name;
  r        record;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  for r in
    select * from (values
      ('idx_chapters_name_latin_trgm',   'public.chapters',            'name'),
      ('idx_playlists_title_latin_trgm', 'public.playlists',           'title'),
      ('idx_videos_title_latin_trgm',    'public.videos',              'title'),
      ('idx_institutes_name_latin_trgm', 'public.institutes_channels', 'name')
    ) as t(idx, tbl, col)
  loop
    execute format(
      'create index if not exists %I on %s using gin (public.search_latin_key(%I) %I.gin_trgm_ops)',
      r.idx, r.tbl, r.col, v_schema);
  end loop;
end
$install_search_indexes$;

-- btree text_pattern_ops powers the prefix tier (LIKE 'q%'). text_pattern_ops
-- rather than the default opclass because prefix scanning needs byte ordering,
-- not the database collation. Same expression as the GIN indexes above.
create index if not exists idx_chapters_name_latin_pattern
  on public.chapters (public.search_latin_key(name) text_pattern_ops);
create index if not exists idx_playlists_title_latin_pattern
  on public.playlists (public.search_latin_key(title) text_pattern_ops);
create index if not exists idx_videos_title_latin_pattern
  on public.videos (public.search_latin_key(title) text_pattern_ops);
create index if not exists idx_institutes_name_latin_pattern
  on public.institutes_channels (public.search_latin_key(name) text_pattern_ops);

-- The indexes above are , so on a RE-RUN after any edit to
-- search_latin_key they would survive holding keys computed by the OLD
-- function — searches would then silently miss rows, and the self-tests could
-- not tell, because they call the function directly rather than reading an
-- index. Rebuild unconditionally; at this catalogue size (~2k videos, ~220
-- chapters) it is milliseconds, and the transaction already holds the locks.
do $reindex$
declare r record;
begin
  for r in
    select indexname from pg_indexes
     where schemaname = 'public' and indexname like '%_latin_%'
  loop
    execute format('reindex index public.%I', r.indexname);
  end loop;
end
$reindex$;


-- ------------------------------------------------------------
--  search_rank_tokens — the tier calculation, in one place so the four
--  catalogue groups cannot drift apart. Replaces search_rank(), which stays
--  where it is (design note 9).
--
--    p_haystack  the row's Latin key
--    p_tokens    the query's tokens, in any order
--    p_needle    the whole normalised query (tokens joined by single spaces)
--
--    1  exact                      haystack = needle
--    3  prefix                     needle >= 2 chars, haystack starts with it
--    4  all tokens present         needle >= 3 chars, every token is a substring
--    5  fuzzy                      needle >= 4 chars, word_similarity >= 0.5
--    null  no match
--
--  Tiers 1/3 use LIKE and tier 4 uses position(); both are safe because
--  normalisation has already replaced every punctuation character, so neither
--  the needle nor any token can contain a LIKE wildcard (% or _). position() is
--  used for tokens because it is cheaper and needs no escaping discussion.
--
--  The 0.5 in tier 5 must stay equal to the GUC universal_search sets — see
--  design note 7.
-- ------------------------------------------------------------
create or replace function public.search_rank_tokens(
    p_haystack text,
    p_tokens   text[],
    p_needle   text)
returns int language sql immutable as $$
  select case
    when p_needle is null or p_haystack is null                            then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'         then 3
    -- Tier 4: EVERY token present. This is what makes "motion gravity"
    -- work, and for a single-token query it reduces to the old 'partial' tier.
    when length(p_needle) >= 3
         and p_tokens is not null
         and cardinality(p_tokens) > 0
         and not exists (
               select 1
                 from unnest(p_tokens) as tok
                where tok <> ''
                  and position(tok in p_haystack) = 0
             )                                                            then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded. word_similarity(needle,
    -- haystack) — NOT similarity() — because the haystack is a 90-character
    -- lecture title and whole-string similarity drowns in it (P2).
    -- EVERY token must clear the threshold, not just the needle as a whole.
    -- word_similarity maximises over ONE contiguous extent, so 'class 12' was
    -- satisfied by matching only 'class' and dragged 253 Class-11 lectures in.
    -- group_total is a contract column the UI renders, so this has to be tight.
    when length(p_needle) >= 4
         and not exists (
           select 1 from unnest(p_tokens) as tok
            where tok <> ''
              and public.catalog_word_similarity(tok, p_haystack) < 0.5
         )                                                              then 5
    else null
  end;
$$;

comment on function public.search_rank_tokens(text, text[], text) is
  'Match tier for universal_search: 1 exact, 3 prefix, 4 all tokens present, 5 word-similarity fuzzy, null no match.';


-- ------------------------------------------------------------
--  universal_search
--
--  One round trip. One row per result. group_total lets the UI say
--  "showing 5 of 43" and drive paging without a second count query.
--
--  Signature and returns-table columns are frozen: useUniversalSearch.js reads
--  group_key, entity_id, title, subtitle, aka, slug, match_type, match_rank,
--  matched_on, is_ambiguous, group_total, extra by name.
-- ------------------------------------------------------------
create or replace function public.universal_search(
    p_query  text,
    p_types  text[] default null,   -- null/empty = every group
    p_limit  int     default 5,
    p_offset int     default 0)
returns table (
    group_key    text,      -- faculty | chapter | playlist | lecture | institute
    entity_id    bigint,
    title        text,
    subtitle     text,      -- "Competishun · Physics · JEE"
    aka          text,      -- "ABJ Sir, ABJ"  (faculty only, verified aliases)
    slug         text,
    match_type   text,
    match_rank   int,
    matched_on   text,
    is_ambiguous boolean,
    group_total  bigint,
    extra        jsonb      -- chapter_id etc. for deep links
) language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  -- Two normalisations, on purpose. q is the Latin key and is what everything
  -- is matched on. q_raw exists only to measure the length of what the student
  -- actually typed, so transliteration cannot smuggle a 1-character query past
  -- the floor in design note 4.
  q_raw    text := public.normalize_search_text(p_query);
  q        text := public.search_latin_key(p_query);
  qlen     int  := least(coalesce(length(q_raw), 0), coalesce(length(q), 0));
  q_tokens text[];
  q_long   text;
  lim      int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off      int  := greatest(coalesce(p_offset, 0), 0);
  want     text[] := case when p_types is null or cardinality(p_types) = 0
                          then array['faculty','chapter','playlist','lecture','institute']
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
end; $$;

-- The %> operator lives in pg_trgm's schema, which is 'extensions' on Supabase
-- and 'public' elsewhere, and the function above pins its search_path. plpgsql
-- resolves the SQL inside a function body at first EXECUTION, not at CREATE, so
-- the create above succeeds either way — but the first search would fail with
-- "operator does not exist: text %> text" unless pg_trgm's schema is on the
-- path. Add it, looked up from pg_extension rather than guessed. This must run
-- AFTER the create-or-replace, which resets the setting.
do $pin_search_path$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'alter function public.universal_search(text, text[], int, int) set search_path = public, %I, pg_temp',
    v_schema);
end
$pin_search_path$;

comment on function public.universal_search(text, text[], int, int) is
  'Grouped, server-ranked, paginated search. Sargable trigram predicates, multi-token AND matching, word-similarity typo tolerance, Devanagari/Latin bridge. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters.';


-- ------------------------------------------------------------
-- GRANTS
--
-- Supabase grants EXECUTE on every new public function to anon, authenticated
-- AND service_role by default, so a bare `grant ... to anon` would be a no-op
-- that hides whatever the default already allowed. Revoke first, then grant
-- exactly what is intended.
-- ------------------------------------------------------------
revoke all on function public.universal_search(text, text[], int, int)
  from public, anon, authenticated, service_role;
revoke all on function public.search_rank_tokens(text, text[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.catalog_word_similarity(text, text)
  from public, anon, authenticated, service_role;

-- Public browsing must work without login, so anon executes the search itself.
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;

-- The helpers MUST be granted to anon as well, and this is not optional:
-- universal_search is SECURITY INVOKER, so when a logged-out student calls it
-- the body runs as anon and calls these by name. Revoking them from anon "to
-- keep the API surface small" would make every public search fail with
-- "permission denied for function search_rank_tokens".
--
-- The exposure is nil: both are IMMUTABLE pure text functions that touch no
-- table and can only tell the caller something about a string they already have.
grant execute on function public.search_rank_tokens(text, text[], text)
  to anon, authenticated, service_role;
grant execute on function public.catalog_word_similarity(text, text)
  to anon, authenticated, service_role;

-- Same reasoning for the shared Latin key, which universal_search calls on
-- every row. Revoking/regranting search_latin_key is its own migration's job;
-- this is a one-line re-assert so a missing grant there cannot take public
-- search down. Granting a privilege that is already held is a no-op.
grant execute on function public.search_latin_key(text)
  to anon, authenticated, service_role;

-- normalize_search_text is still called (for the length floor) and was already
-- granted by universal_search.sql; re-asserted here for the same reason.
grant execute on function public.normalize_search_text(text)
  to anon, authenticated, service_role;


-- =====================================================================
--  SELF-TEST — this migration REFUSES TO APPLY if search is still broken.
--
--  Every assertion runs the real RPC against the real catalogue. Nothing here
--  hardcodes an id: assertions are on counts and on title CONTENT, and each
--  data-dependent case is guarded by a check that the catalogue can actually
--  answer it — a test that passes because a table is empty proves nothing, so
--  those cases SKIP LOUDLY (raise notice) instead of passing quietly.
--
--  What is deliberately NOT asserted: the query plan. On a catalogue of a few
--  hundred rows a seq scan is genuinely cheaper and the planner is right to
--  choose one, so an "index must be used" assertion here would fail for the
--  wrong reason. Sargability is a property of the PREDICATE, and the predicate
--  is reviewable by reading it. Check plans with EXPLAIN on a database with
--  production-sized data, not from a migration.
-- =====================================================================
do $selftest$
declare
  v_lectures bigint;
  v_n        bigint;
  v_rows     bigint;
  v_hits     bigint;
  v_page     int;
  v_title    text;
  v_key      text;
  v_tokens   text[];
  v_word     text;
  v_typo     text;
  v_query    text;
  v_bad      text;
  v_cases    jsonb := '[]'::jsonb;
  v_case     record;
begin
  select count(*) into v_lectures from public.videos;
  raise notice 'SELF-TEST: universal_search v11 against % lecture rows', v_lectures;

  -- ---------------------------------------------------------------- (d)
  -- SHORT-QUERY PROTECTION. Runs everywhere, needs no data. If this ever
  -- returns rows, the floor in design note 4 has been lost and every search box
  -- keystroke now dumps the top of the alphabet at a student.
  select count(*) into v_n from public.universal_search('a', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the 1-character query "a" returned % rows; the <2 character guard is gone', v_n;
  end if;
  select count(*) into v_n from public.universal_search('!', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the punctuation-only query "!" returned % rows', v_n;
  end if;
  select count(*) into v_n from public.universal_search('', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the empty query returned % rows', v_n;
  end if;

  -- ---------------------------------------------------------------- contract
  -- The four match_type strings UniversalSearch.jsx knows about. A fifth value
  -- would render as an unlabelled row rather than an error, so assert it here.
  -- Faculty is excluded on purpose: its labels come from search_teachers(),
  -- which owns tier 2 ('alias') and is not this migration's contract.
  select string_agg(distinct r.match_type, ', ') into v_bad
    from public.universal_search('motion', array['chapter','playlist','lecture','institute'], 50, 0) r
   where r.match_type not in ('exact','prefix','partial','fuzzy');
  if v_bad is not null then
    raise exception 'SELF-TEST FAILED: universal_search emitted match_type(s) the UI cannot render: %', v_bad;
  end if;

  -- ---------------------------------------------------------------- (c)
  -- The tier that already worked must keep working: an exact/prefix hit on a
  -- chapter name. Guarded on the chapter existing AND having lessons, because
  -- the chapter group hides content-less chapters by design.
  if exists (select 1 from public.chapters ch
              where public.search_latin_key(ch.name) like 'kinematics%'
                and exists (select 1 from public.videos v where v.chapter_id = ch.id)) then
    select count(*) into v_n
      from public.universal_search('kinematics', array['chapter'], 20, 0) r
     where public.search_latin_key(r.title) like 'kinematics%'
       and r.match_type in ('exact','prefix');
    if v_n = 0 then
      raise exception 'SELF-TEST FAILED (c): "kinematics" no longer returns the Kinematics chapter as an exact/prefix match';
    end if;
  else
    raise notice 'SELF-TEST SKIPPED (c): no chapter named Kinematics* with lessons mapped to it';
  end if;

  -- ---------------------------------------------------------------- (b)
  -- MULTI-TOKEN (P3). Two words that appear in one title but never adjacently
  -- could not match before, because the query was one literal string.
  --
  -- No paging needed: tiers 1/3/4 all sort ahead of tier 5, and every row in
  -- tiers 1/3/4 contains the whole query, so if any exist at all they are on
  -- the first page.
  if exists (select 1 from public.videos v
              where public.search_latin_key(v.title) like '%motion%'
                and public.search_latin_key(v.title) like '%gravity%') then
    select count(*) into v_n
      from public.universal_search('motion gravity', array['lecture'], 50, 0) r
     where public.search_latin_key(r.title) like '%motion%'
       and public.search_latin_key(r.title) like '%gravity%';
    if v_n = 0 then
      raise exception 'SELF-TEST FAILED (b): "motion gravity" matched no lecture containing both words — multi-token search is broken';
    end if;
  else
    raise notice 'SELF-TEST SKIPPED (b, literal): no lecture title contains both "motion" and "gravity"';
  end if;

  -- (b2) The same property, DERIVED from a real title so it cannot rot when the
  -- catalogue changes. Take the two longest words of some lecture title, search
  -- for them as a two-word query, and require at least one row that contains
  -- both AND is labelled by a token tier rather than fuzzy.
  select t.title, t.toks into v_title, v_tokens
    from (
      select v.id, v.title,
             (select array_agg(x order by length(x) desc, x)
                from (select distinct tok
                        from unnest(string_to_array(public.search_latin_key(v.title), ' ')) as tok
                       where length(tok) >= 4) d(x)) as toks
        from public.videos v
    ) t
   where cardinality(t.toks) >= 2
   order by length(t.title), t.id
   limit 1;

  if v_title is null then
    raise notice 'SELF-TEST SKIPPED (b2): no lecture title has two distinct words of 4+ characters';
  else
    v_query := v_tokens[1] || ' ' || v_tokens[2];
    select count(*) into v_n
      from public.universal_search(v_query, array['lecture'], 50, 0) r
     where position(v_tokens[1] in public.search_latin_key(r.title)) > 0
       and position(v_tokens[2] in public.search_latin_key(r.title)) > 0
       and r.match_type in ('exact','prefix','partial');
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (b2): the two-word query %L (built from the real lecture %L) matched no lecture containing both words',
        v_query, v_title;
    end if;
  end if;

  -- ---------------------------------------------------------------- (a)
  -- TYPO TOLERANCE (P2) — the case that returns NOTHING today.
  --
  -- Two cases, both collected first and then run through the same paged loop:
  --   a1  the literal "projctile motin", guarded on a Projectile lecture existing
  --   a2  a real 10+ character word from the catalogue with one interior letter
  --       deleted, guarded so the corrupted form is NOT a literal substring of
  --       any title — otherwise the substring tier would answer it and the test
  --       would prove nothing about fuzzy matching.
  if exists (select 1 from public.videos v
              where public.search_latin_key(v.title) like '%projectile%') then
    v_cases := v_cases || jsonb_build_array(jsonb_build_object(
      'q', 'projctile motin', 'needle', 'projectile',
      'label', '(a1) the classic typo "projctile motin" must still find a Projectile lecture'));
  else
    raise notice 'SELF-TEST SKIPPED (a1): this database has no lecture title containing "projectile"';
  end if;

  select d.tok into v_word
    from (select distinct tok
            from public.videos v,
                 unnest(string_to_array(public.search_latin_key(v.title), ' ')) as tok
           where length(tok) >= 10
             and tok ~ '^[a-z]+$') d
   order by length(d.tok) desc, d.tok
   limit 1;

  if v_word is null then
    raise notice 'SELF-TEST SKIPPED (a2): no lecture title contains a 10+ letter word to corrupt';
  else
    -- drop the middle character: 'thermodynamics' -> 'thermdynamics'
    v_typo := overlay(v_word placing '' from (length(v_word) / 2) for 1);
    if exists (select 1 from public.videos v
                where public.search_latin_key(v.title) like '%' || v_typo || '%') then
      raise notice
        'SELF-TEST SKIPPED (a2): the corrupted form %L occurs literally in the catalogue, so it would not exercise the fuzzy tier', v_typo;
    else
      v_cases := v_cases || jsonb_build_array(jsonb_build_object(
        'q', v_typo, 'needle', v_word,
        'label', format('(a2) one-deletion typo %L must still find the lecture containing %L', v_typo, v_word)));
    end if;
  end if;

  for v_case in select value as c from jsonb_array_elements(v_cases) loop
    -- Every hit here is tier 5, and tier 5 sorts LAST, so the target can sit
    -- past the first page. Walk pages until found or exhausted (cap 5 x 50).
    v_hits := 0;
    v_page := 0;
    loop
      select count(*),
             count(*) filter (
               where public.search_latin_key(r.title) like '%' || (v_case.c ->> 'needle') || '%')
        into v_rows, v_n
        from public.universal_search(v_case.c ->> 'q', array['lecture'], 50, v_page * 50) r;
      v_hits := v_hits + v_n;
      exit when v_hits > 0 or v_rows < 50 or v_page >= 4;
      v_page := v_page + 1;
    end loop;
    if v_hits = 0 then
      raise exception 'SELF-TEST FAILED (a): % — typo tolerance is not working; word_similarity is not reaching the 0.5 threshold', (v_case.c ->> 'label');
    end if;
  end loop;

  -- ---------------------------------------------------------------- (e)
  -- HINGLISH BRIDGE (P4). Derived, not hardcoded: ask search_latin_key what a
  -- real Devanagari lecture title transliterates to and search for THAT. This
  -- tests the bridge without this file knowing (or caring about) the
  -- transliteration scheme, which belongs to search_latin_key.
  --
  -- The FULL key is used as the query rather than one word of it, so the target
  -- lands in a token tier (1/3/4) and sorts ahead of every fuzzy row — no
  -- paging, no flakiness.
  select v.title, public.search_latin_key(v.title)
    into v_title, v_key
    from public.videos v
   where v.title ~ '[ऀ-ॿ]'
   order by length(v.title), v.id
   limit 1;

  if v_title is null then
    raise notice 'SELF-TEST SKIPPED (e): no Devanagari lecture titles in this database';
  else
    select count(*) into v_n
      from public.universal_search(v_key, array['lecture'], 50, 0) r
     where r.title = v_title;
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (e): the Devanagari lecture %L is not reachable by its own Latin key %L — the Hinglish bridge is broken',
        v_title, v_key;
    end if;

    -- Not fatal, but worth knowing: searching for a row's own key should be an
    -- EXACT match. Anything else means search_latin_key is not idempotent, and
    -- idempotence is what lets one key serve a Latin query against a
    -- Devanagari row.
    if not exists (select 1
                     from public.universal_search(v_key, array['lecture'], 50, 0) r
                    where r.title = v_title and r.match_type = 'exact') then
      raise notice
        'SELF-TEST WARNING (e): %L matched its own Latin key %L but NOT as an exact match — search_latin_key may not be idempotent',
        v_title, v_key;
    end if;

    -- And the reverse must not have regressed: a student typing Devanagari.
    select count(*) into v_n
      from public.universal_search(v_title, array['lecture'], 5, 0) r
     where r.title = v_title;
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (e2): the Devanagari lecture %L cannot be found by typing its own title', v_title;
    end if;
  end if;

  raise notice 'SELF-TEST PASSED: universal_search v11 is sargable, multi-token, typo-tolerant and Devanagari-aware.';
end
$selftest$;
