-- ============================================================================
-- FORUM EXISTING-ADMIN AUDIT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE ANY ADMIN CHANGE.
-- ============================================================================

begin transaction read only;
set local statement_timeout = '60s';

do $forum_existing_admin_audit$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: existing-admin audit requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: existing-admin audit requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: existing-admin audit production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: existing-admin audit requires exactly one Forum v1 install-state row';
  end if;
  if public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: existing-admin audit requires forum mode off';
  end if;
  if (select count(*) from public.profiles where is_admin) < 1 then
    raise exception 'REFUSING: existing-admin audit expected at least one administrator';
  end if;
end;
$forum_existing_admin_audit$;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  count(*)::integer as total_admins,
  (
    count(*) filter (
      where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
        and u.email_confirmed_at is not null
        and p.username = 'alecc_daddy'
    ) = 1
  ) as exact_target_is_admin,
  count(*) filter (
    where (
      lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
      and u.email_confirmed_at is not null
      and p.username = 'alecc_daddy'
    ) is not true
  )::integer as other_admin_count,
  array_agg(
    coalesce(p.username, '<missing>')
    order by coalesce(p.username, '<missing>')
  ) as admin_usernames,
  false as database_changed
from public.profiles p
left join auth.users u on u.id = p.id
where p.is_admin;

commit;
