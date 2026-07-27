-- =====================================================================
--  search_hide_empty_chapters.sql
--
--  Fix: the chapter group of universal_search returned EVERY chapter row,
--  including chapters that have no content yet. The parked NEET chapters
--  (Biology etc., created as reference data but with zero courses) therefore
--  surfaced as search suggestions and dead-ended on "No courses match this
--  view." Add a content guard so a chapter is only suggested when at least
--  one video is mapped to it.
--
--  Scope: redefines ONLY public.universal_search (CREATE OR REPLACE — additive,
--  no data change, instantly revertible). All helper functions, indexes and the
--  other four search groups are byte-identical to universal_search.sql; the ONLY
--  change is the one `where exists (...)` line in the chapter block, marked below.
--
--  Rollback: re-run src/migrations/universal_search.sql (restores the original
--  function definition).
--
--  Depends on (already present in production): normalize_search_text,
--  search_rank, catalog_similarity, and the trgm indexes.
-- =====================================================================

create or replace function public.universal_search(
    p_query  text,
    p_types  text[] default null,   -- null/empty = every group
    p_limit  int     default 5,
    p_offset int     default 0)
returns table (
    group_key    text,
    entity_id    bigint,
    title        text,
    subtitle     text,
    aka          text,
    slug         text,
    match_type   text,
    match_rank   int,
    matched_on   text,
    is_ambiguous boolean,
    group_total  bigint,
    extra        jsonb
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
  if qlen < 2 then
    return;
  end if;

  ---------------------------------------------------------------- faculty
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
             nullif(concat_ws(' · ', nullif(c.institutes,''), nullif(c.subjects,''),
                                     nullif(c.goals,'')), ''),
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
       -- CONTENT GUARD (the only change vs universal_search.sql): never suggest
       -- a chapter that has no lessons mapped to it, so parked/empty chapters
       -- cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'chapter'::text, c.id, c.name, c.subject, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('chapter_id', c.id)
      from counted c
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
  'Grouped, server-ranked, paginated search. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters.';

-- Re-assert grants (CREATE OR REPLACE preserves them; this is belt-and-braces
-- and matches universal_search.sql exactly).
revoke all on function public.universal_search(text, text[], int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;
