-- ============================================================
-- CHAPTER CLASS SCOPES v13 - PRODUCTION APPLY
-- PRODUCTION PROJECT kezelafqhgqrprpadmlf ONLY.
-- OWNER-APPROVED AFTER PITR RESTORE POINT 02 Aug 2026, 00:07:09 UTC+05:30.
-- DERIVED FROM REHEARSED SHA-256 3a36b1f0681ce8c2ba181a042e6d68086009c00bdcf1d7db5a7f80b00dc7f28f.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
  if to_regclass('public.chapter_scope_v13_clone_authorization') is not null then
    raise exception 'REFUSING: restore-clone authorization marker exists';
  end if;
  if md5(pg_get_functiondef(to_regprocedure('public.get_browse_curriculum(text,text,text)')::oid)) <>
       'b71d62cc849eec7a72d1607ce205186e'
     or md5(pg_get_functiondef(to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')::oid)) <>
       '48f982ef788b570def824aa770ae892b' then
    raise exception 'REFUSING: pre-v13 browse function definition drift';
  end if;
  if (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('public.get_browse_curriculum(text,text,text)')) <>
       '37a7ab878ddb3c8de2877e90e7224b7e'
     or (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')) <>
       '37a7ab878ddb3c8de2877e90e7224b7e' then
    raise exception 'REFUSING: pre-v13 browse function grant drift';
  end if;
end
$target_guard$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $baseline_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is not null then
    raise exception 'REFUSING: chapter_class_levels already exists';
  end if;
  if to_regprocedure('public.get_browse_curriculum(text,text,text)') is null
     or to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is null then
    raise exception 'REFUSING: expected browse functions are missing';
  end if;
  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.subjects) <> 9
     or (select count(*) from public.class_levels) <> 4 then
    raise exception 'REFUSING: clone catalogue differs from the reviewed snapshot';
  end if;
  select * into v_protected from (
select
  (select count(*)
     from public.playlists p
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_courses,
  (select count(*)
     from public.playlist_videos pv
     join public.playlists p on p.id = pv.playlist_id
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_memberships,
  md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
       where p.id < 167 and exists (
         select 1
           from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
       )
    ) y), '')
  ) as protected_fingerprint) protected;
  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1350
     or v_protected.protected_fingerprint <> '6829fcb6eae22479db7b82b7b3da654d' then
    raise exception 'REFUSING: protected original-83 JEE baseline differs';
  end if;
end
$baseline_guard$;

-- SOURCE 1: src/migrations/chapter_class_scopes_v13_draft.sql
-- SHA-256: 89e2de12ccfd3916403ca093a6f6af4a248aac1631ad0fef66c25d9becd5b2a9
-- =====================================================================
-- chapter_class_scopes_v13_draft.sql
-- PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.
--
-- This first gate creates the canonical chapter -> academic class junction
-- and seeds only five evidence-reviewed JEE Physics mappings. It deliberately
-- does NOT replace get_browse_curriculum or browse_facet_counts yet. The read
-- functions belong in a separately rehearsed second gate after these rows are
-- reviewed on an isolated clone.
-- =====================================================================



create table if not exists public.chapter_class_levels (
  chapter_id bigint not null references public.chapters(id) on delete cascade,
  class_level_id bigint not null references public.class_levels(id) on delete cascade,
  source_url text not null,
  scope_note text not null,
  reviewed_on date not null,
  created_at timestamptz not null default now(),
  primary key (chapter_id, class_level_id)
);

comment on table public.chapter_class_levels is
  'Canonical academic class membership for chapters. Course audience tags must not determine this.';

alter table public.chapter_class_levels enable row level security;
create policy "public read canonical chapter classes"
  on public.chapter_class_levels for select using (true);
revoke all on table public.chapter_class_levels from public, anon, authenticated;
grant select on table public.chapter_class_levels to anon, authenticated;

with reviewed(subject_slug, chapter_slug, class_slug, source_url, scope_note) as (
  values
    ('physics', 'kinematics', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Umbrella for Class XI motion in a straight line and motion in a plane'),
    ('physics', 'newtons-laws-of-motion-nlm', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XI Laws of Motion'),
    ('physics', 'work-energy-and-power', 'class-11',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XI Work, Energy and Power'),
    ('physics', 'ray-optics-and-optical-instruments', 'class-12',
      'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf',
      'Class XII Ray Optics and Optical Instruments'),
    ('physics', 'modern-physics', 'class-12',
      'https://ncert.nic.in/textbook/pdf/leph2ps.pdf',
      'Umbrella for Class XII dual nature, atoms, nuclei and semiconductor content')
)
insert into public.chapter_class_levels (
  chapter_id, class_level_id, source_url, scope_note, reviewed_on
)
select ch.id, cl.id, reviewed.source_url, reviewed.scope_note, date '2026-08-01'
from reviewed
join public.subjects s on s.slug = reviewed.subject_slug
join public.chapters ch on ch.subject_id = s.id and ch.slug = reviewed.chapter_slug
join public.class_levels cl on cl.slug = reviewed.class_slug
on conflict (chapter_id, class_level_id) do nothing;

do $postflight$
declare
  v_reviewed_count integer;
begin
  select count(*) into v_reviewed_count
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  where ch.slug in (
    'kinematics', 'newtons-laws-of-motion-nlm', 'work-energy-and-power',
    'ray-optics-and-optical-instruments', 'modern-physics'
  );

  if v_reviewed_count <> 5 then
    raise exception 'POSTFLIGHT: expected five reviewed chapter/class rows, got %', v_reviewed_count;
  end if;

  if exists (
    select 1
    from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
    where cl.slug = 'dropper'
  ) then
    raise exception 'POSTFLIGHT: Dropper is a target cohort, not a canonical chapter class';
  end if;
end
$postflight$;

-- SOURCE 2: src/migrations/chapter_class_scopes_v13_browse_draft.sql
-- SHA-256: c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315
-- =====================================================================
-- chapter_class_scopes_v13_browse_draft.sql
-- PREPARED FOR CLONE REVIEW. NOT APPROVED OR APPLIED ANYWHERE.
--
-- Requires chapter_class_scopes_v13_draft.sql (with its review guard removed
-- in a separately approved clone package). Reviewed chapter/class rows are
-- canonical. Chapters without reviewed rows retain the current playlist-
-- class fallback. Dropper remains the existing course-audience superset in
-- this narrow correction; separating target cohort is a later migration.
-- =====================================================================



-- One shared predicate keeps curriculum and facet counts on the same rule.
-- For reviewed academic chapters the playlist's broad audience labels cannot
-- reclassify the chapter. Unreviewed chapters continue to use those labels.
create or replace function public.chapter_matches_class_scope(
    p_chapter_id bigint,
    p_playlist_id bigint,
    p_class text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_class is null then true
    when p_class = 'dropper' then exists (
      select 1
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p_playlist_id
        and cl.slug = any(array['dropper','class-11','class-12']::text[])
    )
    when exists (
      select 1
      from public.chapter_class_levels reviewed
      where reviewed.chapter_id = p_chapter_id
    ) then exists (
      select 1
      from public.chapter_class_levels reviewed
      join public.class_levels cl on cl.id = reviewed.class_level_id
      where reviewed.chapter_id = p_chapter_id
        and cl.slug = p_class
    )
    else exists (
      select 1
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p_playlist_id
        and cl.slug = p_class
    )
  end;
$$;

comment on function public.chapter_matches_class_scope(bigint, bigint, text) is
  'Canonical chapter/class predicate with playlist fallback for unreviewed chapters and unchanged Dropper audience semantics.';

revoke all on function public.chapter_matches_class_scope(bigint, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.chapter_matches_class_scope(bigint, bigint, text)
  to anon, authenticated, service_role;

create or replace function public.get_browse_curriculum(
    p_goal text default null,
    p_class text default null,
    p_subject text default null)
returns table (
    level text,
    entity_id bigint,
    slug text,
    name text,
    display_order integer,
    course_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with rows as (
    select
      'goal'::text as level,
      lg.id as entity_id,
      lg.slug,
      lg.name,
      lg.display_order,
      count(distinct plg.playlist_id)::bigint as course_count
    from public.learning_goals lg
    left join public.playlist_learning_goals plg
      on plg.learning_goal_id = lg.id
    where p_goal is null and p_subject is null
    group by lg.id, lg.slug, lg.name, lg.display_order

    union all

    -- Subject availability remains course-scoped because no chapter has been
    -- selected yet.
    select
      'subject'::text,
      s.id,
      s.slug,
      s.name,
      s.display_order,
      count(distinct pl.id)::bigint
    from public.subjects s
    join public.playlists pl on pl.subject_id = s.id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is null
      and lg.slug = p_goal
      and (
        p_class is null or exists (
          select 1
          from public.playlist_class_levels pcl
          join public.class_levels cl on cl.id = pcl.class_level_id
          where pcl.playlist_id = pl.id
            and cl.slug = any(
              case
                when p_class = 'dropper' then array['dropper','class-11','class-12']::text[]
                else array[p_class]::text[]
              end
            )
        )
      )
    group by s.id, s.slug, s.name, s.display_order

    union all

    select
      'chapter'::text,
      ch.id,
      ch.slug,
      ch.name,
      ch.display_order,
      count(distinct pl.id)::bigint
    from public.chapters ch
    join public.subjects s on s.id = ch.subject_id
    join public.videos v on v.chapter_id = ch.id
    join public.playlist_videos pv on pv.video_id = v.id
    join public.playlists pl on pl.id = pv.playlist_id
    join public.playlist_learning_goals plg on plg.playlist_id = pl.id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where p_goal is not null
      and p_subject is not null
      and lg.slug = p_goal
      and s.slug = p_subject
      and public.chapter_matches_class_scope(ch.id, pl.id, p_class)
    group by ch.id, ch.slug, ch.name, ch.display_order
  )
  select r.level, r.entity_id, r.slug, r.name, r.display_order, r.course_count
  from rows r
  order by r.display_order, r.name, r.entity_id;
$$;

comment on function public.get_browse_curriculum(text, text, text) is
  'Bounded navigation using reviewed canonical chapter classes, with playlist fallback only for unreviewed chapters.';

revoke all on function public.get_browse_curriculum(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_browse_curriculum(text, text, text)
  to anon, authenticated, service_role;

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

comment on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text) is
  'Contextual counts using reviewed canonical chapter classes and unchanged course-level Dropper semantics.';

revoke all on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text)
  to anon, authenticated, service_role;

-- Clone postflight: the five reviewed mappings must control both navigation
-- and the chapter facet. Unreviewed chapters are exercised separately by the
-- clone rehearsal evidence package.
do $postflight$
begin
  if exists (
    select 1 from public.get_browse_curriculum('jee', 'class-11', 'physics')
    where slug in ('ray-optics-and-optical-instruments', 'modern-physics')
  ) then
    raise exception 'POSTFLIGHT: Class 11 still exposes reviewed Class 12 Physics chapters';
  end if;

  if exists (
    select 1 from public.get_browse_curriculum('jee', 'class-12', 'physics')
    where slug in ('kinematics', 'newtons-laws-of-motion-nlm', 'work-energy-and-power')
  ) then
    raise exception 'POSTFLIGHT: Class 12 still exposes reviewed Class 11 Physics chapters';
  end if;

  if 2 <> (
    select count(*) from public.get_browse_curriculum('jee', 'class-12', 'physics')
    where slug in ('ray-optics-and-optical-instruments', 'modern-physics')
  ) then
    raise exception 'POSTFLIGHT: both reviewed Class 12 Physics chapters must remain visible';
  end if;

  if 3 <> (
    select count(*) from public.get_browse_curriculum('jee', 'class-11', 'physics')
    where slug in ('kinematics', 'newtons-laws-of-motion-nlm', 'work-energy-and-power')
  ) then
    raise exception 'POSTFLIGHT: all reviewed Class 11 Physics chapters must remain visible';
  end if;

  if exists (
    select 1 from public.browse_facet_counts(
      'jee', 'class-11', 'physics', null, null, null, null, null, null)
    where facet = 'chapter'
      and value in ('ray-optics-and-optical-instruments', 'modern-physics')
  ) then
    raise exception 'POSTFLIGHT: Class 11 chapter facets disagree with canonical navigation';
  end if;

  if exists (
    select 1 from public.browse_facet_counts(
      'jee', 'class-12', 'physics', null, null, null, null, null, null)
    where facet = 'chapter'
      and value in ('kinematics', 'newtons-laws-of-motion-nlm', 'work-energy-and-power')
  ) then
    raise exception 'POSTFLIGHT: Class 12 chapter facets disagree with canonical navigation';
  end if;
end
$postflight$;

do $persistent_postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241 then
    raise exception 'POSTFLIGHT: catalogue count drift';
  end if;
  if (select count(*) from public.chapter_class_levels) <> 5 then
    raise exception 'POSTFLIGHT: expected exactly five canonical scope rows';
  end if;
  select * into v_protected from (
select
  (select count(*)
     from public.playlists p
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_courses,
  (select count(*)
     from public.playlist_videos pv
     join public.playlists p on p.id = pv.playlist_id
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_memberships,
  md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
       where p.id < 167 and exists (
         select 1
           from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
       )
    ) y), '')
  ) as protected_fingerprint) protected;
  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1350
     or v_protected.protected_fingerprint <> '6829fcb6eae22479db7b82b7b3da654d' then
    raise exception 'POSTFLIGHT: protected original-83 JEE baseline drift';
  end if;
end
$persistent_postflight$;

commit;

select 'persistent production apply verified' as result;
