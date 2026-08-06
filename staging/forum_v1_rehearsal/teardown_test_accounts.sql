-- ============================================================================
-- FORUM v1 DISPOSABLE STAGING ACCOUNT TEARDOWN
-- REVIEW WITH provision_test_accounts.sql. STAGING ONLY.
--
-- Deletes only the five exact fixture UUIDs when every UUID, email domain and
-- metadata marker matches. Deleting auth.users invokes the existing
-- profiles(id) ON DELETE CASCADE; the script verifies the cascade completed.
-- ============================================================================

begin;

do $forum_fixture_teardown_guard$
declare
  environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;

  select count(*) into environment_count
  from public.app_environment
  where id = true and name = 'staging';

  if environment_count <> 1
     or exists (
       select 1 from public.app_environment where id = true and name <> 'staging'
     ) then
    raise exception 'REFUSING: fixture teardown requires exactly one staging marker';
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null then
    raise exception 'REFUSING: auth/profile dependencies are missing';
  end if;

  -- If the forum survived its rollback rehearsal, remove that schema first so
  -- deleting users cannot hide or complicate the incident.
  if to_regclass('public.forum_posts') is not null
     or to_regprocedure('public.forum_create_post(text,text,text)') is not null then
    raise exception 'REFUSING: forum schema exists; run the guarded forum rollback first';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ) then
    raise exception 'REFUSING: profiles does not cascade from auth.users';
  end if;

  if (select count(*) from auth.users
      where id in (
        'f0f10000-0000-4000-8000-000000000001',
        'f0f10000-0000-4000-8000-000000000002',
        'f0f10000-0000-4000-8000-000000000003',
        'f0f10000-0000-4000-8000-000000000004',
        'f0f10000-0000-4000-8000-000000000005'
      )
        and email like '%@staging.invalid'
        and raw_app_meta_data ->> 'forum_fixture' = 'forum_v1_rehearsal_2026_08_06') <> 5 then
    raise exception 'REFUSING: exact five-user fixture set was not found';
  end if;

  if (select count(*) from public.profiles
      where id in (
        'f0f10000-0000-4000-8000-000000000001',
        'f0f10000-0000-4000-8000-000000000002',
        'f0f10000-0000-4000-8000-000000000003',
        'f0f10000-0000-4000-8000-000000000004',
        'f0f10000-0000-4000-8000-000000000005'
      )) <> 5 then
    raise exception 'REFUSING: exact five-profile fixture set was not found';
  end if;
end;
$forum_fixture_teardown_guard$;

do $forum_fixture_delete$
declare
  deleted_count integer;
begin
  delete from auth.users
  where id in (
    'f0f10000-0000-4000-8000-000000000001',
    'f0f10000-0000-4000-8000-000000000002',
    'f0f10000-0000-4000-8000-000000000003',
    'f0f10000-0000-4000-8000-000000000004',
    'f0f10000-0000-4000-8000-000000000005'
  )
    and email like '%@staging.invalid'
    and raw_app_meta_data ->> 'forum_fixture' = 'forum_v1_rehearsal_2026_08_06';
  get diagnostics deleted_count = row_count;

  if deleted_count <> 5 then
    raise exception 'FIXTURE TEARDOWN: expected five deleted auth users, got %', deleted_count;
  end if;

  if exists (
    select 1 from public.profiles
    where id in (
      'f0f10000-0000-4000-8000-000000000001',
      'f0f10000-0000-4000-8000-000000000002',
      'f0f10000-0000-4000-8000-000000000003',
      'f0f10000-0000-4000-8000-000000000004',
      'f0f10000-0000-4000-8000-000000000005'
    )
  ) then
    raise exception 'FIXTURE TEARDOWN: profile cascade did not finish';
  end if;
end;
$forum_fixture_delete$;

commit;

select
  (select name from public.app_environment where id = true) as environment_after,
  not exists (
    select 1 from auth.users
    where raw_app_meta_data ->> 'forum_fixture' = 'forum_v1_rehearsal_2026_08_06'
  ) as fixture_users_removed,
  not exists (
    select 1 from public.profiles
    where id in (
      'f0f10000-0000-4000-8000-000000000001',
      'f0f10000-0000-4000-8000-000000000002',
      'f0f10000-0000-4000-8000-000000000003',
      'f0f10000-0000-4000-8000-000000000004',
      'f0f10000-0000-4000-8000-000000000005'
    )
  ) as fixture_profiles_removed;
