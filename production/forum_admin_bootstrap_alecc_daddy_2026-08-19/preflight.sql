-- ============================================================================
-- FORUM ADMIN BOOTSTRAP PREFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE GRANT.
-- ============================================================================

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_bootstrap_preflight$
declare
  target_rows integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: admin bootstrap requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: admin bootstrap requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: admin bootstrap production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: admin bootstrap requires exactly one Forum v1 install-state row';
  end if;
  if public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: admin bootstrap requires forum mode off';
  end if;
  if (select count(*) from public.profiles where is_admin) <> 0 then
    raise exception 'REFUSING: admin bootstrap requires zero existing administrators';
  end if;
  if not public.forum_username_is_allowed('alecc_daddy') then
    raise exception 'REFUSING: target username no longer passes the reviewed forum rule';
  end if;

  select count(*) into target_rows
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and not p.is_admin;

  if target_rows <> 1 then
    raise exception 'REFUSING: expected exactly one confirmed non-admin target matching the exact email and username';
  end if;
end;
$forum_admin_bootstrap_preflight$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 0
    as zero_existing_admins,
  (
    select count(*) = 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and not p.is_admin
  ) as exact_confirmed_target_ready,
  false as database_changed;

commit;
