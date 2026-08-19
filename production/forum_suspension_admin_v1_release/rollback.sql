-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION ROLLBACK - DESTRUCTIVE, GUARDED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.
--
-- This removes only the two username-facing wrappers. Suspension rows and
-- moderation history are deliberately retained; the reviewed UUID RPC remains.
-- ============================================================================
-- preflight: f72b8b986c51b7d4e9d8152c8fb7c7be90b74efb17c81c393daedb3463eb4860  src/migrations/forum_suspension_admin_v1_preflight.sql
-- audit: ee05eef1cddaf809a4243e42f2037ac0ccd41797f55b2c13f40096549192f6f5  src/migrations/forum_suspension_admin_v1_audit.sql
-- migration: b3aedd53e5277a61d65ceff6f2b726d284dc0b28b9891af87af86230b13da49c  src/migrations/forum_suspension_admin_v1.sql
-- postflight: 3bbb66f082dca359a8133605536baaf112d7f464cb20f8f03bb2fe80ca5bb3d1  src/migrations/forum_suspension_admin_v1_postflight.sql
-- rollback: bdbb1e893ea28530254e847e0e8b15889e54ae714e9bc82035fc89e94b073b4c  src/migrations/forum_suspension_admin_v1_rollback.sql

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
do $forum_suspension_admin_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: suspension-admin production rollback requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: suspension-admin production rollback requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: suspension-admin production rollback requires the reviewed Forum v1 production baseline';
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
    raise exception 'REFUSING: suspension-admin production rollback Forum v1 objects are incomplete';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: suspension-admin production rollback requires forum mode off';
  end if;
  if to_regprocedure(
       'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
     ) is not null then
    raise exception 'REFUSING: suspension-admin production rollback found a staging fixture helper';
  end if;
  if to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is null
     or to_regprocedure('public.forum_admin_list_suspensions()') is null then
    raise exception 'REFUSING: suspension-admin production rollback suspension-admin installation is incomplete';
  end if;
end;
$forum_suspension_admin_production_guard$;
create temporary table forum_suspension_admin_production_rollback_baseline
on commit preserve rows
as select
  (select count(*)::integer from public.profiles) as profile_rows,
  (select count(*)::integer from public.forum_posts) as post_rows,
  (select count(*)::integer from public.forum_comments) as comment_rows,
  (select count(*)::integer from public.forum_votes) as vote_rows,
  (select count(*)::integer from public.forum_user_stats) as user_stat_rows,
  (select count(*)::integer from public.forum_reports) as report_rows,
  (select count(*)::integer from public.forum_moderation_log) as moderation_log_rows,
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  (select count(*)::integer from public.forum_rate_events) as rate_event_rows;

drop function public.forum_admin_list_suspensions();
drop function public.forum_admin_set_suspension_by_username(text,integer,text);

do $forum_suspension_admin_production_rollback_assert$
begin
  if to_regprocedure(
       'public.forum_admin_set_suspension_by_username(text,integer,text)'
     ) is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'suspension-admin production rollback: wrappers remain';
  end if;
  if to_regprocedure(
       'public.forum_admin_set_suspension(uuid,timestamptz,text)'
     ) is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_moderation_log') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'suspension-admin production rollback: Forum v1 baseline was damaged';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'suspension-admin production rollback: forum mode drifted';
  end if;
end;
$forum_suspension_admin_production_rollback_assert$;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is null as set_suspension_by_username_removed,
  to_regprocedure('public.forum_admin_list_suspensions()') is null
    as list_suspensions_removed,
  to_regprocedure(
    'public.forum_admin_set_suspension(uuid,timestamptz,text)'
  ) is not null as reviewed_suspension_rpc_retained,
  (select mode from public.forum_settings where id = true) = 'off'
    as forum_mode_is_off,
  (select count(*) from public.forum_install_state) = 1
    as baseline_state_retained,

  (select count(*) from public.profiles) =
    (select profile_rows from forum_suspension_admin_production_rollback_baseline)
    as profiles_unchanged,
  (select count(*) from public.forum_posts) =
    (select post_rows from forum_suspension_admin_production_rollback_baseline)
    as posts_unchanged,
  (select count(*) from public.forum_comments) =
    (select comment_rows from forum_suspension_admin_production_rollback_baseline)
    as comments_unchanged,
  (select count(*) from public.forum_votes) =
    (select vote_rows from forum_suspension_admin_production_rollback_baseline)
    as votes_unchanged,
  (select count(*) from public.forum_user_stats) =
    (select user_stat_rows from forum_suspension_admin_production_rollback_baseline)
    as user_stats_unchanged,
  (select count(*) from public.forum_reports) =
    (select report_rows from forum_suspension_admin_production_rollback_baseline)
    as reports_unchanged,
  (select count(*) from public.forum_moderation_log) =
    (select moderation_log_rows from forum_suspension_admin_production_rollback_baseline)
    as moderation_log_unchanged,
  (select count(*) from public.forum_suspensions) =
    (select suspension_rows from forum_suspension_admin_production_rollback_baseline)
    as suspensions_unchanged,
  (select count(*) from public.forum_rate_events) =
    (select rate_event_rows from forum_suspension_admin_production_rollback_baseline)
    as rate_events_unchanged;
