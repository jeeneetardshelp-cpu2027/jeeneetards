-- ============================================================================
-- FORUM ADMIN BOOTSTRAP GRANT - MUTATING, ATOMIC, GUARDED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $forum_admin_bootstrap_grant$
declare
  target_user uuid;
  target_rows integer;
  affected_rows integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: admin bootstrap grant requires public.app_environment';
  end if;
  lock table public.app_environment in share row exclusive mode;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: admin bootstrap grant requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: admin bootstrap grant production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: admin bootstrap grant requires exactly one Forum v1 install-state row';
  end if;
  perform id from public.forum_settings where id = true for update;
  if not found then
    raise exception 'REFUSING: admin bootstrap grant forum settings row is missing';
  end if;
  if public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: admin bootstrap grant requires forum mode off';
  end if;
  lock table public.profiles in share row exclusive mode;
  if (select count(*) from public.profiles where is_admin) <> 0 then
    raise exception 'REFUSING: admin bootstrap grant requires zero existing administrators';
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

  select p.id into strict target_user
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and not p.is_admin
  for update of u, p;

  update public.profiles
  set is_admin = true
  where id = target_user
    and username = 'alecc_daddy'
    and not is_admin;
  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'REFUSING: admin bootstrap grant did not update exactly one profile';
  end if;
  if (select count(*) from public.profiles where is_admin) <> 1
     or not exists (
       select 1 from public.profiles where id = target_user and is_admin
     ) then
    raise exception 'REFUSING: admin bootstrap grant postcondition failed';
  end if;
end;
$forum_admin_bootstrap_grant$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 1
    as exactly_one_admin,
  (
    select count(*) = 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and p.is_admin
  ) as exact_target_is_admin;

commit;
