-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION POSTFLIGHT - READ ONLY
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
    raise exception 'REFUSING: closed-beta production postflight requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: closed-beta production postflight requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: closed-beta production postflight requires the reviewed Forum v1 production baseline';
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
    raise exception 'REFUSING: closed-beta production postflight Forum v1 objects are incomplete';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: closed-beta production postflight requires forum mode off';
  end if;
  if (exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)) then
    raise exception 'REFUSING: closed-beta production postflight requires an unused Forum v1 baseline';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'REFUSING: closed-beta production postflight requires the six reviewed launch topics';
  end if;
  if to_regclass('public.forum_beta_members') is null
     or to_regprocedure('public.forum_is_beta_member()') is null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
     or to_regprocedure('public.forum_admin_list_beta_members()') is null then
    raise exception 'REFUSING: closed-beta production postflight closed-beta installation is incomplete';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'REFUSING: closed-beta production postflight found beta members';
  end if;
end;
$forum_beta_production_guard$;
select false as database_changed;
commit;

-- Exact reviewed closed-beta postflight, unchanged.
-- Read-only structural and grant verification for forum closed beta v1.
begin transaction read only;

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

rollback;

begin transaction read only;
select
  public.forum_mode() = 'off' as forum_mode_is_off,
  not exists (select 1 from public.forum_beta_members) as no_beta_members,
  not exists (select 1 from public.forum_posts) as no_posts,
  not exists (select 1 from public.forum_reports) as no_reports,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained,
  false as database_changed;
commit;
