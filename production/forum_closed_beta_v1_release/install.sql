-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION INSTALL - ATOMIC, NON-IDEMPOTENT, MODE OFF
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE EXACT-HASH APPROVAL.
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
    raise exception 'REFUSING: closed-beta production install requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: closed-beta production install requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: closed-beta production install requires the reviewed Forum v1 production baseline';
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
    raise exception 'REFUSING: closed-beta production install Forum v1 objects are incomplete';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: closed-beta production install requires forum mode off';
  end if;
  if (exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)) then
    raise exception 'REFUSING: closed-beta production install requires an unused Forum v1 baseline';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'REFUSING: closed-beta production install requires the six reviewed launch topics';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'REFUSING: closed-beta production install found existing closed-beta objects';
  end if;
end;
$forum_beta_production_guard$;

-- Exact reviewed closed-beta preflight with only its transaction removed.
-- Read-only preflight for the forum closed-beta delta.
do $$
declare
  mode_contract text;
  moderation_action_contract text;
begin
  if to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.profiles') is null then
    raise exception 'forum closed-beta preflight: required forum tables are missing';
  end if;
  if to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_require_open()') is null
     or to_regprocedure('public.forum_require_writer()') is null
     or to_regprocedure('public.forum_admin_set_mode(text)') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'forum closed-beta preflight: required forum functions are missing';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'forum closed-beta preflight: forum mode must be off';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'forum closed-beta preflight: beta objects already exist; review drift before retrying';
  end if;

  select pg_get_constraintdef(oid) into mode_contract
  from pg_constraint
  where conrelid = 'public.forum_settings'::regclass
    and conname = 'forum_settings_mode_check';
  if mode_contract is null
     or mode_contract not like '%read_only%'
     or mode_contract not like '%open%'
     or mode_contract like '%beta%' then
    raise exception 'forum closed-beta preflight: forum mode constraint has drifted';
  end if;

  select pg_get_constraintdef(oid) into moderation_action_contract
  from pg_constraint
  where conrelid = 'public.forum_moderation_log'::regclass
    and conname = 'forum_moderation_log_action_check';
  if moderation_action_contract is null
     or moderation_action_contract like '%beta_add%'
     or moderation_action_contract like '%beta_remove%' then
    raise exception 'forum closed-beta preflight: moderation action constraint has drifted';
  end if;
end;
$$;

-- Exact reviewed closed-beta migration with only its transaction removed.
-- Forum closed beta v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight and audit first.
alter table public.forum_settings
  drop constraint forum_settings_mode_check;
alter table public.forum_settings
  add constraint forum_settings_mode_check
  check (mode in ('off', 'read_only', 'beta', 'open'));

alter table public.forum_moderation_log
  drop constraint forum_moderation_log_action_check;
alter table public.forum_moderation_log
  add constraint forum_moderation_log_action_check
  check (action in (
    'hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve',
    'auto_hide', 'suspend', 'unsuspend', 'set_mode', 'beta_add', 'beta_remove'
  ));

create table public.forum_beta_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null
);

alter table public.forum_beta_members enable row level security;
revoke all on table public.forum_beta_members
  from public, anon, authenticated, service_role;

create function public.forum_is_beta_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null and exists (
      select 1 from public.forum_beta_members m where m.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.forum_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.forum_mode() not in ('beta', 'open') then
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
  if public.forum_mode() = 'beta' and not public.forum_is_beta_member() then
    raise exception using errcode = '42501', message = 'closed beta access is required';
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
  if p_mode not in ('off', 'read_only', 'beta', 'open') then
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

create function public.forum_admin_set_beta_member(
  p_username text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  candidate text := btrim(coalesce(p_username, ''));
  target_user uuid;
  affected_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'beta membership state is required';
  end if;
  select p.id into target_user
  from public.profiles p
  where lower(btrim(p.username)) = lower(candidate)
    and public.forum_username_is_allowed(p.username);
  if target_user is null then
    raise exception using errcode = 'P0002', message = 'beta student username not found';
  end if;

  if p_enabled then
    insert into public.forum_beta_members (user_id, added_by)
    values (target_user, actor)
    on conflict (user_id) do nothing;
  else
    delete from public.forum_beta_members where user_id = target_user;
  end if;
  get diagnostics affected_rows = row_count;

  if affected_rows > 0 then
    insert into public.forum_moderation_log
      (actor_id, action, target_type, target_user_id, reason)
    values (
      actor,
      case when p_enabled then 'beta_add' else 'beta_remove' end,
      'user',
      target_user,
      'closed beta membership'
    );
  end if;
  return exists (
    select 1 from public.forum_beta_members where user_id = target_user
  );
end;
$$;

create function public.forum_admin_list_beta_members()
returns table (
  username text,
  added_at timestamptz,
  added_by_username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select p.username, m.added_at, adder.username
  from public.forum_beta_members m
  join public.profiles p on p.id = m.user_id
  left join public.profiles adder on adder.id = m.added_by
  order by lower(p.username), p.id;
end;
$$;

revoke all on function public.forum_is_beta_member()
  from public, anon, authenticated;
revoke all on function public.forum_admin_set_beta_member(text,boolean)
  from public, anon, authenticated;
revoke all on function public.forum_admin_list_beta_members()
  from public, anon, authenticated;
grant execute on function public.forum_is_beta_member()
  to authenticated, service_role;
grant execute on function public.forum_admin_set_beta_member(text,boolean)
  to authenticated, service_role;
grant execute on function public.forum_admin_list_beta_members()
  to authenticated, service_role;

notify pgrst, 'reload schema';

-- Exact reviewed closed-beta postflight with only its transaction removed.
-- Read-only structural and grant verification for forum closed beta v1.
do $$
declare
  mode_contract text;
  moderation_action_contract text;
  function_name text;
  function_is_security_definer boolean;
  function_config text[];
begin
  if to_regclass('public.forum_beta_members') is null then
    raise exception 'forum closed-beta postflight: beta membership table is missing';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'forum closed-beta postflight: migration changed forum mode';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'forum closed-beta postflight: migration created beta members';
  end if;

  select pg_get_constraintdef(oid) into mode_contract
  from pg_constraint
  where conrelid = 'public.forum_settings'::regclass
    and conname = 'forum_settings_mode_check';
  if mode_contract is null or mode_contract not like '%beta%' then
    raise exception 'forum closed-beta postflight: beta mode is absent';
  end if;
  select pg_get_constraintdef(oid) into moderation_action_contract
  from pg_constraint
  where conrelid = 'public.forum_moderation_log'::regclass
    and conname = 'forum_moderation_log_action_check';
  if moderation_action_contract is null
     or moderation_action_contract not like '%beta_add%'
     or moderation_action_contract not like '%beta_remove%' then
    raise exception 'forum closed-beta postflight: beta audit actions are absent';
  end if;

  foreach function_name in array array[
    'public.forum_is_beta_member()',
    'public.forum_admin_set_beta_member(text,boolean)',
    'public.forum_admin_list_beta_members()'
  ] loop
    if to_regprocedure(function_name) is null then
      raise exception 'forum closed-beta postflight: function % is missing', function_name;
    end if;
    select prosecdef, proconfig into function_is_security_definer, function_config
    from pg_proc where oid = to_regprocedure(function_name);
    if not function_is_security_definer
       or not coalesce(function_config, array[]::text[]) @> array['search_path=""'] then
      raise exception 'forum closed-beta postflight: function % is not fail closed', function_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.forum_beta_members', 'select')
     or has_table_privilege('authenticated', 'public.forum_beta_members', 'select')
     or has_table_privilege('authenticated', 'public.forum_beta_members', 'insert')
     or has_table_privilege('authenticated', 'public.forum_beta_members', 'update')
     or has_table_privilege('authenticated', 'public.forum_beta_members', 'delete') then
    raise exception 'forum closed-beta postflight: direct beta membership access leaked';
  end if;
  if has_function_privilege('anon', 'public.forum_is_beta_member()', 'execute')
     or has_function_privilege('anon', 'public.forum_admin_set_beta_member(text,boolean)', 'execute')
     or has_function_privilege('anon', 'public.forum_admin_list_beta_members()', 'execute') then
    raise exception 'forum closed-beta postflight: anonymous beta RPC grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_is_beta_member()', 'execute')
     or not has_function_privilege('authenticated', 'public.forum_admin_set_beta_member(text,boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.forum_admin_list_beta_members()', 'execute') then
    raise exception 'forum closed-beta postflight: authenticated beta RPC grant is missing';
  end if;
end;
$$;

do $forum_beta_production_terminal_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: forum mode is not off';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: beta members were created';
  end if;
  if (exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)) then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: forum activity was created';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: Forum v1 rollback state drifted';
  end if;
end;
$forum_beta_production_terminal_assert$;

notify pgrst, 'reload schema';
commit;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_beta_members') is not null as beta_table_installed,
  to_regprocedure('public.forum_is_beta_member()') is not null as beta_check_installed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
    as beta_admin_write_installed,
  to_regprocedure('public.forum_admin_list_beta_members()') is not null
    as beta_admin_list_installed,
  not exists (select 1 from public.forum_beta_members) as no_beta_members_created,
  not exists (select 1 from public.forum_posts) as no_posts_created,
  not exists (select 1 from public.forum_reports) as no_reports_created,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained;
