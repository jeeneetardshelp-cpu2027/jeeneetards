-- ============================================================================
-- FORUM v1 DISPOSABLE STAGING ACCOUNT SETUP
-- REVIEW BEFORE RUNNING. STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Creates exactly five non-login fixtures for rollback rehearsal:
--   * one admin
--   * four students
--
-- No service_role credential or password is stored here. The SQL must be run
-- as the Supabase SQL Editor's postgres role. All fixture emails use the
-- reserved, non-deliverable @staging.invalid domain.
-- ============================================================================

begin;

-- This guard is deliberately first. Nothing may grant is_admin before the
-- database proves it is the empty disposable staging clone.
do $forum_fixture_guard$
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
    raise exception 'REFUSING: forum fixtures require exactly one staging marker';
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: auth/profile/admin dependencies are missing';
  end if;

  if to_regclass('public.forum_posts') is not null
     or to_regprocedure('public.forum_create_post(text,text,text)') is not null then
    raise exception 'REFUSING: remove the forum schema before provisioning fixtures';
  end if;

  -- This fixture package is intentionally restricted to an empty clone. A
  -- copied production account or profile makes the whole transaction fail.
  if exists (select 1 from auth.users)
     or exists (select 1 from public.profiles) then
    raise exception 'REFUSING: staging auth/profile store is not empty';
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
end;
$forum_fixture_guard$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'f0f10000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'forum-rehearsal-admin@staging.invalid',
    now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_v1_rehearsal_2026_08_06"}'::jsonb,
    '{"forum_fixture":"forum_v1_rehearsal_2026_08_06","full_name":"Forum rehearsal fixture"}'::jsonb,
    now() - interval '20 minutes',
    now() - interval '20 minutes'
  ),
  (
    'f0f10000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'forum-rehearsal-student-1@staging.invalid',
    now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_v1_rehearsal_2026_08_06"}'::jsonb,
    '{"forum_fixture":"forum_v1_rehearsal_2026_08_06","full_name":"Forum rehearsal fixture"}'::jsonb,
    now() - interval '20 minutes',
    now() - interval '20 minutes'
  ),
  (
    'f0f10000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'forum-rehearsal-student-2@staging.invalid',
    now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_v1_rehearsal_2026_08_06"}'::jsonb,
    '{"forum_fixture":"forum_v1_rehearsal_2026_08_06","full_name":"Forum rehearsal fixture"}'::jsonb,
    now() - interval '20 minutes',
    now() - interval '20 minutes'
  ),
  (
    'f0f10000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'forum-rehearsal-student-3@staging.invalid',
    now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_v1_rehearsal_2026_08_06"}'::jsonb,
    '{"forum_fixture":"forum_v1_rehearsal_2026_08_06","full_name":"Forum rehearsal fixture"}'::jsonb,
    now() - interval '20 minutes',
    now() - interval '20 minutes'
  ),
  (
    'f0f10000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'forum-rehearsal-student-4@staging.invalid',
    now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_v1_rehearsal_2026_08_06"}'::jsonb,
    '{"forum_fixture":"forum_v1_rehearsal_2026_08_06","full_name":"Forum rehearsal fixture"}'::jsonb,
    now() - interval '20 minutes',
    now() - interval '20 minutes'
  );

do $forum_fixture_profiles$
declare
  updated_count integer;
begin
  if (select count(*) from public.profiles where id in (
    'f0f10000-0000-4000-8000-000000000001',
    'f0f10000-0000-4000-8000-000000000002',
    'f0f10000-0000-4000-8000-000000000003',
    'f0f10000-0000-4000-8000-000000000004',
    'f0f10000-0000-4000-8000-000000000005'
  )) <> 5 then
    raise exception 'FIXTURE SETUP: profile creation trigger did not create five rows';
  end if;

  -- The existing privilege-escalation trigger requires the service_role JWT
  -- claim even when this script is run by postgres. This is transaction-local;
  -- no credential is involved and the value disappears at COMMIT.
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.profiles
  set username = case id
        when 'f0f10000-0000-4000-8000-000000000001' then 'stage_forum_admin'
        when 'f0f10000-0000-4000-8000-000000000002' then 'stage_forum_student_1'
        when 'f0f10000-0000-4000-8000-000000000003' then 'stage_forum_student_2'
        when 'f0f10000-0000-4000-8000-000000000004' then 'stage_forum_student_3'
        when 'f0f10000-0000-4000-8000-000000000005' then 'stage_forum_student_4'
      end,
      full_name = 'Forum rehearsal fixture',
      avatar_url = null,
      is_admin = (id = 'f0f10000-0000-4000-8000-000000000001'),
      created_at = now() - interval '20 minutes'
  where id in (
    'f0f10000-0000-4000-8000-000000000001',
    'f0f10000-0000-4000-8000-000000000002',
    'f0f10000-0000-4000-8000-000000000003',
    'f0f10000-0000-4000-8000-000000000004',
    'f0f10000-0000-4000-8000-000000000005'
  );
  get diagnostics updated_count = row_count;

  if updated_count <> 5 then
    raise exception 'FIXTURE SETUP: expected five profile updates, got %', updated_count;
  end if;
end;
$forum_fixture_profiles$;

do $forum_fixture_assert$
begin
  if (select count(*) from auth.users
      where raw_app_meta_data ->> 'forum_fixture' = 'forum_v1_rehearsal_2026_08_06'
        and email like '%@staging.invalid'
        and created_at <= now() - interval '10 minutes') <> 5 then
    raise exception 'FIXTURE SETUP: five back-dated staging users were not created';
  end if;

  if (select count(*) from public.profiles
      where id in (
        'f0f10000-0000-4000-8000-000000000001',
        'f0f10000-0000-4000-8000-000000000002',
        'f0f10000-0000-4000-8000-000000000003',
        'f0f10000-0000-4000-8000-000000000004',
        'f0f10000-0000-4000-8000-000000000005'
      )) <> 5 then
    raise exception 'FIXTURE SETUP: expected five fixture profiles';
  end if;

  if (select count(*) from public.profiles
      where id in (
        'f0f10000-0000-4000-8000-000000000001',
        'f0f10000-0000-4000-8000-000000000002',
        'f0f10000-0000-4000-8000-000000000003',
        'f0f10000-0000-4000-8000-000000000004',
        'f0f10000-0000-4000-8000-000000000005'
      ) and is_admin) <> 1 then
    raise exception 'FIXTURE SETUP: expected exactly one fixture admin';
  end if;
end;
$forum_fixture_assert$;

commit;

select
  (select name from public.app_environment where id = true) as environment_after,
  (select count(*) from auth.users
    where raw_app_meta_data ->> 'forum_fixture' = 'forum_v1_rehearsal_2026_08_06') = 5
    as five_fixture_users_created,
  (select count(*) from public.profiles
    where id in (
      'f0f10000-0000-4000-8000-000000000001',
      'f0f10000-0000-4000-8000-000000000002',
      'f0f10000-0000-4000-8000-000000000003',
      'f0f10000-0000-4000-8000-000000000004',
      'f0f10000-0000-4000-8000-000000000005'
    )) = 5 as five_fixture_profiles_created,
  (select count(*) from public.profiles
    where id in (
      'f0f10000-0000-4000-8000-000000000001',
      'f0f10000-0000-4000-8000-000000000002',
      'f0f10000-0000-4000-8000-000000000003',
      'f0f10000-0000-4000-8000-000000000004',
      'f0f10000-0000-4000-8000-000000000005'
    ) and is_admin) = 1 as exactly_one_fixture_admin;
