-- ============================================================================
-- FORUM CLOSED-BETA v1 DISPOSABLE STAGING ACCOUNT TEARDOWN
-- REVIEW WITH provision_test_accounts.sql. STAGING ONLY.
-- ============================================================================

begin;

do $forum_beta_fixture_teardown_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and name = 'staging';
  if environment_count <> 1
     or exists (select 1 from public.app_environment where id and name <> 'staging') then
    raise exception 'REFUSING: beta fixture teardown requires exactly one staging marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_posts') is null
     or to_regprocedure('public.forum_claim_username(text)') is null then
    raise exception 'REFUSING: reviewed persistent forum baseline is incomplete';
  end if;
  if to_regclass('public.forum_beta_members') is not null then
    raise exception 'REFUSING: beta schema persisted; run the guarded beta rollback first';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: forum mode must be off';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_reports) then
    raise exception 'REFUSING: forum rehearsal data persisted';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f' and confdeltype = 'c'
  ) then
    raise exception 'REFUSING: profiles does not cascade from auth.users';
  end if;
  if (select count(*) from auth.users
      where id in (
        'fb010000-0000-4000-8000-000000000001',
        'fb010000-0000-4000-8000-000000000002',
        'fb010000-0000-4000-8000-000000000003'
      ) and email like '%@staging.invalid'
        and raw_app_meta_data ->> 'forum_fixture' = 'forum_closed_beta_v1_2026_08_07') <> 3 then
    raise exception 'REFUSING: exact three-user beta fixture set was not found';
  end if;
  if (select count(*) from public.profiles where id in (
      'fb010000-0000-4000-8000-000000000001',
      'fb010000-0000-4000-8000-000000000002',
      'fb010000-0000-4000-8000-000000000003'
    )) <> 3 then
    raise exception 'REFUSING: exact three-profile beta fixture set was not found';
  end if;
end;
$forum_beta_fixture_teardown_guard$;

do $forum_beta_fixture_delete$
declare deleted_count integer;
begin
  delete from auth.users
  where id in (
    'fb010000-0000-4000-8000-000000000001',
    'fb010000-0000-4000-8000-000000000002',
    'fb010000-0000-4000-8000-000000000003'
  ) and email like '%@staging.invalid'
    and raw_app_meta_data ->> 'forum_fixture' = 'forum_closed_beta_v1_2026_08_07';
  get diagnostics deleted_count = row_count;
  if deleted_count <> 3 then
    raise exception 'FIXTURE TEARDOWN: expected three deleted auth users, got %', deleted_count;
  end if;
  if exists (select 1 from public.profiles where id in (
      'fb010000-0000-4000-8000-000000000001',
      'fb010000-0000-4000-8000-000000000002',
      'fb010000-0000-4000-8000-000000000003'
    )) then
    raise exception 'FIXTURE TEARDOWN: profile cascade did not finish';
  end if;
end;
$forum_beta_fixture_delete$;

commit;

select
  (select lower(name) = 'staging' from public.app_environment where id)
    as environment_is_staging,
  not exists (
    select 1 from auth.users
    where raw_app_meta_data ->> 'forum_fixture' = 'forum_closed_beta_v1_2026_08_07'
  ) as fixture_users_removed,
  not exists (
    select 1 from public.profiles where id in (
      'fb010000-0000-4000-8000-000000000001',
      'fb010000-0000-4000-8000-000000000002',
      'fb010000-0000-4000-8000-000000000003'
    )
  ) as fixture_profiles_removed;
