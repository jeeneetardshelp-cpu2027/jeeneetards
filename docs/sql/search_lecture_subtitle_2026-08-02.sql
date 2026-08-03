-- search_lecture_subtitle_2026-08-02.sql
--
-- Makes duplicate-looking lecture rows tellable apart in search results.
--
-- THE PROBLEM (audit, 2 August 2026): a lecture result's subtitle was
-- "chapter · subject". Measured against live production, that leaves 76 groups
-- covering 206 videos rendering as byte-identical rows -- same title AND same
-- subtitle -- so a student cannot tell which is which:
--   * 68 groups WITHIN one institute, e.g. ALLEN NEET teaches "Biological
--     Classification Part 1" in four different course series (Bio-Fest, the
--     Bridge Course, NCERT Decode, ...), each a genuinely different video;
--   * 8 groups ACROSS institutes, e.g. "Definite Integration — Lecture 1"
--     exists from both Mohit Tyagi and Competishun+, and "Constraint Motion"
--     from both JEE Wallah and Mohit Tyagi.
-- Every row still LINKED correctly -- this is a readability defect, not a
-- routing one -- but four identical rows is a bad answer to a search.
--
-- THE FIX: append the course title to the lecture subtitle. That disambiguates
-- all 76 groups, because in every one the colliding videos sit in different
-- courses. The subquery deliberately mirrors the existing playlist_id subquery
-- (same table, same order by, same limit) so the course NAMED in the subtitle
-- is always the course the row actually opens.
--
-- Scope: ONLY the lecture branch's ctx expression changes. The function below
-- is reproduced verbatim from src/migrations/universal_search_v11.sql --
-- extracted programmatically, not retyped -- with that one expression replaced.
-- Ranking, matching, tokenisation, the Devanagari bridge and every other branch
-- are untouched.
--
-- Guarded: refuses to run if the live definition is not the v11 one this was
-- built against, rather than silently overwriting a newer search function.
-- Idempotent; safe to re-run.

begin;

do $guard$
declare
  v_def text;
begin
  select pg_get_functiondef('public.universal_search(text, text[], integer, integer)'::regprocedure) into v_def;

  if position('join public.playlists p on p.id = pv.playlist_id' in v_def) > 0 then
    raise notice 'universal_search already carries the course title in the lecture subtitle -- nothing to change (safe re-run)';
  elsif position('nullif(concat_ws(' || quote_literal(' · ') || ', ch.name, s.name)' in v_def) = 0 then
    raise exception
      'live universal_search does not contain the expected lecture subtitle expression -- production has drifted from universal_search_v11.sql, refusing to overwrite it. Reconcile by hand.';
  end if;
end
$guard$;

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
             -- Course title included so two different lessons that share a
             -- title and chapter are still tellable apart in results. Without
             -- it, 76 groups covering 206 videos rendered as byte-identical
             -- rows -- e.g. ALLEN NEET teaches "Biological Classification
             -- Part 1" in four separate course series, and two institutes both
             -- have a "Definite Integration — Lecture 1". Same subquery shape
             -- and ordering as playlist_id below, so both resolve to the SAME
             -- course the row links to.
             nullif(concat_ws(' · ', ch.name, s.name,
                    (select p.title
                       from public.playlist_videos pv
                       join public.playlists p on p.id = pv.playlist_id
                      where pv.video_id = v.id
                      order by pv.playlist_id
                      limit 1)), '') as ctx,
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

-- Re-pin pg_trgm's schema. The create-or-replace above RESETS the function's
-- search_path setting, and plpgsql resolves the SQL in a body at first
-- EXECUTION -- so without this the create succeeds and the first search then
-- fails with "operator does not exist: text %> text". Reproduced verbatim from
-- universal_search_v11.sql, which is why it must run after, not before.
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

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_def text;
  v_rows int;
  v_distinct int;
begin
  select pg_get_functiondef('public.universal_search(text, text[], integer, integer)'::regprocedure) into v_def;
  if position('join public.playlists p on p.id = pv.playlist_id' in v_def) = 0 then
    raise exception 'the lecture subtitle change did not take';
  end if;

  -- The real goal: the previously-colliding rows must now be distinguishable.
  select count(*), count(distinct (r.title, r.subtitle))
    into v_rows, v_distinct
    from public.universal_search('Definite Integration', array['lecture'], 50, 0) r;

  if v_rows = 0 then
    raise exception 'search returned no lecture rows for a known-good query -- the function is broken';
  end if;
  if v_distinct <> v_rows then
    raise exception '% lecture row(s) still share a title+subtitle out of %', v_rows - v_distinct, v_rows;
  end if;

  raise notice 'SELF-TEST PASSED: lecture subtitles now carry the course title; % rows for the probe query, all distinguishable.', v_rows;
end
$verify$;

commit;
