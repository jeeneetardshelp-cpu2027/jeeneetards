-- ============================================================
-- BROWSE SEARCH v1 - PRODUCTION ROLLBACK
-- Restores the pre-apply state: browse_facet_counts back to the v13 body
-- (title ILIKE search), then drops the three new search functions.
--
-- Order matters: restore browse_facet_counts FIRST so it no longer references
-- search_playlist_ids, then the drops are dependency-free.
--
-- Non-destructive to data. create-or-replace + drop function only; no locks.
-- The frontend degrades gracefully once search_playlist_ids/search_video_ids
-- are gone (isMissingCatalogRpc -> old title ILIKE), so /browse search keeps
-- working through the rollback -- exactly as it does today, pre-apply.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing (not the production project)';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
end
$target_guard$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- 1. Restore browse_facet_counts to the exact live v13 body (ok_search = title
--    ILIKE). Byte-identical to
--    production/chapter_class_scopes_v13_production/production_apply.sql's
--    definition; only the ok_search line differs from the applied version.
create or replace function public.browse_facet_counts(
    p_goal text default null,
    p_class text default null,
    p_subject text default null,
    p_chapter text default null,
    p_channel bigint default null,
    p_language text[] default null,
    p_type text[] default null,
    p_difficulty text[] default null,
    p_search text default null)
returns table (facet text, value text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with class_options(value, slugs) as (
    values
      ('class-10'::text, array['class-10']::text[]),
      ('class-11'::text, array['class-11']::text[]),
      ('class-12'::text, array['class-12']::text[]),
      ('dropper'::text, array['dropper','class-11','class-12']::text[])
  ), base as (
    select
      pl.id,
      pl.language,
      pl.content_type,
      pl.difficulty,
      pl.channel_id,
      (p_goal is null or exists (
        select 1
        from public.playlist_learning_goals g
        join public.learning_goals lg on lg.id = g.learning_goal_id
        where g.playlist_id = pl.id and lg.slug = p_goal
      )) as ok_goal,
      case
        when p_class is null then true
        when p_chapter is not null then exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = pl.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, pl.id, p_class)
        )
        else exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      end as ok_class,
      (p_subject is null or exists (
        select 1 from public.subjects s
        where s.id = pl.subject_id and s.slug = p_subject
      )) as ok_subject,
      (p_chapter is null or exists (
        select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.chapters c on c.id = v.chapter_id
        where pv.playlist_id = pl.id and c.slug = p_chapter
      )) as ok_chapter,
      (p_channel is null or pl.channel_id = p_channel) as ok_channel,
      (p_language is null or pl.language = any(p_language)) as ok_language,
      (p_type is null or pl.content_type = any(p_type)) as ok_type,
      (p_difficulty is null or pl.difficulty = any(p_difficulty)) as ok_difficulty,
      (p_search is null or btrim(p_search) = '' or pl.title ilike '%' || btrim(p_search) || '%') as ok_search
    from public.playlists pl
  ), facets as (
    select 'goal'::text as facet, lg.slug as value, count(distinct b.id)::bigint as n
    from base b
    join public.playlist_learning_goals g on g.playlist_id = b.id
    join public.learning_goals lg on lg.id = g.learning_goal_id
    where b.ok_class and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by lg.slug

    union all

    select 'class', co.value, count(distinct b.id)::bigint
    from base b
    cross join class_options co
    where b.ok_goal and b.ok_subject and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and (
        (p_chapter is null and exists (
          select 1
          from public.playlist_class_levels j
          join public.class_levels cl on cl.id = j.class_level_id
          where j.playlist_id = b.id and cl.slug = any(co.slugs)
        ))
        or
        (p_chapter is not null and exists (
          select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
          join public.chapters c on c.id = v.chapter_id
          where pv.playlist_id = b.id
            and c.slug = p_chapter
            and public.chapter_matches_class_scope(c.id, b.id, co.value)
        ))
      )
    group by co.value

    union all

    select 'subject', s.slug, count(distinct b.id)::bigint
    from base b
    join public.playlists pl on pl.id = b.id
    join public.subjects s on s.id = pl.subject_id
    where b.ok_goal and b.ok_class and b.ok_chapter and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by s.slug

    union all

    select 'chapter', c.slug, count(distinct b.id)::bigint
    from base b
    join public.playlist_videos pv on pv.playlist_id = b.id
    join public.videos v on v.id = pv.video_id
    join public.chapters c on c.id = v.chapter_id
    where b.ok_goal and b.ok_subject and b.ok_channel
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
      and public.chapter_matches_class_scope(c.id, b.id, p_class)
    group by c.slug

    union all

    select 'language', b.language, count(distinct b.id)::bigint
    from base b
    where b.language is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.language

    union all

    select 'type', b.content_type, count(distinct b.id)::bigint
    from base b
    where b.content_type is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_difficulty and b.ok_search
    group by b.content_type

    union all

    select 'difficulty', b.difficulty, count(distinct b.id)::bigint
    from base b
    where b.difficulty is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_channel and b.ok_language and b.ok_type and b.ok_search
    group by b.difficulty

    union all

    select 'channel', b.channel_id::text, count(distinct b.id)::bigint
    from base b
    where b.channel_id is not null
      and b.ok_goal and b.ok_class and b.ok_subject and b.ok_chapter
      and b.ok_language and b.ok_type and b.ok_difficulty and b.ok_search
    group by b.channel_id
  )
  select f.facet, f.value, f.n
  from facets f
  where f.n > 0
  order by f.facet, f.value;
$$;

revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;

-- 2. Now the search functions are dependency-free -> drop them.
drop function if exists public.search_video_ids(text);
drop function if exists public.search_playlist_ids(text);
drop function if exists public.search_query_tokens(text);

commit;

select 'BROWSE SEARCH v1 ROLLBACK VERIFIED' as result,
  to_regprocedure('public.search_playlist_ids(text)') is null as search_ids_removed,
  pg_get_functiondef(
    to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')::oid)
    not like '%search_playlist_ids%' as facet_counts_restored;
