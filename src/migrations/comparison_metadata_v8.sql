-- ============================================================
-- v8 STAGING CANDIDATE — VERIFIED COMPARISON METADATA + TOPICS
--
-- Additive delta on top of the verified v7 staging schema. This file is not
-- included in staging_bootstrap.sql or the production migration builder.
-- Apply only to a disposable staging project after independent review.
--
-- Truth rules:
--   * all ids match the existing bigint schema
--   * judgments are nullable and hidden until explicitly verified
--   * lecture counts and durations are derived from playlist_videos/videos
--   * a duration is NULL when even one relevant video has no duration
--   * coverage is chapter + learning-goal scoped and is NULL without a
--     reviewed denominator
--   * the RPC returns a status for missing/cross-chapter selections instead
--     of silently dropping them
-- ============================================================

-- ------------------------------------------------------------
-- 1. ONE REVIEWED ATTRIBUTE RECORD PER PLAYLIST
-- ------------------------------------------------------------
create table if not exists public.playlist_attributes (
    playlist_id              bigint primary key
                             references public.playlists(id) on delete cascade,
    pacing                   text
                             check (pacing is null or pacing in
                               ('slow','moderate','fast','crash-course')),
    theory_percentage        smallint
                             check (theory_percentage is null or
                                    theory_percentage between 0 and 100),
    prerequisites_level      text
                             check (prerequisites_level is null or
                                    prerequisites_level in
                                      ('none','basic','intermediate','advanced')),
    completeness_status      text not null default 'unassessed'
                             check (completeness_status in
                                      ('unassessed','partial','complete')),
    best_for                 text,
    review_status            text not null default 'proposed'
                             check (review_status in
                                      ('proposed','verified','rejected')),
    source                   text not null default 'manual'
                             check (source in
                                      ('manual','import','editorial-review')),
    evidence_note            text,
    verified_by              uuid references auth.users(id) on delete set null,
    verified_at              timestamptz,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    check (review_status <> 'verified' or verified_at is not null)
);

-- ------------------------------------------------------------
-- 2. TOPICS UNDER THE EXISTING SUBJECT -> CHAPTER TAXONOMY
-- ------------------------------------------------------------
create table if not exists public.topics (
    id            bigint generated always as identity primary key,
    chapter_id    bigint not null
                  references public.chapters(id) on delete cascade,
    name          text not null,
    slug          text not null,
    display_order int not null default 0,
    created_at    timestamptz not null default now(),
    unique (chapter_id, slug),
    unique (chapter_id, name)
);
create index if not exists idx_topics_chapter_order
    on public.topics (chapter_id, display_order, id);

-- Which topics are part of a particular exam/learning-goal syllabus.
-- A topic can be required for JEE, optional for Olympiad, and absent for NEET
-- without duplicating the topic identity itself.
create table if not exists public.learning_goal_topics (
    learning_goal_id bigint not null
                     references public.learning_goals(id) on delete cascade,
    topic_id         bigint not null
                     references public.topics(id) on delete cascade,
    is_required      boolean not null default true,
    created_at       timestamptz not null default now(),
    primary key (learning_goal_id, topic_id)
);
create index if not exists idx_lgt_topic on public.learning_goal_topics (topic_id);

-- Video-level evidence is the source of playlist coverage. Proposed mappings
-- never influence student-facing percentages.
create table if not exists public.video_topics (
    video_id       bigint not null references public.videos(id) on delete cascade,
    topic_id       bigint not null references public.topics(id) on delete cascade,
    coverage_kind  text not null default 'theory'
                   check (coverage_kind in ('theory','practice','pyq','mixed')),
    review_status  text not null default 'proposed'
                   check (review_status in ('proposed','verified','rejected')),
    source         text not null default 'manual'
                   check (source in ('manual','import','editorial-review')),
    verified_by    uuid references auth.users(id) on delete set null,
    verified_at    timestamptz,
    created_at     timestamptz not null default now(),
    primary key (video_id, topic_id),
    check (review_status <> 'verified' or verified_at is not null)
);
create index if not exists idx_video_topics_topic_verified
    on public.video_topics (topic_id, video_id)
    where review_status = 'verified';

-- Keep the one editable aggregate row's timestamp honest.
create or replace function public.touch_playlist_attributes()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end
$function$;

drop trigger if exists trg_touch_playlist_attributes on public.playlist_attributes;
create trigger trg_touch_playlist_attributes
before update on public.playlist_attributes
for each row execute function public.touch_playlist_attributes();

revoke all on function public.touch_playlist_attributes()
  from public, anon, authenticated, service_role;

-- These tables are editorial internals. Students receive only the reviewed,
-- bounded projection from get_playlist_comparison(). Supabase service_role
-- remains the staging/admin maintenance path and bypasses RLS by design.
alter table public.playlist_attributes enable row level security;
alter table public.topics enable row level security;
alter table public.learning_goal_topics enable row level security;
alter table public.video_topics enable row level security;

revoke all on table public.playlist_attributes from public, anon, authenticated;
revoke all on table public.topics from public, anon, authenticated;
revoke all on table public.learning_goal_topics from public, anon, authenticated;
revoke all on table public.video_topics from public, anon, authenticated;

grant select, insert, update, delete on table public.playlist_attributes to service_role;
grant select, insert, update, delete on table public.topics to service_role;
grant select, insert, update, delete on table public.learning_goal_topics to service_role;
grant select, insert, update, delete on table public.video_topics to service_role;
grant usage, select on sequence public.topics_id_seq to service_role;

-- ------------------------------------------------------------
-- 3. BOUNDED, ORDER-PRESERVING, CHAPTER-SCOPED COMPARISON RPC
-- ------------------------------------------------------------
drop function if exists public.get_playlist_comparison(bigint[], bigint, bigint);

create function public.get_playlist_comparison(
    p_playlist_ids     bigint[],
    p_chapter_id       bigint,
    p_learning_goal_id bigint default null
)
returns table (
    requested_order          int,
    playlist_id              bigint,
    course_status            text,
    title                    text,
    teacher                  text,
    channel_title            text,
    subject_title            text,
    class_levels             text[],
    language                 text,
    content_type             text,
    difficulty               text,
    chapter_lecture_count    bigint,
    chapter_duration_seconds bigint,
    pacing                   text,
    theory_percentage        smallint,
    prerequisites_level      text,
    completeness_status      text,
    best_for                 text,
    metadata_verified_at     timestamptz,
    coverage_mapped_topics   bigint,
    coverage_required_topics bigint,
    syllabus_coverage_pct    numeric,
    average_rating           numeric,
    ratings_count            int,
    last_verified_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_length int := coalesce(cardinality(p_playlist_ids), 0);
begin
  if v_length = 0 then
    raise exception 'playlist_ids must contain between 1 and 4 ids';
  end if;
  if v_length > 4 then
    raise exception 'at most 4 playlists may be compared';
  end if;
  if exists (
    select 1 from unnest(p_playlist_ids) as supplied(id)
    where supplied.id is null or supplied.id <= 0
  ) then
    raise exception 'playlist_ids must contain positive bigint ids';
  end if;
  if (
    select count(distinct supplied.id)
    from unnest(p_playlist_ids) as supplied(id)
  ) <> v_length then
    raise exception 'playlist_ids must not contain duplicates';
  end if;
  if p_chapter_id is null or p_chapter_id <= 0 or
     not exists (select 1 from public.chapters c where c.id = p_chapter_id) then
    raise exception 'a valid chapter_id is required';
  end if;
  if p_learning_goal_id is not null and not exists (
       select 1 from public.learning_goals lg where lg.id = p_learning_goal_id
     ) then
    raise exception 'unknown learning_goal_id %', p_learning_goal_id;
  end if;

  return query
  with requested as (
    select req.id, req.ordinality::int as ord
      from unnest(p_playlist_ids) with ordinality as req(id, ordinality)
  ),
  selected as (
    select
      r.ord,
      r.id as requested_id,
      p.*,
      ic.name as resolved_channel_title,
      s.name as resolved_subject_title,
      exists (
        select 1
          from public.playlist_videos pv
          join public.videos v on v.id = pv.video_id
         where pv.playlist_id = p.id
           and v.chapter_id = p_chapter_id
      ) as teaches_requested_chapter
    from requested r
    left join public.playlists p on p.id = r.id
    left join public.institutes_channels ic on ic.id = p.channel_id
    left join public.subjects s on s.id = p.subject_id
  )
  select
    sel.ord,
    sel.requested_id,
    case
      when sel.id is null then 'not-found'
      when not sel.teaches_requested_chapter then 'wrong-chapter'
      else 'ok'
    end,
    sel.title,
    sel.teacher,
    sel.resolved_channel_title,
    sel.resolved_subject_title,
    sel.class_levels,
    sel.language,
    sel.content_type,
    sel.difficulty,
    case when sel.id is null then null else chapter_stats.lecture_count end,
    case
      when chapter_stats.lecture_count > 0 and
           chapter_stats.known_duration_count = chapter_stats.lecture_count
        then chapter_stats.duration_seconds
      else null
    end,
    case when pa.review_status = 'verified' then pa.pacing end,
    case when pa.review_status = 'verified' then pa.theory_percentage end,
    case when pa.review_status = 'verified' then pa.prerequisites_level end,
    case when pa.review_status = 'verified' then pa.completeness_status end,
    case when pa.review_status = 'verified' then pa.best_for end,
    case when pa.review_status = 'verified' then pa.verified_at end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else coverage.mapped_topics
    end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else coverage.required_topics
    end,
    case
      when sel.id is null or p_learning_goal_id is null or coverage.required_topics = 0
        then null
      else round(coverage.mapped_topics::numeric * 100 / coverage.required_topics, 2)
    end,
    sel.average_rating,
    sel.ratings_count,
    sel.last_verified_at
  from selected sel
  left join public.playlist_attributes pa on pa.playlist_id = sel.id
  left join lateral (
    select
      count(*)::bigint as lecture_count,
      count(v.duration_seconds)::bigint as known_duration_count,
      sum(v.duration_seconds)::bigint as duration_seconds
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = sel.id
      and v.chapter_id = p_chapter_id
  ) chapter_stats on true
  left join lateral (
    select
      (
        select count(*)::bigint
        from public.learning_goal_topics lgt
        join public.topics t on t.id = lgt.topic_id
        where lgt.learning_goal_id = p_learning_goal_id
          and lgt.is_required
          and t.chapter_id = p_chapter_id
      ) as required_topics,
      (
        select count(distinct vt.topic_id)::bigint
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        join public.video_topics vt on vt.video_id = v.id
        join public.topics t on t.id = vt.topic_id
        join public.learning_goal_topics lgt
          on lgt.topic_id = vt.topic_id
         and lgt.learning_goal_id = p_learning_goal_id
         and lgt.is_required
        where pv.playlist_id = sel.id
          and v.chapter_id = p_chapter_id
          and t.chapter_id = p_chapter_id
          and vt.review_status = 'verified'
      ) as mapped_topics
  ) coverage on true
  order by sel.ord;
end
$function$;

revoke all on function public.get_playlist_comparison(bigint[], bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.get_playlist_comparison(bigint[], bigint, bigint)
  to anon, authenticated, service_role;

comment on function public.get_playlist_comparison(bigint[], bigint, bigint) is
  'Truthful ordered comparison: max 4 bigint playlist ids, required chapter scope, optional learning-goal coverage. Unknown metadata remains NULL.';

-- PostgREST can retain a pre-migration schema snapshot after SQL Editor DDL.
-- Deliver the reload only when this transaction commits, so API verification
-- cannot observe a partially applied comparison schema.
notify pgrst, 'reload schema';
