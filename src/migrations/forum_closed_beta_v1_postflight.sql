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
