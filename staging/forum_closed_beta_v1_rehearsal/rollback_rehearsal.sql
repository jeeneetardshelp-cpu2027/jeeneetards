-- ============================================================================
-- FORUM CLOSED-BETA v1 ROLLBACK-ALWAYS STAGING REHEARSAL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Exact migration SHA-256: b750988752e3056bab1e149d1abaca8fbeda8360500677d8179db50ce82ac9ec
-- Generated from pinned preflight, audit, migration and postflight sources.
-- The migration/postflight wrappers are removed only so the complete delta,
-- role checks and fixtures can end in one unconditional ROLLBACK.
-- ============================================================================

-- Exact read-only gates run before the rehearsal transaction.
-- Read-only preflight for the forum closed-beta delta.
begin transaction read only;

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

rollback;

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


begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $forum_beta_stage_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and lower(name) = 'staging';
  if environment_count <> 1 then
    raise exception 'REFUSING: beta rehearsal requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_posts') is null
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
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_reports) then
    raise exception 'REFUSING: beta rehearsal requires an empty disposable forum';
  end if;
end;
$forum_beta_stage_guard$;

-- Exact reviewed migration, with only its outer BEGIN/COMMIT removed.
-- SOURCE SHA-256: b750988752e3056bab1e149d1abaca8fbeda8360500677d8179db50ce82ac9ec
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


-- Exact structural postflight inside the rollback-always transaction.
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


do $forum_beta_stage_identities$
declare
  admin_id uuid;
  students uuid[];
begin
  select p.id into admin_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_admin is true
  order by p.created_at, p.id limit 1;

  select array_agg(id order by created_at, id) into students
  from (
    select p.id, u.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p.is_admin, false) is false
      and u.created_at <= now() - interval '10 minutes'
      and p.id is distinct from admin_id
    order by u.created_at, p.id limit 2
  ) candidates;

  if admin_id is null then
    raise exception 'REFUSING: staging needs one admin profile';
  end if;
  if coalesce(cardinality(students), 0) <> 2 then
    raise exception 'REFUSING: staging needs two non-admin users older than 10 minutes';
  end if;

  perform set_config('forum_beta_stage.admin', admin_id::text, true);
  perform set_config('forum_beta_stage.member', students[1]::text, true);
  perform set_config('forum_beta_stage.outsider', students[2]::text, true);
  update public.profiles
  set username = case id
    when admin_id then 'cba_' || right(replace(id::text, '-', ''), 26)
    when students[1] then 'cbm_' || right(replace(id::text, '-', ''), 26)
    else 'cbo_' || right(replace(id::text, '-', ''), 26)
  end
  where id = admin_id or id = any(students);
  perform set_config(
    'forum_beta_stage.member_username',
    (select username from public.profiles where id = students[1]), true
  );
  perform set_config(
    'forum_beta_stage.outsider_username',
    (select username from public.profiles where id = students[2]), true
  );
end;
$forum_beta_stage_identities$;

create function public.__forum_beta_stage_write_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_create_post(
    'physics', 'This non-member post must be rejected',
    'The closed beta writer gate must reject this body.'
  );
  raise exception 'BETA TEST: non-member publishing unexpectedly succeeded';
exception when sqlstate '42501' then
  if sqlerrm not like 'closed beta access is required%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_write_denied() from public;
grant execute on function public.__forum_beta_stage_write_denied() to authenticated;

create function public.__forum_beta_stage_read_only_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_create_post(
    'physics', 'This member post must be paused',
    'Read only mode must still reject a beta member.'
  );
  raise exception 'BETA TEST: read-only publishing unexpectedly succeeded';
exception when sqlstate '55000' then
  if sqlerrm not like 'forum is not open%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_read_only_denied() from public;
grant execute on function public.__forum_beta_stage_read_only_denied() to authenticated;

create function public.__forum_beta_stage_admin_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_admin_set_beta_member(
    current_setting('forum_beta_stage.outsider_username'), true
  );
  raise exception 'BETA TEST: non-admin membership mutation unexpectedly succeeded';
exception when sqlstate '42501' then
  if sqlerrm not like 'not authorized%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_admin_denied() from public;
grant execute on function public.__forum_beta_stage_admin_denied() to authenticated;

create function public.__forum_beta_stage_table_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.forum_beta_members limit 1;
  raise exception 'BETA TEST: direct membership table read unexpectedly succeeded';
exception when insufficient_privilege then return true;
end;
$$;
revoke all on function public.__forum_beta_stage_table_denied() from public;
grant execute on function public.__forum_beta_stage_table_denied() to authenticated;

-- Admin enrolls one student and opens only the closed beta.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_beta_member(
  current_setting('forum_beta_stage.member_username'), true
) as member_enabled;
select public.forum_admin_set_mode('beta') as beta_mode;
reset role;

-- Member publishes successfully.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.member'), true);
set local role authenticated;
select set_config(
  'forum_beta_stage.post_id',
  public.forum_create_post(
    'physics', 'Closed beta force question',
    'I drew the free-body diagram and need help checking the direction.'
  )::text, true
);
select public.forum_create_comment(
  current_setting('forum_beta_stage.post_id')::bigint, null,
  'This member comment proves the shared writer gate.'
) as member_comment;
reset role;

-- Non-member cannot publish or administer membership, cannot read the private
-- table, but can still submit an authenticated safety report.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.outsider'), true);
set local role authenticated;
select public.forum_is_beta_member() as outsider_is_member;
select public.__forum_beta_stage_write_denied() as outsider_write_denied;
select public.__forum_beta_stage_admin_denied() as outsider_admin_denied;
select public.__forum_beta_stage_table_denied() as outsider_table_denied;
select public.forum_submit_report(
  'post', current_setting('forum_beta_stage.post_id')::bigint,
  'other', 'Safety reporting remains available during beta.'
) as outsider_report;
reset role;

-- Anonymous reading remains available, but anonymous beta RPC execution does not.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select count(*) as anonymous_topics from public.get_forum_topics();
select count(*) as anonymous_feed_rows from public.get_forum_feed();
reset role;

-- Open mode deliberately retains later public-write behavior.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_mode('open') as open_mode;
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.outsider'), true);
set local role authenticated;
select public.forum_create_post(
  'mathematics', 'Open mode control question',
  'This succeeds only to prove public mode still has its reviewed meaning.'
) as outsider_open_post;
reset role;

-- Read-only mode still pauses enrolled beta members.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
set local role authenticated;
select public.forum_admin_set_mode('read_only') as read_only_mode;
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.member'), true);
set local role authenticated;
select public.__forum_beta_stage_read_only_denied() as member_read_only_denied;
reset role;

select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
set local role authenticated;
select public.forum_admin_set_mode('off') as restored_mode;
reset role;

do $forum_beta_stage_final_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'BETA TEST: expected mode off before rollback';
  end if;
  if (select count(*) from public.forum_beta_members) <> 1 then
    raise exception 'BETA TEST: expected exactly one beta member';
  end if;
  if (select count(*) from public.forum_posts) <> 2
     or (select count(*) from public.forum_comments) <> 1
     or (select count(*) from public.forum_reports) <> 1 then
    raise exception 'BETA TEST: fixture counts drifted';
  end if;
  if (select count(*) from public.forum_moderation_log where action = 'beta_add') <> 1 then
    raise exception 'BETA TEST: membership audit row missing';
  end if;
  if has_function_privilege('anon', 'public.forum_is_beta_member()', 'execute') then
    raise exception 'BETA TEST: anonymous membership execution leaked';
  end if;
end;
$forum_beta_stage_final_assert$;

-- The only terminal action for a successful rehearsal.
rollback;

-- All fields in this final row must be true.
select
  (select lower(name) = 'staging' from public.app_environment where id = true)
    as environment_is_staging,
  to_regclass('public.forum_beta_members') is null as beta_table_removed,
  to_regprocedure('public.forum_is_beta_member()') is null as beta_check_removed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
    as beta_admin_removed,
  public.forum_mode() = 'off' as forum_mode_restored,
  not exists (select 1 from public.forum_posts) as no_posts_created,
  not exists (select 1 from public.forum_reports) as no_reports_created;
