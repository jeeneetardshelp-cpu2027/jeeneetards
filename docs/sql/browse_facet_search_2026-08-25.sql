-- browse_facet_search_2026-08-25.sql
--
-- Follow-up to browse_search_2026-08-25.sql. That migration made the /browse
-- RESULT list match with the homepage engine (search_playlist_ids /
-- search_video_ids). This one does the same for the filter SIDEBAR COUNTS.
--
-- browse_facet_counts computed each facet's count with a single-column
-- `pl.title ilike '%p_search%'`, exactly the matcher the list just stopped
-- using. Left alone, a search like "friction problems" would show real results
-- in the list but 0 next to every filter (or an empty sidebar), because no
-- course TITLE contains that literal phrase. The frontend currently hides the
-- counts during a search to avoid that contradiction; this migration lets them
-- come back, correct.
--
-- WHAT CHANGES: exactly one line. `ok_search` now tests membership in
-- search_playlist_ids(p_search) instead of an ILIKE, so the counts are computed
-- over the SAME course set the list shows. Everything else in this function is
-- reproduced VERBATIM from the live definition
-- (production/chapter_class_scopes_v13_production/production_apply.sql) so the
-- reviewed chapter-class-scope semantics it added on top of v9 are preserved --
-- re-emitting from the older catalog_navigation_v9.sql would have reverted them.
--
-- DEPENDENCY: search_playlist_ids must already exist -- run
-- browse_search_2026-08-25.sql FIRST. The self-test at the bottom fails loudly
-- if it is missing.
--
-- NOTE ON NON-SEARCH BROWSING: with no search term, `ok_search` is
-- `p_search is null or btrim(p_search) = '' or ...`; the first disjunct
-- short-circuits, so counts with no search are byte-for-byte the old behaviour.
-- Only an active search takes the new path.
--
-- Safe to re-run. Self-verifying at the bottom.

begin;

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
      -- CHANGED: match with the homepage engine, not a single-column ILIKE, so
      -- these counts agree with the /browse result list (search_playlist_ids,
      -- browse_search_2026-08-25.sql). Uncorrelated subquery -> evaluated once.
      (p_search is null or btrim(p_search) = ''
         or pl.id in (select sid.id from public.search_playlist_ids(btrim(p_search)) sid)) as ok_search
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

comment on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text) is
  'Contextual counts using reviewed canonical chapter classes and unchanged course-level Dropper semantics. Search matches via search_playlist_ids (the homepage engine), so counts agree with the /browse result list.';

revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;

commit;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION -- outside the transaction so a failure is loud without
-- rolling back a correct deploy.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_search_hits int;
  v_facet_hits  int;
  v_empty_hits  int;
begin
  -- Dependency: the list matcher must be installed first.
  if to_regprocedure('public.search_playlist_ids(text)') is null then
    raise exception 'search_playlist_ids(text) is missing -- run browse_search_2026-08-25.sql FIRST';
  end if;

  -- A search that matches courses must now produce facet counts (the old ILIKE
  -- body returned 0 rows for this query -- that is the whole bug being fixed).
  select count(*) into v_search_hits from public.search_playlist_ids('friction problems');
  select count(*) into v_facet_hits
    from public.browse_facet_counts(null, null, null, null, null, null, null, null, 'friction problems')
   where n > 0;
  if v_search_hits > 0 and v_facet_hits = 0 then
    raise exception 'search matched % courses but facet counts came back empty -- ok_search is not using search_playlist_ids', v_search_hits;
  end if;

  -- A search that matches nothing must yield no facet rows (all ok_search false),
  -- not the whole catalogue.
  select count(*) into v_empty_hits
    from public.browse_facet_counts(null, null, null, null, null, null, null, null, 'zzzznotathingxyz');
  if v_empty_hits <> 0 then
    raise exception 'a no-match search returned % facet rows -- ok_search is not filtering', v_empty_hits;
  end if;

  -- No-search counts must still return the catalogue's facets (unchanged path).
  select count(*) into v_facet_hits
    from public.browse_facet_counts(null, null, null, null, null, null, null, null, null);
  if v_facet_hits = 0 then
    raise exception 'no-search facet counts are empty -- the unchanged path regressed';
  end if;

  raise notice 'SELF-TEST PASSED: facet counts match via search_playlist_ids; matching search yields counts, no-match yields none, no-search unchanged.';
end
$verify$;
