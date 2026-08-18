-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION AUDIT - READ ONLY
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
    raise exception 'REFUSING: suspension-admin production audit requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: suspension-admin production audit requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: suspension-admin production audit requires the reviewed Forum v1 production baseline';
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
    raise exception 'REFUSING: suspension-admin production audit Forum v1 objects are incomplete';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: suspension-admin production audit requires forum mode off';
  end if;
  if to_regprocedure(
       'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
     ) is not null then
    raise exception 'REFUSING: suspension-admin production audit found a staging fixture helper';
  end if;
  if to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'REFUSING: suspension-admin production audit suspension-admin wrappers already exist';
  end if;
end;
$forum_suspension_admin_production_guard$;
select false as database_changed;
commit;

-- Exact reviewed counts-only source audit, unchanged.
-- Read-only suspension audit. Counts only; no username, reason text,
-- moderator identity, or student content is returned.
begin transaction read only;

select
  count(*)::integer as suspension_rows,
  count(*) filter (where suspended_until > now())::integer as active_suspensions,
  count(*) filter (where suspended_until <= now())::integer as expired_rows_not_yet_lifted,
  count(*) filter (
    where suspended_until > now() + interval '365 days'
  )::integer as suspensions_beyond_the_wrapper_limit,
  count(*) filter (where created_by is null)::integer as rows_with_no_recorded_moderator
from public.forum_suspensions;

select
  count(*) filter (where action = 'suspend')::integer as suspend_log_entries,
  count(*) filter (where action = 'unsuspend')::integer as unsuspend_log_entries
from public.forum_moderation_log;

rollback;
