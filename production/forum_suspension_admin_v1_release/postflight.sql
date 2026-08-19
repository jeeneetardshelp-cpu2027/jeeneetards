-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION POSTFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- ============================================================================
-- preflight: f72b8b986c51b7d4e9d8152c8fb7c7be90b74efb17c81c393daedb3463eb4860  src/migrations/forum_suspension_admin_v1_preflight.sql
-- audit: ee05eef1cddaf809a4243e42f2037ac0ccd41797f55b2c13f40096549192f6f5  src/migrations/forum_suspension_admin_v1_audit.sql
-- migration: b3aedd53e5277a61d65ceff6f2b726d284dc0b28b9891af87af86230b13da49c  src/migrations/forum_suspension_admin_v1.sql
-- postflight: 3bbb66f082dca359a8133605536baaf112d7f464cb20f8f03bb2fe80ca5bb3d1  src/migrations/forum_suspension_admin_v1_postflight.sql
-- rollback: bdbb1e893ea28530254e847e0e8b15889e54ae714e9bc82035fc89e94b073b4c  src/migrations/forum_suspension_admin_v1_rollback.sql

begin transaction read only;
set local statement_timeout = '60s';
do $forum_suspension_admin_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: suspension-admin production postflight requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: suspension-admin production postflight requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: suspension-admin production postflight requires the reviewed Forum v1 production baseline';
  end if;
  if to_regclass('public.profiles') is null
     or to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_votes') is null
     or to_regclass('public.forum_user_stats') is null
     or to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_rate_events') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: suspension-admin production postflight Forum v1 objects are incomplete';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: suspension-admin production postflight requires forum mode off';
  end if;
  if to_regprocedure(
       'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
     ) is not null then
    raise exception 'REFUSING: suspension-admin production postflight found a staging fixture helper';
  end if;
  if to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is null
     or to_regprocedure('public.forum_admin_list_suspensions()') is null then
    raise exception 'REFUSING: suspension-admin production postflight suspension-admin installation is incomplete';
  end if;
end;
$forum_suspension_admin_production_guard$;
select false as database_changed;
commit;

-- Exact reviewed source postflight, unchanged.
-- Read-only structural and grant verification for suspension admin v1.
begin transaction read only;

do $$
declare
  definition record;
begin
  for definition in
    select
      oid::regprocedure as signature,
      prosecdef as is_security_definer,
      coalesce(proconfig, array[]::text[]) as config
    from pg_proc
    where oid in (
      'public.forum_admin_set_suspension_by_username(text,integer,text)'::regprocedure,
      'public.forum_admin_list_suspensions()'::regprocedure
    )
  loop
    if not definition.is_security_definer
       or not definition.config @> array['search_path=""'] then
      raise exception 'suspension admin postflight: % is not fail closed', definition.signature;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.forum_admin_set_suspension_by_username(text,integer,text)', 'execute')
     or has_function_privilege('anon', 'public.forum_admin_list_suspensions()', 'execute') then
    raise exception 'suspension admin postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_set_suspension_by_username(text,integer,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.forum_admin_list_suspensions()', 'execute') then
    raise exception 'suspension admin postflight: authenticated execute grant is missing';
  end if;

  -- The browser must still never reach the suspension table directly; the
  -- security-definer wrappers are the only sanctioned path.
  if has_table_privilege('anon', 'public.forum_suspensions', 'select')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'select')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'insert')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'update')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'delete') then
    raise exception 'suspension admin postflight: direct browser access to forum_suspensions leaked';
  end if;
end;
$$;

select
  to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
    as set_suspension_by_username_ready,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_ready,
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  false as database_changed;

rollback;

begin transaction read only;
select
  (select mode from public.forum_settings where id = true) = 'off'
    as forum_mode_is_off,
  (select count(*) from public.forum_install_state) = 1
    as baseline_state_retained,
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is not null as set_suspension_by_username_installed,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_installed,
  to_regprocedure(
    'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
  ) is null as staging_fixture_helper_absent,
  false as database_changed;
commit;
