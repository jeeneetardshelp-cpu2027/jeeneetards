-- FORUM ADMIN IDENTITY TRANSFER POSTFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_identity_transfer_postflight$
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: transfer postflight requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_admin_transfer_state') is null
     or to_regprocedure('auth.role()') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.protect_profile_admin_flag()') is null then
    raise exception 'REFUSING: transfer postflight production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1
     or public.forum_mode() is distinct from 'off'
     or (select count(*) from public.profiles where is_admin) <> 1
     or (select count(*) from public.forum_admin_transfer_state) <> 1 then
    raise exception 'REFUSING: transfer postflight state drifted';
  end if;
  if current_user <> 'postgres'
     or session_user <> 'postgres'
     or coalesce(auth.role(), '') <> '' then
    raise exception 'REFUSING: transfer postflight requires the reviewed SQL Editor postgres context';
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
  if not exists (
    select 1
    from pg_class c
    where c.oid = 'public.forum_admin_transfer_state'::regclass
      and c.relrowsecurity
      and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not exists (
        select 1 from aclexplode(coalesce(c.relacl, '{}'::aclitem[])) a
        where a.grantee = 0
      )
  ) then
    raise exception 'REFUSING: transfer postflight state-table security does not match';
  end if;
  if not exists (
    select 1
    from public.forum_admin_transfer_state s
    join public.profiles target on target.id = s.target_admin_id
    join auth.users u on u.id = target.id
    join public.profiles previous on previous.id = s.previous_admin_id
    where s.id = true
      and s.rolled_back_at is null
      and lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and target.username = 'alecc_daddy'
      and target.is_admin
      and not previous.is_admin
  ) then
    raise exception 'REFUSING: transfer postflight identity or role state does not match';
  end if;
end;
$forum_admin_identity_transfer_postflight$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 1
    as exactly_one_admin,
  true as exact_target_is_admin,
  true as previous_admin_demoted,
  true as rollback_state_captured,
  true as transfer_state_locked_down,
  true as admin_protection_trigger_enabled,
  true as claim_role_restored,
  false as database_changed;

commit;
