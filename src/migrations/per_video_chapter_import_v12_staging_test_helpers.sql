-- ============================================================
-- STAGING / TEST ONLY — deterministic verification helpers for
-- per_video_chapter_import_v12.sql.
--
-- Apply only after:
--   * src/migrations/staging_test_helpers.sql
--   * src/migrations/per_video_chapter_import_v12.sql
--
-- The failure trigger is inert for normal catalogue rows. It runs only for
-- reserved V12FX YouTube IDs during a NULL -> non-NULL chapter remap.
-- ============================================================

begin;

do $apply_guard$
declare
  v_capability jsonb;
begin
  if to_regprocedure('public.__assert_not_production()') is null then
    raise exception
      'refusing: staging helper __assert_not_production() is missing';
  end if;
  perform public.__assert_not_production();

  if to_regprocedure(
       'public.import_playlist_with_chapters(jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.per_video_chapter_import_capability()'
     ) is null
     or to_regclass('public.playlist_import_audit') is null
     or to_regclass('public.videos') is null then
    raise exception
      'refusing: the complete v12 mapped-import contract is not installed';
  end if;

  execute
    'select public.per_video_chapter_import_capability()'
    into v_capability;
  if coalesce((v_capability->>'version')::int, 0) <> 12
     or coalesce((v_capability->>'per_video_chapter_id')::boolean, false)
        is not true
     or coalesce((v_capability->>'all_or_none_mapping')::boolean, false)
        is not true
     or coalesce((v_capability->>'create_only')::boolean, false)
        is not true
     or coalesce((v_capability->>'request_replay')::boolean, false)
        is not true
     or coalesce((v_capability->>'audit_snapshot')::boolean, false)
        is not true then
    raise exception
      'refusing: v12 mapped-import capability is incomplete';
  end if;
end;
$apply_guard$;

create or replace function public.per_video_chapter_import_v12_test_capability()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_capability jsonb;
begin
  perform public.__assert_not_production();
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select public.per_video_chapter_import_capability()
  into v_capability;
  if coalesce((v_capability->>'version')::int, 0) <> 12
     or coalesce((v_capability->>'per_video_chapter_id')::boolean, false)
        is not true
     or coalesce((v_capability->>'all_or_none_mapping')::boolean, false)
        is not true
     or coalesce((v_capability->>'create_only')::boolean, false)
        is not true
     or coalesce((v_capability->>'request_replay')::boolean, false)
        is not true
     or coalesce((v_capability->>'audit_snapshot')::boolean, false)
        is not true
     or to_regprocedure(
       'public.cleanup_v12_import_test_audit(text,uuid[])'
     ) is null
     or to_regprocedure(
       'public.quiesce_v12_import_test_requests(text,uuid[])'
     ) is null
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.cleanup_v12_import_test_audit(text,uuid[])',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.cleanup_v12_import_test_audit(text,uuid[])',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.quiesce_v12_import_test_requests(text,uuid[])',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.quiesce_v12_import_test_requests(text,uuid[])',
       'EXECUTE'
     )
     or not exists (
       select 1
       from pg_catalog.pg_trigger trigger_row
       where trigger_row.tgname = 'trg_v12_fail_chapter_remap_fixture'
         and trigger_row.tgrelid = 'public.videos'::regclass
         and trigger_row.tgfoid = to_regprocedure(
           'public.__v12_fail_chapter_remap_fixture()'
         )
         and not trigger_row.tgisinternal
     ) then
    raise exception
      'v12 staging-test helper contract is incomplete or stale';
  end if;

  return jsonb_build_object(
    'version', 12,
    'environment', 'staging-test-only',
    'failure_video_prefix', 'V12FX',
    'audit_playlist_prefix', 'TESTV12',
    'max_cleanup_request_ids', 20
  );
end;
$$;

create or replace function public.__v12_fail_chapter_remap_fixture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.__assert_not_production();
  raise exception 'injected v12 chapter-remap failure for video %',
    new.youtube_video_id;
end;
$$;

drop trigger if exists trg_v12_fail_chapter_remap_fixture
  on public.videos;
create trigger trg_v12_fail_chapter_remap_fixture
before update of chapter_id on public.videos
for each row
when (
  old.chapter_id is null
  and new.chapter_id is not null
  and new.youtube_video_id like 'V12FX%'
)
execute function public.__v12_fail_chapter_remap_fixture();

create or replace function public.quiesce_v12_import_test_requests(
  p_run_token text,
  p_request_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := coalesce(cardinality(p_request_ids), 0);
  v_playlist_prefix text;
begin
  perform public.__assert_not_production();
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_run_token is null or p_run_token !~ '^[0-9a-f]{6}$' then
    raise exception 'quiescence requires a six-character lowercase hex run token';
  end if;
  v_playlist_prefix := 'TESTV12' || p_run_token || '%';
  if v_count < 1 or v_count > 20 then
    raise exception 'quiescence requires between 1 and 20 request_ids';
  end if;
  if exists (
    select 1
    from unnest(p_request_ids) as requested(request_id)
    where requested.request_id is null
  ) then
    raise exception 'quiescence request_ids cannot contain NULL';
  end if;
  if (
    select count(distinct requested.request_id)
    from unnest(p_request_ids) as requested(request_id)
  ) <> v_count then
    raise exception 'quiescence request_ids cannot contain duplicates';
  end if;

  -- HTTP cancellation does not prove that PostgreSQL stopped the RPC. Wait
  -- for every importer request lock before the harness deletes any fixture.
  -- If a transaction does not quiesce promptly, fail without deleting.
  perform pg_catalog.set_config('lock_timeout', '15s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested.request_id::text, 12)
  )
  from unnest(p_request_ids) as requested(request_id)
  order by requested.request_id;

  if exists (
    select 1
    from public.playlist_import_audit audit
    where audit.request_id = any(p_request_ids)
      and audit.youtube_playlist_id not like v_playlist_prefix
  ) then
    raise exception
      'quiescence refused: a matched audit row is outside this TESTV12 run';
  end if;

  return jsonb_build_object(
    'run_token', p_run_token,
    'requested', v_count,
    'locked', v_count
  );
end;
$$;

create or replace function public.cleanup_v12_import_test_audit(
  p_run_token text,
  p_request_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := coalesce(cardinality(p_request_ids), 0);
  v_deleted int;
  v_playlist_prefix text;
begin
  perform public.__assert_not_production();
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_run_token is null or p_run_token !~ '^[0-9a-f]{6}$' then
    raise exception 'cleanup requires a six-character lowercase hex run token';
  end if;
  v_playlist_prefix := 'TESTV12' || p_run_token || '%';
  if v_count < 1 or v_count > 20 then
    raise exception 'cleanup requires between 1 and 20 request_ids';
  end if;
  if exists (
    select 1
    from unnest(p_request_ids) as requested(request_id)
    where requested.request_id is null
  ) then
    raise exception 'cleanup request_ids cannot contain NULL';
  end if;
  if (
    select count(distinct requested.request_id)
    from unnest(p_request_ids) as requested(request_id)
  ) <> v_count then
    raise exception 'cleanup request_ids cannot contain duplicates';
  end if;

  -- Match the request lock used by the v12 importer. Once acquired, no v12
  -- request with one of these identities can insert between the scope check
  -- and the bounded delete below.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested.request_id::text, 12)
  )
  from unnest(p_request_ids) as requested(request_id)
  order by requested.request_id;

  if exists (
    select 1
    from public.playlist_import_audit audit
    where audit.request_id = any(p_request_ids)
      and audit.youtube_playlist_id not like v_playlist_prefix
  ) then
    raise exception
      'cleanup refused: a matched audit row is outside this TESTV12 run';
  end if;

  delete from public.playlist_import_audit audit
  where audit.request_id = any(p_request_ids)
    and audit.youtube_playlist_id like v_playlist_prefix;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'run_token', p_run_token,
    'requested', v_count,
    'deleted', v_deleted
  );
end;
$$;

-- Supabase default privileges commonly expose new public functions. Remove
-- every default grant explicitly, then grant only the three callable helpers to
-- service_role. The trigger function remains private.
revoke all on function public.per_video_chapter_import_v12_test_capability()
  from public, anon, authenticated, service_role;
revoke all on function public.__v12_fail_chapter_remap_fixture()
  from public, anon, authenticated, service_role;
revoke all on function public.quiesce_v12_import_test_requests(text, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.cleanup_v12_import_test_audit(text, uuid[])
  from public, anon, authenticated, service_role;

grant execute on function public.per_video_chapter_import_v12_test_capability()
  to service_role;
grant execute on function public.quiesce_v12_import_test_requests(text, uuid[])
  to service_role;
grant execute on function public.cleanup_v12_import_test_audit(text, uuid[])
  to service_role;

commit;
