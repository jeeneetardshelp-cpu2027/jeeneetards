-- ============================================================================
-- FORUM CLOSED-BETA v1 DISPOSABLE STAGING ACCOUNT SETUP
-- REVIEW BEFORE RUNNING. STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Creates three non-login fixtures: one admin, one beta member and one
-- non-member. Every email uses the reserved @staging.invalid domain.
-- ============================================================================

begin;

do $forum_beta_fixture_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and name = 'staging';
  if environment_count <> 1
     or exists (select 1 from public.app_environment where id and name <> 'staging') then
    raise exception 'REFUSING: beta fixtures require exactly one staging marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_posts') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'REFUSING: reviewed persistent forum baseline is incomplete';
  end if;
  if to_regclass('public.forum_beta_members') is not null then
    raise exception 'REFUSING: closed-beta delta is already installed';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: forum mode must be off';
  end if;
  if exists (select 1 from auth.users)
     or exists (select 1 from public.profiles) then
    raise exception 'REFUSING: staging auth/profile store is not empty';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_reports) then
    raise exception 'REFUSING: staging forum data is not empty';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f' and confdeltype = 'c'
  ) then
    raise exception 'REFUSING: profiles does not cascade from auth.users';
  end if;
end;
$forum_beta_fixture_guard$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'fb010000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'forum-beta-admin@staging.invalid', now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_closed_beta_v1_2026_08_07"}'::jsonb,
    '{"forum_fixture":"forum_closed_beta_v1_2026_08_07","full_name":"Forum beta fixture"}'::jsonb,
    now() - interval '20 minutes', now() - interval '20 minutes'
  ),
  (
    'fb010000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'forum-beta-member@staging.invalid', now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_closed_beta_v1_2026_08_07"}'::jsonb,
    '{"forum_fixture":"forum_closed_beta_v1_2026_08_07","full_name":"Forum beta fixture"}'::jsonb,
    now() - interval '20 minutes', now() - interval '20 minutes'
  ),
  (
    'fb010000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'forum-beta-outsider@staging.invalid', now() - interval '20 minutes',
    '{"provider":"email","providers":["email"],"forum_fixture":"forum_closed_beta_v1_2026_08_07"}'::jsonb,
    '{"forum_fixture":"forum_closed_beta_v1_2026_08_07","full_name":"Forum beta fixture"}'::jsonb,
    now() - interval '20 minutes', now() - interval '20 minutes'
  );

do $forum_beta_fixture_profiles$
declare updated_count integer;
begin
  if (select count(*) from public.profiles where id in (
    'fb010000-0000-4000-8000-000000000001',
    'fb010000-0000-4000-8000-000000000002',
    'fb010000-0000-4000-8000-000000000003'
  )) <> 3 then
    raise exception 'FIXTURE SETUP: profile trigger did not create three rows';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles
  set username = case id
        when 'fb010000-0000-4000-8000-000000000001' then 'beta_stage_admin'
        when 'fb010000-0000-4000-8000-000000000002' then 'beta_stage_member'
        when 'fb010000-0000-4000-8000-000000000003' then 'beta_stage_outsider'
      end,
      full_name = 'Forum beta fixture', avatar_url = null,
      is_admin = (id = 'fb010000-0000-4000-8000-000000000001'),
      created_at = now() - interval '20 minutes'
  where id in (
    'fb010000-0000-4000-8000-000000000001',
    'fb010000-0000-4000-8000-000000000002',
    'fb010000-0000-4000-8000-000000000003'
  );
  get diagnostics updated_count = row_count;
  if updated_count <> 3 then
    raise exception 'FIXTURE SETUP: expected three profile updates, got %', updated_count;
  end if;
end;
$forum_beta_fixture_profiles$;

do $forum_beta_fixture_assert$
begin
  if (select count(*) from auth.users
      where raw_app_meta_data ->> 'forum_fixture' = 'forum_closed_beta_v1_2026_08_07'
        and email like '%@staging.invalid'
        and created_at <= now() - interval '10 minutes') <> 3 then
    raise exception 'FIXTURE SETUP: three back-dated staging users were not created';
  end if;
  if (select count(*) from public.profiles where id in (
      'fb010000-0000-4000-8000-000000000001',
      'fb010000-0000-4000-8000-000000000002',
      'fb010000-0000-4000-8000-000000000003'
    )) <> 3 then
    raise exception 'FIXTURE SETUP: expected three fixture profiles';
  end if;
  if (select count(*) from public.profiles where id in (
      'fb010000-0000-4000-8000-000000000001',
      'fb010000-0000-4000-8000-000000000002',
      'fb010000-0000-4000-8000-000000000003'
    ) and is_admin) <> 1 then
    raise exception 'FIXTURE SETUP: expected exactly one fixture admin';
  end if;
end;
$forum_beta_fixture_assert$;

commit;

select
  (select lower(name) = 'staging' from public.app_environment where id) as environment_is_staging,
  (select count(*) from auth.users
    where raw_app_meta_data ->> 'forum_fixture' = 'forum_closed_beta_v1_2026_08_07') = 3
    as three_fixture_users_created,
  (select count(*) from public.profiles where id in (
    'fb010000-0000-4000-8000-000000000001',
    'fb010000-0000-4000-8000-000000000002',
    'fb010000-0000-4000-8000-000000000003'
  )) = 3 as three_fixture_profiles_created,
  (select count(*) from public.profiles where id in (
    'fb010000-0000-4000-8000-000000000001',
    'fb010000-0000-4000-8000-000000000002',
    'fb010000-0000-4000-8000-000000000003'
  ) and is_admin) = 1 as exactly_one_fixture_admin;
