-- ============================================================================
-- FORUM ADMIN BOOTSTRAP ROLLBACK - MUTATING, ATOMIC, GUARDED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $forum_admin_bootstrap_rollback$
declare
  target_user uuid;
  target_rows integer;
  affected_rows integer;
begin
  if to_regclass('public.app_environment') is null
     then
    raise exception 'REFUSING: admin bootstrap rollback requires public.app_environment';
  end if;
  lock table public.app_environment in share row exclusive mode;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: admin bootstrap rollback requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: admin bootstrap rollback production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1
     then
    raise exception 'REFUSING: admin bootstrap rollback requires the reviewed baseline';
  end if;
  perform id from public.forum_settings where id = true for update;
  if not found or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: admin bootstrap rollback requires forum mode off';
  end if;
  lock table public.profiles in share row exclusive mode;
  if (select count(*) from public.profiles where is_admin) <> 1 then
    raise exception 'REFUSING: admin bootstrap rollback expected exactly one administrator';
  end if;

  select count(*) into target_rows
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and p.is_admin;

  if target_rows <> 1 then
    raise exception 'REFUSING: admin bootstrap rollback target identity does not match';
  end if;

  select p.id into strict target_user
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and p.is_admin
  for update of u, p;

  update public.profiles
  set is_admin = false
  where id = target_user
    and username = 'alecc_daddy'
    and is_admin;
  get diagnostics affected_rows = row_count;

  if affected_rows <> 1
     or (select count(*) from public.profiles where is_admin) <> 0 then
    raise exception 'REFUSING: admin bootstrap rollback postcondition failed';
  end if;
end;
$forum_admin_bootstrap_rollback$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 0
    as zero_admins_restored,
  (
    select count(*) = 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and not p.is_admin
  ) as exact_target_is_not_admin;

commit;
