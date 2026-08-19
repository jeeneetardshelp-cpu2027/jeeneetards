-- FORUM ADMIN IDENTITY TRANSFER - MUTATING, ATOMIC, GUARDED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $forum_admin_identity_transfer_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: transfer requires public.app_environment';
  end if;
  lock table public.app_environment in share row exclusive mode;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: transfer requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: transfer production baseline is incomplete';
  end if;
  if to_regclass('public.forum_admin_transfer_state') is not null then
    raise exception 'REFUSING: transfer state already exists';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: transfer requires exactly one Forum v1 install-state row';
  end if;
  perform id from public.forum_settings where id = true for update;
  if not found or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: transfer requires forum mode off';
  end if;
  lock table public.profiles in share row exclusive mode;
  if (select count(*) from public.profiles where is_admin) <> 1 then
    raise exception 'REFUSING: transfer requires exactly one current administrator';
  end if;
  if not public.forum_username_is_allowed('alecc_daddy') then
    raise exception 'REFUSING: target username no longer passes the reviewed forum rule';
  end if;
end;
$forum_admin_identity_transfer_guard$;

create table public.forum_admin_transfer_state (
  id boolean primary key default true check (id),
  previous_admin_id uuid not null,
  target_admin_id uuid not null,
  transferred_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  check (previous_admin_id <> target_admin_id)
);
alter table public.forum_admin_transfer_state enable row level security;
revoke all on table public.forum_admin_transfer_state
  from public, anon, authenticated, service_role;

do $forum_admin_identity_transfer_apply$
declare
  previous_admin uuid;
  target_admin uuid;
  affected_rows integer;
begin
  select p.id into strict previous_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_admin
    and p.username is null
    and u.email_confirmed_at is not null
    and lower(btrim(u.email)) <> 'jeeneetardshelp@gmail.com'
  for update of p, u;

  select p.id into strict target_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and not p.is_admin
  for update of p, u;

  insert into public.forum_admin_transfer_state
    (id, previous_admin_id, target_admin_id)
  values (true, previous_admin, target_admin);

  update public.profiles
  set is_admin = case
    when id = target_admin then true
    when id = previous_admin then false
    else is_admin
  end
  where id in (previous_admin, target_admin)
    and is_admin is distinct from (id = target_admin);
  get diagnostics affected_rows = row_count;

  if affected_rows <> 2
     or (select count(*) from public.profiles where is_admin) <> 1
     or not exists (
       select 1 from public.profiles where id = target_admin and is_admin
     )
     or exists (
       select 1 from public.profiles where id = previous_admin and is_admin
     ) then
    raise exception 'REFUSING: atomic administrator transfer postcondition failed';
  end if;
end;
$forum_admin_identity_transfer_apply$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 1
    as exactly_one_admin,
  (
    select count(*) = 1
    from public.forum_admin_transfer_state s
    join public.profiles p on p.id = s.target_admin_id
    join auth.users u on u.id = p.id
    where s.id = true
      and s.rolled_back_at is null
      and lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and p.is_admin
  ) as exact_target_is_admin,
  (
    select count(*) = 1
    from public.forum_admin_transfer_state s
    join public.profiles p on p.id = s.previous_admin_id
    where s.id = true and not p.is_admin
  ) as previous_admin_demoted,
  (select count(*) from public.forum_admin_transfer_state) = 1
    as rollback_state_captured,
  (
    select c.relrowsecurity
      and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      and not exists (
        select 1 from aclexplode(coalesce(c.relacl, '{}'::aclitem[])) a
        where a.grantee = 0
      )
    from pg_class c
    where c.oid = 'public.forum_admin_transfer_state'::regclass
  ) as transfer_state_locked_down;

commit;
