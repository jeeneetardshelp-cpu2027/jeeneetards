-- FORUM ADMIN IDENTITY TRANSFER AUDIT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_identity_transfer_audit$
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: transfer audit requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('auth.role()') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.protect_profile_admin_flag()') is null then
    raise exception 'REFUSING: transfer audit production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1
     or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: transfer audit requires the reviewed Forum v1 baseline with mode off';
  end if;
  if current_user <> 'postgres'
     or session_user <> 'postgres'
     or coalesce(auth.role(), '') <> '' then
    raise exception 'REFUSING: transfer audit requires the reviewed SQL Editor postgres context';
  end if;
  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'trg_protect_profile_admin_flag'
      and not t.tgisinternal
      and t.tgenabled = 'O'
      and t.tgfoid = 'public.protect_profile_admin_flag()'::regprocedure
  ) then
    raise exception 'REFUSING: profile admin-protection trigger does not match';
  end if;
end;
$forum_admin_identity_transfer_audit$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_admin_transfer_state') is null
    as transfer_state_table_absent,
  (select count(*)::integer from public.profiles where is_admin)
    as total_admins,
  (
    select count(*) = 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin
      and p.username is null
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) <> 'jeeneetardshelp@gmail.com'
  ) as existing_admin_ready,
  (
    select count(*) = 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and not p.is_admin
  ) as exact_target_ready,
  public.forum_username_is_allowed('alecc_daddy')
    as target_username_allowed,
  true as sql_editor_context_ready,
  true as admin_protection_trigger_ready,
  false as database_changed;

commit;
