-- ============================================================================
-- FORUM v1 PRODUCTION PREFLIGHT — READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE INSTALLER.
-- ============================================================================
-- corePreflight: 3e009b762338b29d9f508addbdbef84a1689026a8e14100c632c48baf43f4d70  src/migrations/forum_v1_preflight.sql
-- coreMigration: 9fcf733655cd268589915254078c1e1d6d68da5fd252d5b9d73b290b283d9866  src/migrations/forum_v1.sql
-- corePostflight: 3a6defe5610c8b7c54504487498bdebc7fe28f500e3d3501cb7e82d3d453d583  src/migrations/forum_v1_postflight.sql
-- coreRollback: a42f830a1ff3b1ade5b85b396bacc452eccbecc3be554458c8e38b06b446ab2a  src/migrations/forum_v1_rollback.sql
-- usernamePreflight: 085a2dbbecb19a2bdb8a4a6338bbf5a5d164e07170e39cc8a30536ce09cceb75  src/migrations/forum_username_claim_v1_preflight.sql
-- usernameAudit: 496e0d6ce4399b685a2dec13786293cc70c5c56b002b4f7c20c3fd1083d60624  src/migrations/forum_username_claim_v1_audit.sql
-- usernameMigration: 6a943438cb3b047ca24d2301d74771e5f1699c4df4d7bc58905af9782f200b72  src/migrations/forum_username_claim_v1.sql
-- usernamePostflight: 3acb1db1efdd01154224f91c2a640bc9b9b77da9ed0978ec2a8950beb917bbda  src/migrations/forum_username_claim_v1_postflight.sql
-- moderationPreflight: 9346899077404d94440b71f5948c9cfe3e19a85f3981f6678d02051ab3c4e088  src/migrations/forum_moderation_context_v1_preflight.sql
-- moderationAudit: 51180449732975a434d9b4a455a6643f36f673859765befe752d12f6991a753c  src/migrations/forum_moderation_context_v1_audit.sql
-- moderationMigration: 3e3c1c0c6399ed1fe3f05644869ae866876d9e494000bacc5406d16f65ca40db  src/migrations/forum_moderation_context_v1.sql
-- moderationPostflight: 8e4bcf635033aabaac581ef2c1ffb49ebc4622beea879832fb8913b9d9c5e83a  src/migrations/forum_moderation_context_v1_postflight.sql
-- dismissalPreflight: acddafe571da9a2aa580446227ed33c16c43f757f97e37da3c564355222bc5e0  src/migrations/forum_report_dismissal_v1_preflight.sql
-- dismissalAudit: f51cce8f708b6a8689a070049e4a516cf4617f250c7476ec2e3b6daf4772f4b3  src/migrations/forum_report_dismissal_v1_audit.sql
-- dismissalMigration: b8cd78449234a6ac5ab38c1abf8281a6dcf1213b68db3a478b1607e6b11c2480  src/migrations/forum_report_dismissal_v1.sql
-- dismissalPostflight: 592b0aa5c32d7a42f26ffc25988115d1b059f3dc41193c47c75b1e648d57b084  src/migrations/forum_report_dismissal_v1_postflight.sql

-- Exact reviewed core preflight, unchanged.
-- FORUM v1 read-only preflight.
-- Run against the intended target before forum_v1.sql. It changes nothing and
-- refuses a partial/previous forum installation rather than guessing at drift.

begin transaction read only;

do $$
declare
  missing text[] := '{}'::text[];
  existing text[] := '{}'::text[];
  object_name text;
begin
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'public.profiles');
  end if;
  if to_regprocedure('public.is_admin()') is null then
    missing := array_append(missing, 'public.is_admin()');
  end if;
  if to_regprocedure('auth.uid()') is null then
    missing := array_append(missing, 'auth.uid()');
  end if;
  if to_regprocedure('auth.role()') is null then
    missing := array_append(missing, 'auth.role()');
  end if;
  if to_regclass('auth.users') is null then
    missing := array_append(missing, 'auth.users');
  end if;

  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'id' and udt_name = 'uuid'
    ) then missing := array_append(missing, 'profiles.id uuid'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'username'
    ) then missing := array_append(missing, 'profiles.username'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'created_at'
    ) then missing := array_append(missing, 'profiles.created_at'); end if;
  end if;

  foreach object_name in array array[
    'forum_settings', 'forum_topics', 'forum_posts', 'forum_comments',
    'forum_votes', 'forum_user_stats', 'forum_reports',
    'forum_moderation_log', 'forum_suspensions', 'forum_rate_events'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: missing dependencies: %',
      array_to_string(missing, ', ');
  end if;
  if cardinality(existing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: existing forum objects require drift review: %',
      array_to_string(existing, ', ');
  end if;
end;
$$;

select
  current_database() as database_name,
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.is_admin()') is not null as admin_guard_ready,
  false as database_changed;

commit;

begin transaction read only;
set local statement_timeout = '60s';
do $forum_production_guard$
declare
  existing text[] := '{}'::text[];
  object_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: forum production preflight requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: forum production preflight requires the empty production environment marker';
  end if;
  if to_regclass('public.profiles') is null
     or to_regclass('auth.users') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('auth.role()') is null then
    raise exception 'REFUSING: forum production preflight identity/admin dependencies are incomplete';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'REFUSING: forum production preflight browser/service roles are incomplete';
  end if;

  foreach object_name in array array[
    'forum_settings', 'forum_topics', 'forum_posts', 'forum_comments',
    'forum_votes', 'forum_user_stats', 'forum_reports',
    'forum_moderation_log', 'forum_suspensions', 'forum_rate_events',
    'forum_install_state'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;
  if cardinality(existing) > 0 then
    raise exception 'REFUSING: forum production preflight found existing forum objects: %',
      array_to_string(existing, ', ');
  end if;
  if to_regprocedure('public.forum_mode()') is not null
     or to_regprocedure('public.forum_claim_username(text)') is not null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null
     or to_regclass('public.forum_profiles_username_ci_idx') is not null then
    raise exception 'REFUSING: forum production preflight found existing forum functions or indexes';
  end if;
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'PUBLIC' and privilege_type in ('INSERT', 'UPDATE')
  ) or exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'PUBLIC' and privilege_type in ('INSERT', 'UPDATE')
  ) then
    raise exception 'REFUSING: forum production preflight cannot safely snapshot PUBLIC profile write grants';
  end if;
  if exists (
    select 1 from (
      select lower(btrim(username))
      from public.profiles
      where username is not null
      group by lower(btrim(username))
      having count(*) > 1
    ) collisions
  ) then
    raise exception 'REFUSING: forum production preflight found case-insensitive username collisions';
  end if;
end;
$forum_production_guard$;

with classified as (
  select
    username,
    username = btrim(username)
      and btrim(coalesce(username, '')) ~ '^[A-Za-z0-9_-]{3,30}$' as valid_format,
    lower(btrim(coalesce(username, ''))) ~
      '^(admin|administrator|mod|moderator|staff|support|official|system|root|automod)([-_]?[0-9]+)?$'
      or lower(btrim(coalesce(username, ''))) in (
        'anonymous', 'deleted_student', 'deleted-student',
        'fuck', 'fucker', 'bitch', 'chutiya', 'madarchod', 'bhenchod'
      )
      or lower(btrim(coalesce(username, ''))) ~ '^jeeneetards?(help)?([-_].*)?$'
      as reserved
  from public.profiles
), collisions as (
  select count(*)::integer as groups
  from (
    select lower(btrim(username))
    from public.profiles where username is not null
    group by lower(btrim(username)) having count(*) > 1
  ) duplicate_groups
)
select
  count(*)::integer as profile_rows,
  count(*) filter (where username is not null and valid_format and not reserved)::integer
    as valid_usernames,
  count(*) filter (where username is null or not valid_format)::integer
    as missing_or_invalid_usernames,
  count(*) filter (where username is not null and reserved)::integer
    as reserved_usernames,
  (select groups from collisions) as case_insensitive_collision_groups,
  has_table_privilege('anon', 'public.profiles', 'INSERT') as anon_profile_insert,
  has_table_privilege('anon', 'public.profiles', 'UPDATE') as anon_profile_update,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated_profile_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as authenticated_profile_update
from classified;

select
  current_database() as database_name,
  'empty-production-marker'::text as environment_guard,
  false as database_changed;
commit;
