-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION ROLLBACK - DESTRUCTIVE, GUARDED, PRE-BETA ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE EXACT-HASH APPROVAL.
--
-- This removes only the closed-beta delta. It refuses unless mode is OFF,
-- there are no beta members, and the Forum v1 baseline remains unused.
-- ============================================================================
-- preflight: a920d6ac100002d9d5d469055c8cf0f31b27c8b73a46af5422c88755ba142bb9  src/migrations/forum_closed_beta_v1_preflight.sql
-- audit: fc4858c213075dee47807608d02db2c7675bce566daad6d347c9d66e3a5aa352  src/migrations/forum_closed_beta_v1_audit.sql
-- migration: b750988752e3056bab1e149d1abaca8fbeda8360500677d8179db50ce82ac9ec  src/migrations/forum_closed_beta_v1.sql
-- postflight: 08375e83443c3eb12efc292f355dfba2f4d6b56f87ec05169b9e534faeaca020  src/migrations/forum_closed_beta_v1_postflight.sql
-- rollback: 8b3fe83b4d5f5580e0e24bd0e7010f9d222a895c6e7879cc94746ac0b876e3cb  src/migrations/forum_closed_beta_v1_rollback.sql

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

do $forum_beta_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: closed-beta production rollback requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: closed-beta production rollback requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: closed-beta production rollback requires the reviewed Forum v1 production baseline';
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
    raise exception 'REFUSING: closed-beta production rollback Forum v1 objects are incomplete';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: closed-beta production rollback requires forum mode off';
  end if;
  if (exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)) then
    raise exception 'REFUSING: closed-beta production rollback requires an unused Forum v1 baseline';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'REFUSING: closed-beta production rollback requires the six reviewed launch topics';
  end if;
  if to_regclass('public.forum_beta_members') is null
     or to_regprocedure('public.forum_is_beta_member()') is null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
     or to_regprocedure('public.forum_admin_list_beta_members()') is null then
    raise exception 'REFUSING: closed-beta production rollback closed-beta installation is incomplete';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'REFUSING: closed-beta production rollback found beta members';
  end if;
end;
$forum_beta_production_guard$;

-- Exact reviewed rollback operations. Only the staging guard and outer
-- transaction wrapper from the source rollback are replaced.
drop function public.forum_admin_list_beta_members();
drop function public.forum_admin_set_beta_member(text,boolean);
drop function public.forum_is_beta_member();
drop table public.forum_beta_members;

delete from public.forum_moderation_log
where action in ('beta_add', 'beta_remove');

alter table public.forum_moderation_log
  drop constraint forum_moderation_log_action_check;
alter table public.forum_moderation_log
  add constraint forum_moderation_log_action_check
  check (action in (
    'hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve',
    'auto_hide', 'suspend', 'unsuspend', 'set_mode'
  ));

alter table public.forum_settings
  drop constraint forum_settings_mode_check;
alter table public.forum_settings
  add constraint forum_settings_mode_check
  check (mode in ('off', 'read_only', 'open'));

create or replace function public.forum_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.forum_mode() <> 'open' then
    raise exception using errcode = '55000', message = 'forum is not open for contributions';
  end if;
end;
$$;

create or replace function public.forum_require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.forum_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to contribute';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if not public.forum_username_is_allowed(handle) then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before contributing';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can contribute after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'forum posting is temporarily suspended';
  end if;
  return uid;
end;
$$;

create or replace function public.forum_admin_set_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_mode not in ('off', 'read_only', 'open') then
    raise exception using errcode = '22023', message = 'invalid forum mode';
  end if;
  update public.forum_settings
  set mode = p_mode, updated_at = now(), updated_by = actor where id = true;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, reason)
  values (actor, 'set_mode', 'forum', p_mode);
  return p_mode;
end;
$$;

do $forum_beta_production_rollback_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'closed-beta production rollback: forum mode drifted';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'closed-beta production rollback: beta objects remain';
  end if;
  if to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_list_reports(integer)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'closed-beta production rollback: Forum v1 baseline was damaged';
  end if;
end;
$forum_beta_production_rollback_assert$;

notify pgrst, 'reload schema';
commit;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_beta_members') is null as beta_table_removed,
  to_regprocedure('public.forum_is_beta_member()') is null as beta_check_removed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
    as beta_admin_write_removed,
  to_regprocedure('public.forum_admin_list_beta_members()') is null
    as beta_admin_list_removed,
  to_regclass('public.forum_settings') is not null as baseline_forum_retained,
  to_regprocedure('public.forum_claim_username(text)') is not null as username_claim_retained,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained;
