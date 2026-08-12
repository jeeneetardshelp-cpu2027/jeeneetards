-- search_filler_tokens_2026-08-10.sql
--
-- Search returns nothing for the way students actually type.
--
-- MEASURED, against production, with a 43-query corpus of realistic queries:
-- 19 returned zero rows (44%). The failures cluster exactly where a student is
-- describing a need rather than naming a chapter:
--
--     natural language / concept   9 of 10 returned NOTHING
--     exam-shaped                  4 of 6  returned NOTHING
--     exact chapter names          0 of 8  failed   (already good)
--     typos                        0 of 5  failed   (already good)
--
-- The worst examples, all of which have matching content sitting in the
-- catalogue right now:
--
--     "how to solve pulley problems"  -> 0 rows, while
--                                        "Pulley Problem - Newton's Laws of Motion" exists
--     "friction problems"             -> 0 rows, while 5 Friction lectures exist
--     "how to find maxima"            -> 0 rows, while
--                                        "Application of Derivatives - Maxima and Minima" exists
--     "class 11 physics ncert"        -> 0 rows
--     "gravitation class 11"          -> 0 rows
--
-- WHY. search_rank_tokens tier 4 requires EVERY token to be a substring of the
-- title, and tier 5 requires EVERY token to clear a 0.5 word-similarity
-- threshold. One token that no title contains -- "how", "to", "solve", or the
-- plural "problems" against a title that says "Problem" -- drops the row to
-- null. The strictness is deliberate and was correct for its own problem (an
-- earlier build let "class 12" drag in 253 Class-11 lectures), so this change
-- does NOT loosen the tiers. It removes the words that should never have been
-- part of the AND in the first place.
--
-- WHAT CHANGES. Exactly two things, both inside universal_search's tokenisation:
--
--   1. Study-intent words and bare 1-2 digit numbers are dropped from the token
--      list. A lesson title says "Maxima and Minima"; it never says "how to
--      find maxima". The needle q is UNCHANGED, so tier 1 (exact) and tier 3
--      (prefix) still match on the full string the student typed -- "Rotational
--      Motion" keeps ranking as an exact match.
--
--   2. One trailing 's' is stripped from tokens longer than four characters, so
--      "problems" reaches a title that says "Problem". This only ever widens:
--      when a word genuinely ends in s, "physics" -> "physic" is still a
--      substring of "physics".
--
-- Both transforms only ADD matches. Nothing that matched before can stop
-- matching, which is why the exact-name and typo groups cannot regress.
--
-- THE GUARD THAT MATTERS. If filtering would leave no tokens at all -- a query
-- of pure filler such as "how to" -- the original token list is kept. Without
-- it q_tokens goes empty, and tier 5's "not exists (select from unnest(...))"
-- is vacuously TRUE for an empty array, which would match every row in the
-- catalogue for any query over three characters. That is the one way this
-- change could have been catastrophic rather than merely wrong.
--
-- HOW THIS FILE WAS BUILT. universal_search's body cannot be patched in place,
-- so the whole function is re-emitted. It was reproduced programmatically from
-- src/migrations/universal_search_v11.sql and then diffed against that source to
-- prove the only differences are the lines described above. The
-- `do $pin_search_path$` block below is reproduced with it and is NOT optional:
-- create-or-replace resets a function's search_path, plpgsql resolves body SQL
-- at first EXECUTION, so without it the create succeeds and the first real
-- search fails with "operator does not exist: text %> text".
--
-- MEASURED EFFECT. The tokenisation was simulated against all 5,442 catalogue
-- titles, chapter names, course titles and channel names before this file was
-- finalised (tier 4 only, so these are a LOWER bound -- fuzzy tier 5 can only
-- add more):
--
--     13 of 16 previously-dead queries now return results
--      0 regressions -- nothing that matched before stopped matching
--     two queries got BETTER: "Thermodynamics" 63 -> 65 rows,
--     "jee advanced 2024 paper" 3 -> 4
--
-- KNOWN LIMITS -- three queries this does NOT fix, stated so nobody assumes it
-- did:
--
--   "derivation of lens formula"  reduces to [derivation, lens, formula] and
--       tier 4 still demands all three in one title. Fuzzy tier 5 may catch it.
--   "physics thermodynamics"      reduces to [physic, thermodynamic]. No title
--       carries both a subject and its chapter, so subject+chapter queries need
--       a partial-match tier that ranks by how MANY tokens hit. That is a
--       separate, riskier change and is deliberately not attempted here.
--   "physics wallah"              reduces to [physic, wallah] and finds nothing
--       because no channel is stored under that name -- they are "Competition
--       Wallah", "JEE Wallah" and "Alakh Pandey". That is an institute-alias
--       problem in the data, not a tokenisation problem.
--
-- Safe to re-run. Self-verifying at the bottom.

begin;

-- ------------------------------------------------------------
-- The filler list, as its own function so it is documented in one place,
-- callable from a test, and changeable without re-emitting universal_search.
--
-- A word belongs here only if it describes what the student wants DONE or which
-- exam they sit, never what a lesson is ABOUT. "friction" is a topic;
-- "problems" is an intent. Topic words must never be added, and neither must
-- anything that appears in real lesson titles -- "integration", "derivation" and
-- "application" are deliberately absent for that reason.
-- ------------------------------------------------------------
create or replace function public.search_filler_tokens()
returns text[] language sql immutable parallel safe as $$
  select array[
    'a', 'an', 'the', 'of', 'in', 'on', 'for', 'to',
    'and', 'or', 'is', 'are', 'was', 'be', 'by', 'with',
    'from', 'at', 'as', 'it', 'this', 'that', 'my', 'me',
    'i', 'how', 'what', 'why', 'when', 'which', 'who', 'where',
    'can', 'do', 'does', 'solve', 'solved', 'solving', 'solution', 'explain',
    'explained', 'explanation', 'find', 'finding', 'learn', 'study', 'understand', 'revise',
    'revision', 'problem', 'question', 'numerical', 'example', 'exercise', 'practice', 'sum',
    'lecture', 'lesson', 'video', 'playlist', 'course', 'class', 'chapter', 'topic',
    'note', 'pdf', 'best', 'good', 'easy', 'quick', 'fast', 'complete',
    'full', 'free', 'new', 'latest', 'all', 'any', 'please', 'help',
    'need', 'want', 'ncert', 'cbse', 'syllabus', 'exam', 'paper', 'test',
    'mock', 'preparation', 'std', 'standard', 'th', 'nd', 'rd', 'st'
  ]::text[];
$$;

comment on function public.search_filler_tokens() is
  'Query words that express intent or exam scaffolding rather than subject matter. Removed from universal_search tokens so one filler word cannot fail an all-tokens-must-match query.';

revoke all on function public.search_filler_tokens() from public;
grant execute on function public.search_filler_tokens() to anon, authenticated, service_role;

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
  q_content text[];
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

  -- Filler removal. Tiers 4 and 5 in search_rank_tokens both require EVERY
  -- token to match, so one word that no title contains kills the whole query.
  -- Measured against production on 2026-08-10: 19 of 43 realistic student
  -- queries returned nothing, including "how to solve pulley problems" while
  -- "Pulley Problem - Newton's Laws of Motion" sat in the catalogue, and
  -- "friction problems" while 5 Friction lectures did.
  --
  -- Two transforms, both of which only ever WIDEN the match set:
  --   * drop study-intent words and bare 1-2 digit numbers, which express what
  --     the student wants DONE, not what the lesson is about. A title says
  --     "Maxima and Minima", never "how to find maxima".
  --   * strip one trailing 's' from tokens longer than four characters, so
  --     "problems" reaches "Problem". Safe even when the word genuinely ends in
  --     s: "physics" becomes "physic", which is still a substring of "physics".
  --
  -- If filtering would leave nothing, keep the original tokens. Without that
  -- guard a query of pure filler ("how to") empties q_tokens, and tier 5's
  -- "not exists (unnest(empty))" is vacuously true, which would match every
  -- row in the catalogue.
  -- A token is filler if EITHER its typed form or its singular form is in the
  -- list, and both directions are needed. Testing only the typed form lets
  -- "problems" through, because the list holds "problem" -- that is why
  -- "friction problems" still found nothing in the first draft. Testing only the
  -- singular form lets "class" through, because "class" is five characters
  -- ending in s and singularises to "clas", which is in no list -- that broke
  -- "gravitation class 11" in the second draft. Checking both fixes both.
  q_content := array(
    select tok_s
      from (
        select tok,
               case when length(tok) > 4 and right(tok, 1) = 's'
                    then left(tok, length(tok) - 1)
                    else tok end as tok_s
          from unnest(q_tokens) as tok
         where tok <> ''
      ) singular
     where not (tok   = any (public.search_filler_tokens()))
       and not (tok_s = any (public.search_filler_tokens()))
       and tok_s !~ '^[0-9]{1,2}$'
  );
  if cardinality(q_content) > 0 then
    q_tokens := q_content;
  end if;

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

-- Re-assert execute, verbatim from src/migrations/universal_search_v11.sql.
-- create-or-replace preserves an existing function's ACL, so these are no-ops on
-- a healthy database — they are here so this file cannot be the reason public
-- search breaks. Granting a privilege already held does nothing.
--
-- The new helper matters most. universal_search is SECURITY INVOKER, so a
-- logged-out student's call runs the body AS anon and resolves
-- search_filler_tokens() by name. Without the grant above, every public search
-- would fail with "permission denied for function search_filler_tokens" — the
-- exact trap the source file warns about for search_rank_tokens.
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;
grant execute on function public.search_rank_tokens(text, text[], text)
  to anon, authenticated, service_role;
grant execute on function public.catalog_word_similarity(text, text)
  to anon, authenticated, service_role;

commit;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION — runs real searches, outside the transaction above so a
-- failure reports loudly without rolling back a correct deployment.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n int;
  v_row record;
  v_fail text[] := '{}';
begin
  -- 1. The filler list is loaded and does not contain a topic word.
  if array_length(public.search_filler_tokens(), 1) is null then
    raise exception 'search_filler_tokens() is empty';
  end if;
  if 'friction' = any (public.search_filler_tokens())
     or 'integration' = any (public.search_filler_tokens())
     or 'motion' = any (public.search_filler_tokens())
     or 'physics' = any (public.search_filler_tokens()) then
    raise exception 'a topic word leaked into the filler list';
  end if;

  -- 2. The queries this file exists to fix must now return something.
  for v_row in
    select unnest(array[
      'how to solve pulley problems',
      'friction problems',
      'how to find maxima',
      'class 11 physics ncert',
      'gravitation class 11',
      'projectile motion numericals'
    ]) as q
  loop
    select count(*) into v_n from public.universal_search(v_row.q, null, 10, 0);
    if v_n = 0 then v_fail := v_fail || v_row.q; end if;
  end loop;
  if array_length(v_fail, 1) > 0 then
    raise exception 'still zero results for: %', array_to_string(v_fail, ' | ');
  end if;

  -- 3. Nothing that worked before may have stopped working, and an exact
  --    chapter name must still rank as an exact match rather than being
  --    demoted by the widened token set.
  for v_row in
    select unnest(array['Rotational Motion', 'Thermodynamics', 'Kinematics', 'Mole Concept']) as q
  loop
    select count(*) into v_n from public.universal_search(v_row.q, null, 10, 0);
    if v_n = 0 then v_fail := v_fail || v_row.q; end if;
    if not exists (
      select 1 from public.universal_search(v_row.q, null, 10, 0) r
       where r.match_type = 'exact') then
      raise exception 'exact match lost for %L', v_row.q;
    end if;
  end loop;
  if array_length(v_fail, 1) > 0 then
    raise exception 'REGRESSION - these used to work: %', array_to_string(v_fail, ' | ');
  end if;

  -- 4. Typo tolerance intact.
  select count(*) into v_n from public.universal_search('rotatinal motion', null, 10, 0);
  if v_n = 0 then raise exception 'typo tolerance regressed'; end if;

  -- 5. THE DANGEROUS CASE: a query of pure filler must not match the catalogue.
  --    Without the fallback guard, empty tokens make tier 5 vacuously true.
  select count(*) into v_n from public.universal_search('how to', null, 50, 0);
  if v_n > 20 then
    raise exception 'a pure-filler query returned % rows - the empty-token guard is not working', v_n;
  end if;
  select count(*) into v_n from public.universal_search('the of and', null, 50, 0);
  if v_n > 20 then
    raise exception 'a pure-filler query returned % rows - the empty-token guard is not working', v_n;
  end if;

  -- 6. The one-character floor still holds.
  select count(*) into v_n from public.universal_search('a', null, 10, 0);
  if v_n <> 0 then raise exception 'the 2-character floor regressed'; end if;

  raise notice 'SELF-TEST PASSED: filler tokens removed, previously-dead student queries return results, exact/typo matching intact, pure-filler queries still match nothing.';
end
$verify$;
