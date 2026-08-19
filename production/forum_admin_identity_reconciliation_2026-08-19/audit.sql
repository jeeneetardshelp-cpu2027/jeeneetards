-- ============================================================================
-- FORUM ADMIN IDENTITY RECONCILIATION - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- TARGET ACCOUNT: jeeneetardshelp@gmail.com / alecc_daddy
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE ANY ADMIN OR IDENTITY CHANGE.
-- ============================================================================

begin transaction read only;
set local statement_timeout = '60s';

do $forum_admin_identity_reconciliation$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: identity reconciliation requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: identity reconciliation requires the empty production environment marker';
  end if;
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.forum_install_state') is null
     or to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: identity reconciliation production baseline is incomplete';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: identity reconciliation requires exactly one Forum v1 install-state row';
  end if;
  if public.forum_mode() is distinct from 'off' then
    raise exception 'REFUSING: identity reconciliation requires forum mode off';
  end if;
  if (select count(*) from public.profiles where is_admin) <> 1 then
    raise exception 'REFUSING: identity reconciliation requires exactly one existing administrator';
  end if;
end;
$forum_admin_identity_reconciliation$;

with admin_identity as (
  select
    p.id as profile_id,
    p.username,
    u.id as auth_id,
    u.email,
    u.email_confirmed_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.is_admin
),
target_auth as (
  select
    u.id as auth_id,
    u.email_confirmed_at
  from auth.users u
  where lower(btrim(u.email)) = 'jeeneetardshelp@gmail.com'
),
target_profile as (
  select
    t.auth_id,
    t.email_confirmed_at,
    p.id as profile_id,
    p.username,
    p.is_admin
  from target_auth t
  left join public.profiles p on p.id = t.auth_id
),
claimed_username as (
  select p.id as profile_id
  from public.profiles p
  where p.username = 'alecc_daddy'
)
select
  public.forum_mode() = 'off' as forum_mode_is_off,
  (select count(*)::integer from admin_identity) as total_admins,
  (
    select count(*) = 1 from admin_identity
    where auth_id is not null
  ) as existing_admin_has_auth_user,
  (
    select count(*) = 1 from admin_identity
    where lower(btrim(email)) = 'jeeneetardshelp@gmail.com'
  ) as existing_admin_email_matches_target,
  (
    select count(*) = 1 from admin_identity
    where email_confirmed_at is not null
  ) as existing_admin_email_confirmed,
  (
    select count(*) = 1 from admin_identity
    where username is null
  ) as existing_admin_username_missing,
  (select count(*)::integer from target_auth) as target_auth_user_count,
  (
    select count(*)::integer from target_profile
    where profile_id is not null
  ) as target_profile_count,
  (
    select count(*) = 1 from target_profile
    where email_confirmed_at is not null
  ) as target_email_confirmed,
  (
    select count(*) = 1 from target_profile
    where profile_id is not null
      and username = 'alecc_daddy'
  ) as target_username_is_alecc_daddy,
  (
    select count(*) = 1 from target_profile
    where profile_id is not null
      and username is null
  ) as target_username_missing,
  (
    select count(*) = 1 from target_profile
    where profile_id is not null
      and is_admin
  ) as target_is_admin,
  (
    select count(*) = 1
    from admin_identity a
    join target_profile t on t.profile_id = a.profile_id
  ) as existing_admin_is_target_account,
  (select count(*)::integer from claimed_username) as alecc_daddy_profile_count,
  (
    select count(*) = 1
    from claimed_username c
    join target_profile t on t.profile_id = c.profile_id
  ) as alecc_daddy_belongs_to_target_account,
  false as database_changed;

commit;
