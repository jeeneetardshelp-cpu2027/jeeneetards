-- FORUM ADMIN IDENTITY TRANSFER ROLLBACK - MUTATING, ATOMIC, GUARDED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $forum_admin_identity_transfer_rollback$
declare
  previous_admin uuid;
  target_admin uuid;
  affected_rows integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: transfer rollback requires public.app_environment';
  end if;
  lock table public.app_environment in share row exclusive mode;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: transfer rollback requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_admin_transfer_state') is null
     or to_regprocedure('public.forum_mode()') is null then
    raise exception 'REFUSING: transfer rollback production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: transfer rollback requires exactly one Forum v1 install-state row';
  end if;
  perform id from public.forum_settings where id = true for update;
  if not found or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: transfer rollback requires forum mode off';
  end if;
  lock table public.profiles in share row exclusive mode;
  lock table public.forum_admin_transfer_state in share row exclusive mode;
  if (select count(*) from public.profiles where is_admin) <> 1
     or (select count(*) from public.forum_admin_transfer_state) <> 1 then
    raise exception 'REFUSING: transfer rollback state count drifted';
  end if;

  select s.previous_admin_id, s.target_admin_id
  into strict previous_admin, target_admin
  from public.forum_admin_transfer_state s
  where s.id = true and s.rolled_back_at is null
  for update;

  if not exists (
    select 1
    from public.profiles target
    join auth.users u on u.id = target.id
    where target.id = target_admin
      and lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and target.username = 'alecc_daddy'
      and target.is_admin
  ) or not exists (
    select 1
    from public.profiles previous
    join auth.users u on u.id = previous.id
    where previous.id = previous_admin
      and previous.username is null
      and not previous.is_admin
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) <> 'jeeneetardshelp@gmail.com'
  ) then
    raise exception 'REFUSING: transfer rollback identity or role state does not match';
  end if;

  update public.profiles
  set is_admin = case
    when id = previous_admin then true
    when id = target_admin then false
    else is_admin
  end
  where id in (previous_admin, target_admin)
    and is_admin is distinct from (id = previous_admin);
  get diagnostics affected_rows = row_count;

  if affected_rows <> 2
     or (select count(*) from public.profiles where is_admin) <> 1
     or not exists (
       select 1 from public.profiles where id = previous_admin and is_admin
     )
     or exists (
       select 1 from public.profiles where id = target_admin and is_admin
     ) then
    raise exception 'REFUSING: transfer rollback postcondition failed';
  end if;

  update public.forum_admin_transfer_state
  set rolled_back_at = now()
  where id = true and rolled_back_at is null;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'REFUSING: transfer rollback could not record completion';
  end if;
end;
$forum_admin_identity_transfer_rollback$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*) from public.profiles where is_admin) = 1
    as exactly_one_admin,
  (
    select count(*) = 1
    from public.forum_admin_transfer_state s
    join public.profiles p on p.id = s.previous_admin_id
    where s.id = true and s.rolled_back_at is not null and p.is_admin
  ) as previous_admin_restored,
  (
    select count(*) = 1
    from public.forum_admin_transfer_state s
    join public.profiles p on p.id = s.target_admin_id
    where s.id = true and not p.is_admin
  ) as exact_target_is_not_admin,
  (select count(*) from public.forum_admin_transfer_state
    where rolled_back_at is not null) = 1 as rollback_recorded;

commit;
