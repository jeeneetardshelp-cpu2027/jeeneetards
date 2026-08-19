-- ============================================================================
-- FORUM ADMIN BOOTSTRAP POSTFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- ============================================================================

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_bootstrap_postflight$
declare
  target_rows integer;
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: admin bootstrap postflight requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: admin bootstrap postflight production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1
     or public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: admin bootstrap postflight baseline or forum mode drifted';
  end if;
  if (select count(*) from public.profiles where is_admin) <> 1 then
    raise exception 'REFUSING: admin bootstrap postflight expected exactly one administrator';
  end if;

  select count(*) into target_rows
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
    and u.email_confirmed_at is not null
    and p.username = 'alecc_daddy'
    and p.is_admin;

  if target_rows <> 1 then
    raise exception 'REFUSING: admin bootstrap postflight target identity does not match';
  end if;
end;
$forum_admin_bootstrap_postflight$;

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
  ) as exact_target_is_admin,
  false as database_changed;

commit;
