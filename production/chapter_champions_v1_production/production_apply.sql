-- ============================================================
-- CHAPTER CHAMPIONS v1 - PRODUCTION APPLY
-- PRODUCTION PROJECT kezelafqhgqrprpadmlf ONLY.
-- Adds ONE read-only RPC: get_chapter_champions(bigint).
--
-- WHY. CourseRating collects clarity_rating and question_rating on every
-- structured rating, but no student-facing surface has ever shown them —
-- the reviews hardening deliberately excludes both columns from anon's
-- column grant, so a signed-out browser cannot even read the raw rows.
-- This RPC is the sanctioned window: per-course AGGREGATES for one
-- chapter's courses, and nothing else. No user ids, no review text, no
-- per-row data — a definer function that returns only averages and counts.
--
-- HONESTY RULE. A dimension's average is returned ONLY once it has at
-- least 5 votes — the same RATING_CONFIDENCE_MIN floor every UI surface
-- applies (src/ratingConfidence.js). Below the floor the average is NULL
-- (never a number a client could mistakenly show); a course appears at
-- all only when at least one dimension clears the floor.
--
-- Non-destructive: create function only (refuses to replace an existing
-- one). No DROP, no ALTER TABLE, no index build; cannot lock reads.
-- RUN THE WHOLE FILE. Confirm 'CHAPTER CHAMPIONS v1 APPLY VERIFIED'.
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

-- Dependency + drift preflight, inside the transaction so a failure aborts.
do $preflight$
begin
  if to_regclass('public.playlist_ratings') is null
     or to_regclass('public.playlists') is null
     or to_regclass('public.playlist_videos') is null
     or to_regclass('public.videos') is null
     or to_regclass('public.institutes_channels') is null then
    raise exception 'REFUSING: catalogue/rating tables are missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'playlist_ratings'
      and column_name = 'clarity_rating'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'playlist_ratings'
      and column_name = 'question_rating'
  ) then
    raise exception 'REFUSING: structured rating columns are missing (apply structured_ratings.sql first)';
  end if;
  if to_regprocedure('public.get_chapter_champions(bigint)') is not null then
    raise exception 'ALREADY APPLIED: get_chapter_champions(bigint) exists';
  end if;
end
$preflight$;

create function public.get_chapter_champions(p_chapter bigint)
returns table (
  playlist_id bigint,
  title text,
  teacher text,
  institute text,
  clarity_avg numeric,
  clarity_n integer,
  question_avg numeric,
  question_n integer
)
language sql
stable
parallel safe
security definer
set search_path = ''
as $$
  with chapter_playlists as (
    select distinct pv.playlist_id
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where p_chapter is not null and v.chapter_id = p_chapter
  ),
  dims as (
    -- avg() and count() both ignore NULLs, so a rating that skipped a
    -- dimension neither moves nor inflates that dimension's aggregate.
    select
      r.playlist_id,
      avg(r.clarity_rating)   as clarity_avg,
      count(r.clarity_rating)  as clarity_n,
      avg(r.question_rating)  as question_avg,
      count(r.question_rating) as question_n
    from public.playlist_ratings r
    join chapter_playlists cp on cp.playlist_id = r.playlist_id
    group by r.playlist_id
  )
  select
    d.playlist_id,
    p.title,
    p.teacher,
    ic.name as institute,
    -- The 5-vote floor is RATING_CONFIDENCE_MIN (src/ratingConfidence.js);
    -- below it the average is NULL so no client can show an unconfident score.
    case when d.clarity_n  >= 5 then round(d.clarity_avg,  2) end as clarity_avg,
    d.clarity_n::integer,
    case when d.question_n >= 5 then round(d.question_avg, 2) end as question_avg,
    d.question_n::integer
  from dims d
  join public.playlists p on p.id = d.playlist_id
  left join public.institutes_channels ic on ic.id = p.channel_id
  where d.clarity_n >= 5 or d.question_n >= 5
  order by d.playlist_id;
$$;

comment on function public.get_chapter_champions(bigint) is
  'Per-course clarity/question rating aggregates for one chapter, confidence-gated at 5 votes per dimension (RATING_CONFIDENCE_MIN). Aggregates only: no user ids, no review text. Definer because anon''s column grant deliberately excludes the dimension columns.';

revoke all on function public.get_chapter_champions(bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.get_chapter_champions(bigint)
  to anon, authenticated, service_role;

-- Self-test, inside the transaction: any failure rolls the whole apply back.
do $verify$
declare
  v_def record;
begin
  select prosecdef, coalesce(proconfig, array[]::text[]) as config
    into v_def
  from pg_proc where oid = 'public.get_chapter_champions(bigint)'::regprocedure;
  if not v_def.prosecdef or not v_def.config @> array['search_path=""'] then
    raise exception 'SELF-TEST FAILED (rolled back): definer/search_path not fail-closed';
  end if;
  if not has_function_privilege('anon', 'public.get_chapter_champions(bigint)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_chapter_champions(bigint)', 'execute') then
    raise exception 'SELF-TEST FAILED (rolled back): execute grant missing';
  end if;
  -- Smoke: impossible and null chapters answer with zero rows, not an error.
  if (select count(*) from public.get_chapter_champions(-1)) <> 0
     or (select count(*) from public.get_chapter_champions(null)) <> 0 then
    raise exception 'SELF-TEST FAILED (rolled back): empty-chapter contract broken';
  end if;
  raise notice 'CHAPTER CHAMPIONS v1 SELF-TEST PASSED';
end
$verify$;

commit;

select 'CHAPTER CHAMPIONS v1 APPLY VERIFIED' as result;
