-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION AUDIT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- ============================================================================
-- preflight: a920d6ac100002d9d5d469055c8cf0f31b27c8b73a46af5422c88755ba142bb9  src/migrations/forum_closed_beta_v1_preflight.sql
-- audit: fc4858c213075dee47807608d02db2c7675bce566daad6d347c9d66e3a5aa352  src/migrations/forum_closed_beta_v1_audit.sql
-- migration: b750988752e3056bab1e149d1abaca8fbeda8360500677d8179db50ce82ac9ec  src/migrations/forum_closed_beta_v1.sql
-- postflight: 08375e83443c3eb12efc292f355dfba2f4d6b56f87ec05169b9e534faeaca020  src/migrations/forum_closed_beta_v1_postflight.sql
-- rollback: 8b3fe83b4d5f5580e0e24bd0e7010f9d222a895c6e7879cc94746ac0b876e3cb  src/migrations/forum_closed_beta_v1_rollback.sql

begin transaction read only;
set local statement_timeout = '60s';
do $forum_beta_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: closed-beta production audit requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: closed-beta production audit requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: closed-beta production audit requires the reviewed Forum v1 production baseline';
  end if;
  if to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_topics') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_votes') is null
     or to_regclass('public.forum_user_stats') is null
     or to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_rate_events') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_list_reports(integer)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'REFUSING: closed-beta production audit Forum v1 objects are incomplete';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: closed-beta production audit requires forum mode off';
  end if;
  if (exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)) then
    raise exception 'REFUSING: closed-beta production audit requires an unused Forum v1 baseline';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'REFUSING: closed-beta production audit requires the six reviewed launch topics';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'REFUSING: closed-beta production audit found existing closed-beta objects';
  end if;
end;
$forum_beta_production_guard$;
select false as database_changed;
commit;

-- Exact reviewed counts-only closed-beta audit, unchanged.
-- Read-only closed-beta audit. Returns counts and readiness booleans only;
-- no account ids, emails, profile names, or student content are exposed.
begin transaction read only;

select
  public.forum_mode() as forum_mode,
  (select count(*)::integer from public.forum_topics where is_active) as active_topics,
  (select count(*)::integer from public.forum_posts) as post_count,
  (select count(*)::integer from public.forum_comments) as comment_count,
  (select count(*)::integer from public.forum_reports) as report_count,
  (select count(*)::integer from public.profiles where is_admin) as admin_count,
  (select count(*)::integer from public.profiles
    where public.forum_username_is_allowed(username)) as claim_ready_profiles,
  exists (
    select 1 from public.profiles
    where is_admin and public.forum_username_is_allowed(username)
  ) as moderation_admin_ready,
  to_regclass('public.forum_beta_members') is not null as beta_table_present,
  to_regprocedure('public.forum_is_beta_member()') is not null as beta_check_present,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
    as beta_admin_write_present,
  to_regprocedure('public.forum_admin_list_beta_members()') is not null
    as beta_admin_list_present;

rollback;
