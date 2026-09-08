-- universal_search: scan on TWO needles when the query has two, not one.
--
-- STAGED, NOT APPLIED. Nothing here has run against production.
--
-- THE DEFECT. The prefilter in all six pillars scans on a single needle,
-- q_long. When the best needle a query offers is three characters that is
-- barely a filter, and the cost lands on the 3.2s statement timeout. Measured
-- on production 2026-09-08, serial with gaps so the probe did not create the
-- load it was measuring, 4-5 runs each:
--
--   query                 anchor      median   rows
--   "definite integral"   definite     720ms     57    selective needle
--   "def int"             def         1750ms     58    same rows, 2.4x the cost
--   "int def"             def          930ms     58    + 2 of 5 runs 500 57014
--   "ktg emi"             emi         1960ms      0    two seconds for nothing
--   "and c"               and         2400ms    204
--
-- "def int" and "definite integral" return the SAME 57-58 rows. The only
-- difference is how selective the one needle is. This is not about query
-- length, token count or word order: word order was measured across five
-- reversed pairs and is worth 0.4% to 9%, which is noise.
--
-- THE CHANGE. When a query has a second content token, scan on that too. For
-- "def int" the candidate set becomes titles matching BOTH "def" and "int"
-- rather than either, which is what a trigram index is good at.
--
-- WHY IT IS LOSSLESS, which is the only reason it is safe to do at all.
-- search_rank_tokens returns non-null on four tiers, and every one of them
-- already requires this token to be present:
--
--   tier 1  haystack = the whole needle           -> contains every token
--   tier 3  haystack starts with the needle       -> contains every token
--   tier 4  EVERY token, as substring or singular
--   tier 5  EVERY token at word_similarity >= 0.5
--
-- The four disjuncts added to each gate are exactly tiers 4 and 5 for this one
-- token. %> IS that 0.5 test rather than an approximation of it:
-- catalog_word_similarity is pg_trgm word_similarity, and THIS FUNCTION sets
-- pg_trgm.word_similarity_threshold to 0.5 itself, transaction-locally, before
-- the first %> runs (design note 7, carried forward below). So no row the
-- ranker would have kept can fail the new conjunct. All four disjuncts are
-- gin_trgm_ops members applied to the indexed expression verbatim, so the
-- planner can intersect two bitmap index scans instead of widening one.
--
-- That distinction is load-bearing and easy to get wrong. set_config(..., true)
-- is local to this function's own execution: the SESSION default is 0.6, which
-- is STRICTER than tier 5. A draft of the self-test below read the threshold
-- with current_setting() from a DO block outside the function, saw 0.6, and
-- refused this migration as unsound. It was the check that was wrong, not the
-- migration -- but had the body ever stopped setting 0.5, the conjunct really
-- would drop tier-5 rows, so the check now asserts that line is still there.
--
-- WHAT IT DELIBERATELY DOES NOT DO. It does not fire when an alias expanded the
-- query. search_rank_aliased takes the BETTER of the typed and expanded ranks,
-- so a row can survive on alias tokens alone while matching no typed token at
-- all; requiring a second TYPED token would drop exactly those rows. Aliased
-- queries keep today's single-anchor plan, and an alias has usually made them
-- selective already.
--
-- HOW THIS BODY WAS PRODUCED. Extracted from
-- 20260907170000_universal_search_anchor_floor.sql, the newest applied emitter,
-- and transformed programmatically: 0 lines removed, 81 added. The diff is pure
-- insertion, so the anchor floor, the q_long length floor, the alias pass, the
-- material pillars and the kind-word haystack are carried forward character for
-- character rather than retyped.
--
-- WHAT IS NOT KNOWN. The losslessness argument above is a proof about the
-- tiers, not a measurement, and
-- src/universalSearchSecondAnchorSqlRehearsal.test.js is what turns it into
-- evidence: it runs the old and new bodies side by side on a real engine and
-- asserts identical rows. The SPEED-UP is not established here at all, because
-- the plan depends on production statistics this repo cannot see. Measure after
-- applying, and revert if it does not pay.

do $preflight$
declare
  deployed text;
begin
  if to_regprocedure('public.universal_search(text,text[],integer,integer)') is null then
    raise exception 'REFUSING: universal_search does not exist; this migration re-emits it and must not create it from nothing';
  end if;
  if to_regprocedure('public.search_singular(text)') is null then
    raise exception 'REFUSING: search_singular() is missing, and the new conjunct calls it';
  end if;
  if to_regprocedure('public.search_anchor(text,text,text)') is null then
    raise exception 'REFUSING: search_anchor() is missing, so the ancestor body this re-emission was built on is not applied';
  end if;

  -- Built on the anchor floor. If production is on an older body, the carry
  -- forward is not what this file assumes and re-emitting would revert work.
  select p.prosrc into deployed
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'universal_search'
     and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_types text[], p_limit integer, p_offset integer';
  if position('search_anchor' in deployed) = 0 then
    raise exception 'REFUSING: the deployed universal_search does not carry the anchor decision; re-emitting on top of it would silently revert 20260907170000';
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
  -- THE SECOND ANCHOR. Null unless this query has a second content token
  -- and no alias fired; see the block that fills it for why both apply.
  q_long2  text;
  q_sing2  text;
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
  -- WHY NOT search_is_servable, which the two browse RPCs use. Since
  -- 20260907160000_browse_servable_floor_correction that rule is
  -- length(q_long) >= 3, and a length rule cannot tell "the" (685 titles,
  -- answers) from "and" (1328, cancelled). "p and c" anchors on "and", clears
  -- the rule, and still times out. Refusing on the shape of the token list
  -- cannot separate a needle that scans from one that does not.
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

  -- THE SECOND ANCHOR, and the whole point of this migration.
  --
  -- The prefilter below scans on ONE needle. For a query whose best needle
  -- is three characters that is barely a filter at all: measured on
  -- production 2026-09-08, "def int" (anchor "def") takes ~1.75s and tips
  -- past the 3.2s statement timeout under load, while "definite integral"
  -- (anchor "definite") answers the same 57 rows in ~0.72s. The cost is
  -- anchor SELECTIVITY, not query length, and one short needle cannot be
  -- made selective. A second needle can: scanning candidates that match
  -- BOTH "def" and "int" is a far smaller set than either alone.
  --
  -- WHY THIS IS LOSSLESS, which is the only reason it is safe to do.
  -- search_rank_tokens returns non-null on exactly four tiers, and every
  -- one of them already requires this token to be present:
  --   tier 1  haystack = the whole needle      -> contains every token
  --   tier 3  haystack starts with the needle  -> contains every token
  --   tier 4  EVERY token, as substring or singular
  --   tier 5  EVERY token at word_similarity >= 0.5
  -- The four disjuncts added to each gate are precisely tiers 4 and 5 for
  -- this one token, and %> is exactly the 0.5 test because
  -- pg_trgm.word_similarity_threshold is set to 0.5 by this function's
  -- callers. So no row that the ranker would have kept can fail the new
  -- conjunct, and all four disjuncts are gin_trgm_ops members, so the
  -- planner can intersect two bitmap index scans instead of scanning one
  -- wide one.
  --
  -- ONLY WHEN NO ALIAS FIRED. search_rank_aliased takes the BETTER of the
  -- typed and expanded ranks, so a row can survive on alias tokens alone
  -- while matching no typed token at all. Requiring a second TYPED token
  -- would drop exactly those rows. Aliased queries therefore keep the
  -- single-anchor plan they have today; they are also the queries an alias
  -- has already made selective.
  if q_alias_needle is not distinct from q then
    select tok into q_long2
      from unnest(q_tokens) as tok
     where tok <> '' and tok is distinct from q_long
     order by length(tok) desc, tok
     limit 1;
  end if;
  q_sing2 := public.search_singular(q_long2);

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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.search_latin_key(ch.name) like '%' || q_long2 || '%'
                or public.search_latin_key(ch.name) like '%' || q_sing2 || '%'
                or public.search_latin_key(ch.name) %> q_long2
                or public.search_latin_key(ch.name) %> q_sing2 )
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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.search_latin_key(pl.title) like '%' || q_long2 || '%'
                or public.search_latin_key(pl.title) like '%' || q_sing2 || '%'
                or public.search_latin_key(pl.title) %> q_long2
                or public.search_latin_key(pl.title) %> q_sing2 )
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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.search_latin_key(v.title) like '%' || q_long2 || '%'
                or public.search_latin_key(v.title) like '%' || q_sing2 || '%'
                or public.search_latin_key(v.title) %> q_long2
                or public.search_latin_key(v.title) %> q_sing2 )
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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.search_latin_key(ic.name) like '%' || q_long2 || '%'
                or public.search_latin_key(ic.name) like '%' || q_sing2 || '%'
                or public.search_latin_key(ic.name) %> q_long2
                or public.search_latin_key(ic.name) %> q_sing2 )
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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_long2 || '%'
                or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_sing2 || '%'
                or public.study_material_haystack(sm.title, sm.material_type) %> q_long2
                or public.study_material_haystack(sm.title, sm.material_type) %> q_sing2 )
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
           -- SECOND ANCHOR (lossless; see the block that fills q_long2).
           and (   q_long2 is null
                or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_long2 || '%'
                or public.study_material_haystack(sm.title, sm.material_type) like '%' || q_sing2 || '%'
                or public.study_material_haystack(sm.title, sm.material_type) %> q_long2
                or public.study_material_haystack(sm.title, sm.material_type) %> q_sing2 )
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
-- Grants re-stated: a from-scratch replay must not depend on CREATE OR REPLACE
-- inheriting the existing ACL. Same set as the baseline.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Behaviour and shape, not just a marker: a body that kept
-- the comment and lost the conjunct would pass a grep and fail here.
-- ---------------------------------------------------------------------
do $verify$
declare
  src    text;
  v_fail text[] := array[]::text[];
  n_gate integer;
begin
  select p.prosrc into src
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'universal_search'
     and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_types text[], p_limit integer, p_offset integer';

  -- CARRY-OVER. Every feature that existed before this re-emission. Dropping
  -- one of these silently is the failure mode this repo has already hit.
  if position('search_rank_aliased' in src) = 0 then
    v_fail := v_fail || 'the curated shorthand alias pass was dropped by this re-emission'::text;
  end if;
  if position('study_material_haystack' in src) = 0 then
    v_fail := v_fail || 'the material kind-word haystack was dropped by this re-emission'::text;
  end if;
  if position('max(length(tok))' in src) = 0 then
    v_fail := v_fail || 'the q_long length floor was dropped by this re-emission'::text;
  end if;
  if position('search_anchor' in src) = 0 then
    v_fail := v_fail || 'the anchor decision was dropped by this re-emission'::text;
  end if;

  -- THE CHANGE, in all six pillars. COUNTED, not merely present: a body that
  -- patched one gate and missed five would pass a position() check and leave
  -- five pillars scanning as wide as before.
  select count(*) into n_gate
    from regexp_matches(src, 'q_sing2 \)', 'g');
  if n_gate <> 6 then
    v_fail := v_fail || format('the second-anchor conjunct closes %s gates, not the six this body has', n_gate)::text;
  end if;

  -- THE ALIAS GUARD. Without it the conjunct drops rows that matched on alias
  -- tokens alone, which is a silent loss of results rather than a slow query.
  if position('if q_alias_needle is not distinct from q then' in src) = 0 then
    v_fail := v_fail || 'the second anchor is not gated on the alias pass having done nothing; aliased queries would lose rows'::text;
  end if;

  -- LAWS on pure functions, so they assert the same thing here, on staging and
  -- in a rehearsal, whatever the catalogue happens to hold.
  if public.search_singular('notes') is null then
    v_fail := v_fail || 'search_singular returned null, so the singular disjuncts would be dead weight'::text;
  end if;

  -- The losslessness proof rests on %> being exactly tier 5, which is true only
  -- because the body sets the threshold to 0.5 itself. Read that from the
  -- SOURCE, not from current_setting() out here: set_config(..., true) is
  -- transaction-local to the function's own execution, so a DO block outside it
  -- sees the session default of 0.6 and would refuse a migration that is
  -- correct. An earlier draft of this check did exactly that, and this
  -- rehearsal caught it.
  --
  -- If that line is ever dropped, %> becomes STRICTER than the ranker and the
  -- new conjunct starts silently dropping tier-5 rows the ranker would keep.
  if position('set_config(''pg_trgm.word_similarity_threshold'', ''0.5'', true)' in src) = 0 then
    v_fail := v_fail || 'the body no longer sets word_similarity_threshold to 0.5, so %> is stricter than tier 5 and the second anchor is not lossless'::text;
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'SECOND ANCHOR SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'SECOND ANCHOR APPLIED: a multi-token query with no alias now prefilters on its two longest content tokens instead of one. Lossless by tiers 4 and 5; anchor floor, alias pass, material pillars and kind-word haystack all carried forward.';
end
$verify$;
