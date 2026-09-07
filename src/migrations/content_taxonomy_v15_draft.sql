-- ============================================================================
-- Content taxonomy v15 — REVIEW-ONLY DRAFT. NOT APPROVED FOR INSTALLATION.
--
-- Adds a reviewed, orthogonal taxonomy without altering or backfilling any
-- existing catalogue row. The legacy playlists.content_type and difficulty
-- fields remain untouched for compatibility. Public reads are restricted to
-- explicitly verified rows; pending metadata cannot create student shelves.
-- ============================================================================

begin;

do $not_approved$
begin
  raise exception 'NOT APPROVED: content taxonomy v15 is a review-only draft';
end
$not_approved$;

do $preflight$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.playlists') is null then missing := array_append(missing, 'playlists'); end if;
  if to_regclass('public.videos') is null then missing := array_append(missing, 'videos'); end if;
  if cardinality(missing) > 0 then
    raise exception 'CONTENT TAXONOMY V15 PREFLIGHT: missing %', array_to_string(missing, ', ');
  end if;

  if to_regclass('public.playlist_content_taxonomy') is not null
     or to_regclass('public.video_content_taxonomy') is not null
     or to_regprocedure('public.content_taxonomy_array_is_unique_subset(text[],text[])') is not null then
    raise exception 'CONTENT TAXONOMY V15 PREFLIGHT: partial or prior installation detected';
  end if;
end
$preflight$;

create temporary table content_taxonomy_v15_baseline on commit drop as
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos;

create function public.content_taxonomy_array_is_unique_subset(
  p_values text[],
  p_allowed text[]
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    not exists (
      select 1 from unnest(p_values) value
      where value is null or not (value = any(p_allowed))
    )
    and cardinality(p_values) = (
      select count(distinct value)::integer from unnest(p_values) value
    )
$$;

create table public.playlist_content_taxonomy (
  playlist_id bigint primary key references public.playlists(id) on delete cascade,
  content_format text,
  learning_purposes text[] not null default array[]::text[],
  exam_scopes text[] not null default array[]::text[],
  target_cohorts text[] not null default array[]::text[],
  teaching_depth text,
  coverage_level text,
  completion_status text,
  prerequisites text[] not null default array[]::text[],
  review_status text not null default 'pending',
  review_decision_id uuid,
  evidence_url text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint playlist_taxonomy_format_check check (
    content_format is null or content_format in ('series','one-shot','live-class','short')
  ),
  constraint playlist_taxonomy_purposes_check check (
    public.content_taxonomy_array_is_unique_subset(
      learning_purposes, array['theory','revision','practice','pyq','strategy']::text[]
    )
  ),
  constraint playlist_taxonomy_exam_scopes_check check (
    public.content_taxonomy_array_is_unique_subset(
      exam_scopes, array['jee-main','jee-advanced','neet','boards','olympiad']::text[]
    )
  ),
  constraint playlist_taxonomy_cohorts_check check (
    public.content_taxonomy_array_is_unique_subset(
      target_cohorts, array['class-9','class-10','class-11','class-12','dropper']::text[]
    )
  ),
  constraint playlist_taxonomy_teaching_depth_check check (
    teaching_depth is null or teaching_depth in ('foundation','standard','advanced')
  ),
  constraint playlist_taxonomy_coverage_check check (
    coverage_level is null or coverage_level in ('topic','chapter','unit','full-syllabus')
  ),
  constraint playlist_taxonomy_completion_check check (
    completion_status is null or completion_status in ('complete','ongoing','incomplete')
  ),
  constraint playlist_taxonomy_prerequisites_check check (
    public.content_taxonomy_array_is_unique_subset(prerequisites, prerequisites)
    and cardinality(prerequisites) <= 20
    and char_length(array_to_string(prerequisites, '')) <= 3200
  ),
  constraint playlist_taxonomy_review_status_check check (
    review_status in ('pending','verified','rejected')
  ),
  constraint playlist_taxonomy_https_evidence check (
    evidence_url is null or evidence_url ~ '^https://[^[:space:]]+$'
  ),
  constraint playlist_taxonomy_verified_gate check (
    review_status <> 'verified'
    or (
      content_format is not null
      and cardinality(learning_purposes) > 0
      and cardinality(exam_scopes) > 0
      and cardinality(target_cohorts) > 0
      and teaching_depth is not null
      and coverage_level is not null
      and completion_status is not null
      and review_decision_id is not null
      and evidence_url is not null
      and char_length(btrim(review_note)) >= 10
      and reviewed_at is not null
    )
  )
);

comment on table public.playlist_content_taxonomy is
  'Reviewed orthogonal course metadata. Never inferred from legacy content_type or difficulty.';

create table public.video_content_taxonomy (
  video_id bigint primary key references public.videos(id) on delete cascade,
  content_format text,
  learning_purposes text[] not null default array[]::text[],
  review_status text not null default 'pending',
  review_decision_id uuid,
  evidence_url text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint video_taxonomy_format_check check (
    content_format is null or content_format in ('series','one-shot','live-class','short')
  ),
  constraint video_taxonomy_purposes_check check (
    public.content_taxonomy_array_is_unique_subset(
      learning_purposes, array['theory','revision','practice','pyq','strategy']::text[]
    )
  ),
  constraint video_taxonomy_review_status_check check (
    review_status in ('pending','verified','rejected')
  ),
  constraint video_taxonomy_https_evidence check (
    evidence_url is null or evidence_url ~ '^https://[^[:space:]]+$'
  ),
  constraint video_taxonomy_verified_gate check (
    review_status <> 'verified'
    or (
      content_format is not null
      and cardinality(learning_purposes) > 0
      and review_decision_id is not null
      and evidence_url is not null
      and char_length(btrim(review_note)) >= 10
      and reviewed_at is not null
    )
  )
);

comment on table public.video_content_taxonomy is
  'Reviewed per-video format and purpose. Confirmed short rows can be excluded from structured lesson sequences.';

create index playlist_content_taxonomy_verified_format
  on public.playlist_content_taxonomy (content_format, playlist_id)
  where review_status = 'verified';
create index playlist_content_taxonomy_purposes
  on public.playlist_content_taxonomy using gin (learning_purposes)
  where review_status = 'verified';
create index playlist_content_taxonomy_exam_scopes
  on public.playlist_content_taxonomy using gin (exam_scopes)
  where review_status = 'verified';
create index playlist_content_taxonomy_target_cohorts
  on public.playlist_content_taxonomy using gin (target_cohorts)
  where review_status = 'verified';
create index video_content_taxonomy_verified_format
  on public.video_content_taxonomy (content_format, video_id)
  where review_status = 'verified';

alter table public.playlist_content_taxonomy enable row level security;
alter table public.video_content_taxonomy enable row level security;

create policy "public reads verified playlist taxonomy"
  on public.playlist_content_taxonomy for select
  using (review_status = 'verified');
create policy "public reads verified video taxonomy"
  on public.video_content_taxonomy for select
  using (review_status = 'verified');

revoke all on function public.content_taxonomy_array_is_unique_subset(text[], text[])
  from public, anon, authenticated;
revoke all on table public.playlist_content_taxonomy from public, anon, authenticated;
revoke all on table public.video_content_taxonomy from public, anon, authenticated;
grant select on table public.playlist_content_taxonomy to anon, authenticated;
grant select on table public.video_content_taxonomy to anon, authenticated;

do $postflight$
declare
  baseline record;
begin
  select * into baseline from content_taxonomy_v15_baseline;

  if (select count(*) from public.playlists) <> baseline.playlists
     or (select count(*) from public.videos) <> baseline.videos then
    raise exception 'CONTENT TAXONOMY V15 POSTFLIGHT: existing catalogue counts changed';
  end if;

  if (select count(*) from public.playlist_content_taxonomy) <> 0
     or (select count(*) from public.video_content_taxonomy) <> 0 then
    raise exception 'CONTENT TAXONOMY V15 POSTFLIGHT: draft must not classify existing content';
  end if;
end
$postflight$;

commit;
