-- =====================================================================
--  universal_search.sql — one search box across the whole library
--
--  Groups: faculty · chapters · playlists · lectures · institutes
--
--  DESIGN NOTES YOU SHOULD READ BEFORE CHANGING ANYTHING HERE
--
--  1. ALL RANKING AND PAGING HAPPEN HERE, IN THE DATABASE.
--     The browser never receives the catalogue. It sends a query string and
--     receives at most p_limit rows per group plus a total count. That is
--     requirement 4, and it is also the only version that stays fast when the
--     library is 50k lectures instead of 40.
--
--  2. FACULTY IS CAPABILITY-GATED, NOT FAKED.
--     Real faculty identity — aliases, verified status, ambiguity — lives in
--     teachers_v7.sql, which is NOT applied to production. So the faculty
--     branch below is reached through dynamic SQL guarded by to_regclass():
--       * where the teacher tables exist  -> a real Faculty group
--       * where they do not               -> the group is ABSENT
--     It is never synthesised from playlists.teacher, which is free text that
--     has never been reviewed and cannot distinguish two people with the same
--     name. An absent group is honest; a fabricated identity is not.
--     This is what lets universal search ship while v7 stays isolated.
--
--  3. SECURITY INVOKER on purpose.
--     Catalogue rows stay subject to RLS, so this function can never become a
--     way to read something the caller could not already read. The faculty
--     branch delegates to search_teachers(), which is SECURITY DEFINER and
--     hardcodes include_unverified => false. Students therefore see VERIFIED
--     aliases only (requirement 10); the admin candidate search is a different
--     function with different grants and is not reachable from here.
--
--  4. SHORT-QUERY PROTECTION (requirement 6).
--     Under 2 characters nothing is returned at all. Prefix needs 2, partial
--     needs 3, fuzzy needs 4. On "ab", trigram similarity matches almost every
--     name in the table: it buries the right answer and, worse, makes an
--     ambiguous match look decisive.
--
--  5. RANK ORDER (requirement 5) is a single integer so it sorts trivially:
--       1 exact        2 verified alias      3 prefix
--       4 partial      5 guarded fuzzy
--     Tier 2 only ever occurs for faculty — nothing else has aliases.
--
--  Apply order: after schema.sql. Independent of teachers_v7.sql.
-- =====================================================================

create extension if not exists pg_trgm;

-- pg_trgm's schema is not uniform across Supabase projects. Compile one
-- schema-qualified wrapper instead of relying on the runtime search_path.
do $install_catalog_similarity$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if v_schema is null then raise exception 'pg_trgm extension is not installed'; end if;
  execute format(
    'create or replace function public.catalog_similarity(text, text)
       returns real language sql immutable strict set search_path = ''''
       as $fn$ select %I.similarity($1, $2) $fn$', v_schema);
end
$install_catalog_similarity$;

-- ------------------------------------------------------------
-- Normalisation for NON-PERSON text.
--
-- Deliberately NOT normalize_person_name(): that function strips honorifics
-- (sir/dr/ji/...), which is right for a human name and wrong for everything
-- else — it would quietly turn the chapter "Semiconductor" into something it
-- is not the moment a token happened to collide. Replace punctuation and
-- whitespace rather than "non-alphanumeric" characters: Indic vowel marks
-- are combining characters and are not classified as [:alnum:].
-- ------------------------------------------------------------
create or replace function public.normalize_search_text(p_text text)
returns text language sql immutable as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[''’`´]', '', 'g'),
          '[[:punct:][:space:]]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;

comment on function public.normalize_search_text(text) is
  'Case/punctuation-insensitive comparison key for non-person text. Unicode-safe.';

-- ------------------------------------------------------------
-- Indexes. Expression indexes must match the expression used in the query
-- EXACTLY or Postgres will not use them and every search becomes a seq scan.
-- ------------------------------------------------------------
create index if not exists idx_chapters_name_trgm
  on public.chapters using gin (public.normalize_search_text(name) gin_trgm_ops);
create index if not exists idx_playlists_title_trgm
  on public.playlists using gin (public.normalize_search_text(title) gin_trgm_ops);
create index if not exists idx_videos_title_trgm
  on public.videos using gin (public.normalize_search_text(title) gin_trgm_ops);
create index if not exists idx_institutes_name_trgm
  on public.institutes_channels using gin (public.normalize_search_text(name) gin_trgm_ops);

-- text_pattern_ops powers the prefix (LIKE 'q%') tier.
create index if not exists idx_chapters_name_pattern
  on public.chapters (public.normalize_search_text(name) text_pattern_ops);
create index if not exists idx_playlists_title_pattern
  on public.playlists (public.normalize_search_text(title) text_pattern_ops);
create index if not exists idx_videos_title_pattern
  on public.videos (public.normalize_search_text(title) text_pattern_ops);

-- ------------------------------------------------------------
-- The tier calculation, in one place so the five groups cannot drift apart.
--   returns NULL when the candidate does not match at all
-- ------------------------------------------------------------
create or replace function public.search_rank(p_haystack text, p_needle text)
returns int language sql immutable as $$
  select case
    when p_needle is null or p_haystack is null then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'        then 3
    when length(p_needle) >= 3 and p_haystack like '%' || p_needle || '%' then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded.
    when length(p_needle) >= 4 and public.catalog_similarity(p_haystack, p_needle) >= 0.4 then 5
    else null
  end;
$$;

-- ------------------------------------------------------------
--  universal_search
--
--  One round trip. One row per result. group_total lets the UI say
--  "showing 5 of 43" and drive paging without a second count query.
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
  q       text := public.normalize_search_text(p_query);
  qlen    int  := coalesce(length(q), 0);
  lim     int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off     int  := greatest(coalesce(p_offset, 0), 0);
  want    text[] := case when p_types is null or cardinality(p_types) = 0
                         then array['faculty','chapter','playlist','lecture','institute']
                         else p_types end;
begin
  -- Requirement 6. One character is not a query; returning the top of the
  -- alphabet for "a" trains students to ignore the suggestions entirely.
  if qlen < 2 then
    return;
  end if;

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7.
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
             -- people with the same name distinguishable (requirement 2).
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
             public.search_rank(public.normalize_search_text(ch.name), q) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
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
             public.search_rank(public.normalize_search_text(pl.title), q) as rk,
             nullif(concat_ws(' · ', nullif(pl.teacher,''), ic.name, s.name), '') as ctx,
             -- first chapter this playlist teaches, so the result deep-links
             -- to a watchable page rather than a dead end
             (select v.chapter_id
                from public.playlist_videos pv
                join public.videos v on v.id = pv.video_id
               where pv.playlist_id = pl.id and v.chapter_id is not null
               order by pv.position limit 1) as chapter_id
        from public.playlists pl
        left join public.institutes_channels ic on ic.id = pl.channel_id
        left join public.subjects s on s.id = pl.subject_id
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
             public.search_rank(public.normalize_search_text(v.title), q) as rk,
             nullif(concat_ws(' · ', ch.name, s.name), '') as ctx,
             v.chapter_id, v.subject_id
        from public.videos v
        left join public.chapters ch on ch.id = v.chapter_id
        left join public.subjects s  on s.id = v.subject_id
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'lecture'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object('chapter_id', c.chapter_id, 'subject_id', c.subject_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- institutes
  if 'institute' = any(want) then
    return query
    with m as (
      select ic.id, ic.name,
             public.search_rank(public.normalize_search_text(ic.name), q) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
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

comment on function public.universal_search(text, text[], int, int) is
  'Grouped, server-ranked, paginated search. Faculty group appears only where teachers_v7 is installed.';

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
revoke all on function public.normalize_search_text(text)
  from public, anon, authenticated, service_role;
revoke all on function public.search_rank(text, text)
  from public, anon, authenticated, service_role;

-- Public browsing must work without login, so anon executes the search itself.
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;

-- The helpers MUST be granted to anon as well, and this is not optional:
-- universal_search is SECURITY INVOKER, so when a logged-out student calls it
-- the body runs as anon and calls these two by name. Revoking them from anon
-- "to keep the API surface small" would make every public search fail with
-- "permission denied for function normalize_search_text" — the same shape of
-- bug the v5 review found in the public teacher-search wrapper.
--
-- The exposure is nil: both are IMMUTABLE pure text functions that touch no
-- table and can only tell the caller something about a string they already
-- have.
grant execute on function public.normalize_search_text(text)
  to anon, authenticated, service_role;
grant execute on function public.search_rank(text, text)
  to anon, authenticated, service_role;
