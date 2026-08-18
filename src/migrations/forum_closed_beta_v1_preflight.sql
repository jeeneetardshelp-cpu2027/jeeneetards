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
