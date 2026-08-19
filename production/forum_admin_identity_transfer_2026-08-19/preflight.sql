-- FORUM ADMIN IDENTITY TRANSFER PREFLIGHT - READ ONLY, FAIL CLOSED
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_identity_transfer_preflight$
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: transfer preflight requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: transfer preflight production baseline is incomplete';
  end if;
  if to_regclass('public.forum_admin_transfer_state') is not null then
    raise exception 'REFUSING: transfer state already exists';
  end if;
  if (select count(*) from public.forum_install_state) <> 1
     or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: transfer preflight requires the reviewed Forum v1 baseline with mode off';
  end if;
  if (select count(*) from public.profiles where is_admin) <> 1 then
    raise exception 'REFUSING: transfer preflight requires exactly one current administrator';
  end if;
  if not public.forum_username_is_allowed('alecc_daddy') then
    raise exception 'REFUSING: target username no longer passes the reviewed forum rule';
  end if;
  if (
    select count(*)
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin
      and p.username is null
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) <> 'jeeneetardshelp@gmail.com'
  ) <> 1 then
    raise exception 'REFUSING: current administrator no longer matches the audited identity shape';
  end if;
  if (
    select count(*)
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
      and not p.is_admin
  ) <> 1 then
    raise exception 'REFUSING: confirmed target identity is not uniquely ready';
  end if;
end;
$forum_admin_identity_transfer_preflight$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_admin_transfer_state') is null
    as transfer_state_table_absent,
  (select count(*) from public.profiles where is_admin) = 1
    as exactly_one_current_admin,
  true as audited_identity_shape_matches,
  false as database_changed;

commit;
