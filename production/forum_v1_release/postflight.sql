-- ============================================================================
-- FORUM v1 PRODUCTION POSTFLIGHT — READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
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

begin transaction read only;
do $forum_production_postflight_guard$
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: production postflight requires the empty production marker';
  end if;
  if to_regclass('public.forum_install_state') is null then
    raise exception 'REFUSING: production postflight install state is missing';
  end if;
end;
$forum_production_postflight_guard$;
commit;

-- Exact reviewed structural postflights, unchanged.
-- FORUM v1 read-only structural postflight.
-- It creates no fixtures and changes no forum state.

begin transaction read only;

do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.forum_settings') is null then missing := array_append(missing, 'forum_settings'); end if;
  if to_regclass('public.forum_topics') is null then missing := array_append(missing, 'forum_topics'); end if;
  if to_regclass('public.forum_posts') is null then missing := array_append(missing, 'forum_posts'); end if;
  if to_regclass('public.forum_comments') is null then missing := array_append(missing, 'forum_comments'); end if;
  if to_regclass('public.forum_votes') is null then missing := array_append(missing, 'forum_votes'); end if;
  if to_regclass('public.forum_user_stats') is null then missing := array_append(missing, 'forum_user_stats'); end if;
  if to_regclass('public.forum_reports') is null then missing := array_append(missing, 'forum_reports'); end if;
  if to_regclass('public.forum_moderation_log') is null then missing := array_append(missing, 'forum_moderation_log'); end if;
  if to_regclass('public.forum_suspensions') is null then missing := array_append(missing, 'forum_suspensions'); end if;
  if to_regclass('public.forum_rate_events') is null then missing := array_append(missing, 'forum_rate_events'); end if;

  if to_regprocedure('public.forum_mode()') is null then missing := array_append(missing, 'forum_mode()'); end if;
  if to_regprocedure('public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)') is null then
    missing := array_append(missing, 'get_forum_feed()');
  end if;
  if to_regprocedure('public.forum_create_post(text,text,text)') is null then missing := array_append(missing, 'forum_create_post()'); end if;
  if to_regprocedure('public.forum_cast_vote(text,bigint,smallint)') is null then missing := array_append(missing, 'forum_cast_vote()'); end if;
  if to_regprocedure('public.forum_submit_report(text,bigint,text,text)') is null then missing := array_append(missing, 'forum_submit_report()'); end if;
  if to_regprocedure('public.forum_admin_moderate(text,bigint,text,text,bigint)') is null then missing := array_append(missing, 'forum_admin_moderate()'); end if;
  if to_regprocedure('public.forum_recount_karma(boolean)') is null then missing := array_append(missing, 'forum_recount_karma()'); end if;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 POSTFLIGHT: missing: %', array_to_string(missing, ', ');
  end if;

  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'FORUM v1 POSTFLIGHT: forum did not fail closed';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'FORUM v1 POSTFLIGHT: expected six active launch topics';
  end if;
  if exists (
    select 1 from public.forum_topics where slug in ('motivation', 'general') and is_active
  ) then raise exception 'FORUM v1 POSTFLIGHT: deferred topics are active'; end if;

  if has_table_privilege('anon', 'public.forum_posts', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_posts', 'INSERT')
     or has_table_privilege('authenticated', 'public.forum_votes', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_moderation_log', 'UPDATE') then
    raise exception 'FORUM v1 POSTFLIGHT: direct browser table privilege leaked';
  end if;
  if not has_function_privilege(
    'anon',
    'public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)',
    'EXECUTE'
  ) then raise exception 'FORUM v1 POSTFLIGHT: anonymous feed RPC missing'; end if;
  if has_function_privilege('anon', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous create RPC leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: authenticated create RPC missing';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_set_mode(text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous mode control leaked';
  end if;
end;
$$;

select
  (select mode from public.forum_settings where id = true) as forum_mode,
  (select count(*) from public.forum_topics where is_active) as active_topics,
  (select count(*) from public.forum_posts) as posts,
  (select count(*) from public.forum_comments) as comments,
  (select count(*) from public.forum_reports where status = 'pending') as pending_reports,
  false as database_changed;

commit;
begin transaction read only;

do $$
begin
  if to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_get_my_identity()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null then
    raise exception 'username claim postflight: required functions are missing';
  end if;
  if to_regclass('public.forum_profiles_username_ci_idx') is null then
    raise exception 'username claim postflight: case-insensitive unique index is missing';
  end if;
  if has_function_privilege('anon', 'public.forum_claim_username(text)', 'execute') then
    raise exception 'username claim postflight: anonymous claim grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_claim_username(text)', 'execute') then
    raise exception 'username claim postflight: authenticated claim grant missing';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'username', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'username', 'insert') then
    raise exception 'username claim postflight: direct browser username write leaked';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'update')
     or not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update') then
    raise exception 'username claim postflight: ordinary profile editing grant was lost';
  end if;
end;
$$;

rollback;
-- Read-only structural and grant verification for moderation context v1.
begin transaction read only;

do $$
declare
  result_contract text;
begin
  if to_regprocedure('public.forum_admin_list_reports(integer)') is null then
    raise exception 'moderation context postflight: report-list RPC is missing';
  end if;
  select pg_get_function_result('public.forum_admin_list_reports(integer)'::regprocedure)
    into result_contract;
  if result_contract not like '%post_id bigint%'
     or result_contract not like '%content_preview text%'
     or result_contract not like '%target_exists boolean%'
     or result_contract not like '%post_is_locked boolean%' then
    raise exception 'moderation context postflight: enriched result contract is incomplete';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_list_reports(integer)', 'execute') then
    raise exception 'moderation context postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_list_reports(integer)', 'execute') then
    raise exception 'moderation context postflight: authenticated execute grant is missing';
  end if;
end;
$$;

rollback;
-- Read-only structural and grant verification for report dismissal v1.
begin transaction read only;

do $$
declare
  function_is_security_definer boolean;
  function_config text[];
begin
  if to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'report dismissal postflight: dismissal RPC is missing';
  end if;
  select prosecdef, proconfig
    into function_is_security_definer, function_config
  from pg_proc
  where oid = 'public.forum_admin_dismiss_report(bigint)'::regprocedure;
  if not function_is_security_definer
     or not coalesce(function_config, array[]::text[]) @> array['search_path=""'] then
    raise exception 'report dismissal postflight: security-definer search path is not fail closed';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_dismiss_report(bigint)', 'execute') then
    raise exception 'report dismissal postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_dismiss_report(bigint)', 'execute') then
    raise exception 'report dismissal postflight: authenticated execute grant is missing';
  end if;
  if has_table_privilege('authenticated', 'public.forum_reports', 'update') then
    raise exception 'report dismissal postflight: authenticated direct report update leaked';
  end if;
end;
$$;

rollback;

begin transaction read only;
do $forum_production_postflight_assert$
declare
  leaked record;
begin
  if public.forum_mode() <> 'off' then
    raise exception 'production postflight: forum mode is not off';
  end if;
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name like 'forum\_%' escape '\'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) or exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name like 'forum\_%' escape '\'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    select grantee, table_name, privilege_type into leaked
    from information_schema.table_privileges
    where table_schema = 'public' and table_name like 'forum\_%' escape '\'
      and grantee in ('PUBLIC', 'anon', 'authenticated') limit 1;
    raise exception 'production postflight: browser table privilege leaked: %.% %',
      leaked.grantee, leaked.table_name, leaked.privilege_type;
  end if;
  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'forum\_%' escape '\' or p.proname like 'get_forum\_%' escape '\')
      and p.prosecdef
      and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  ) then
    raise exception 'production postflight: a forum security-definer function has a mutable search path';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6
     or exists (select 1 from public.forum_topics where slug in ('motivation', 'general') and is_active) then
    raise exception 'production postflight: launch topic set drifted';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events) then
    raise exception 'production postflight: unexpected forum data exists';
  end if;
end;
$forum_production_postflight_assert$;

select
  public.forum_mode() as forum_mode,
  (select count(*) from public.forum_topics where is_active) as active_topics,
  (select count(*) from public.forum_posts) as posts,
  (select count(*) from public.forum_comments) as comments,
  (select count(*) from public.forum_reports) as reports,
  to_regprocedure('public.forum_claim_username(text)') is not null as username_claim_ready,
  to_regprocedure('public.forum_admin_list_reports(integer)') is not null as moderation_context_ready,
  to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as dismissal_ready,
  false as database_changed;
commit;
