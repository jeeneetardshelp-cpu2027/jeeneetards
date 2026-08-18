-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION PREFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE INSTALLER.
-- ============================================================================
-- preflight: f72b8b986c51b7d4e9d8152c8fb7c7be90b74efb17c81c393daedb3463eb4860  src/migrations/forum_suspension_admin_v1_preflight.sql
-- audit: ee05eef1cddaf809a4243e42f2037ac0ccd41797f55b2c13f40096549192f6f5  src/migrations/forum_suspension_admin_v1_audit.sql
-- migration: b3aedd53e5277a61d65ceff6f2b726d284dc0b28b9891af87af86230b13da49c  src/migrations/forum_suspension_admin_v1.sql
-- postflight: 3bbb66f082dca359a8133605536baaf112d7f464cb20f8f03bb2fe80ca5bb3d1  src/migrations/forum_suspension_admin_v1_postflight.sql
-- rollback: bdbb1e893ea28530254e847e0e8b15889e54ae714e9bc82035fc89e94b073b4c  src/migrations/forum_suspension_admin_v1_rollback.sql

begin transaction read only;
set local statement_timeout = '60s';
do $forum_suspension_admin_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: suspension-admin production preflight requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: suspension-admin production preflight requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: suspension-admin production preflight requires the reviewed Forum v1 production baseline';
  end if;
  if to_regclass('public.profiles') is null
     or to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_votes') is null
     or to_regclass('public.forum_user_stats') is null
     or to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_rate_events') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: suspension-admin production preflight Forum v1 objects are incomplete';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: suspension-admin production preflight requires forum mode off';
  end if;
  if to_regprocedure(
       'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
     ) is not null then
    raise exception 'REFUSING: suspension-admin production preflight found a staging fixture helper';
  end if;
  if to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'REFUSING: suspension-admin production preflight suspension-admin wrappers already exist';
  end if;
end;
$forum_suspension_admin_production_guard$;
select
  current_database() as database_name,
  (select mode from public.forum_settings where id = true) as forum_mode,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_present,
  false as database_changed;
commit;

-- Exact reviewed source preflight, unchanged.
-- Read-only preflight for the forum suspension-admin delta.
begin transaction read only;

do $$
declare
  action_contract text;
  username_index_is_usable boolean;
  collision_groups integer;
begin
  if to_regclass('public.forum_suspensions') is null then
    raise exception 'suspension admin preflight: forum_suspensions is missing';
  end if;
  if to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is null then
    raise exception 'suspension admin preflight: the reviewed suspension RPC this delta delegates to is missing';
  end if;
  if to_regprocedure('public.forum_username_is_allowed(text)') is null then
    raise exception 'suspension admin preflight: forum_username_is_allowed is missing; apply the username-claim delta first';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'suspension admin preflight: is_admin is missing';
  end if;

  if to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'suspension admin preflight: this delta is already applied; review drift before retrying';
  end if;

  -- The wrapper reads profiles.is_admin to refuse suspending a moderator, and
  -- profiles.username to resolve the target. Both must exist.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) then
    raise exception 'suspension admin preflight: profiles.is_admin or profiles.username is missing';
  end if;

  -- The wrapper resolves a student by lower(btrim(username)). That is only
  -- single-valued if the case-insensitive unique index is actually enforcing
  -- it: without the index, two profiles can differ only by case, PL/pgSQL
  -- SELECT INTO returns one of them arbitrarily WITHOUT error, and the wrong
  -- student is suspended. Require the index, and separately refuse data that
  -- already collides in case an index was added without validation.
  select i.indisunique and i.indisvalid and i.indislive
    into username_index_is_usable
  from pg_index i
  where i.indexrelid = to_regclass('public.forum_profiles_username_ci_idx');
  if coalesce(username_index_is_usable, false) is not true then
    raise exception 'suspension admin preflight: forum_profiles_username_ci_idx is missing, not unique, or not valid; usernames are not single-valued';
  end if;

  select count(*)::integer into collision_groups
  from (
    select 1 from public.profiles
    where username is not null
    group by lower(btrim(username)) having count(*) > 1
  ) collisions;
  if collision_groups > 0 then
    raise exception 'suspension admin preflight: % case-insensitive username collision group(s) exist; resolve them before installing', collision_groups;
  end if;

  -- 'suspend'/'unsuspend' must already be permitted by the moderation-log
  -- action constraint; this delta deliberately does not widen it.
  --
  -- Read the definition into a variable first. A missing constraint yields
  -- NULL, and `NULL not like ...` is NULL rather than true, so an inline test
  -- would let a database with no constraint at all pass. The literals are also
  -- matched WITH their quotes: 'unsuspend' contains the substring suspend, so
  -- an unquoted test passes on a constraint that permits only unsuspend.
  select pg_get_constraintdef(oid) into action_contract
  from pg_constraint
  where conrelid = 'public.forum_moderation_log'::regclass
    and conname = 'forum_moderation_log_action_check';
  if action_contract is null then
    raise exception 'suspension admin preflight: the moderation-log action constraint is missing';
  end if;
  -- Literal presence alone is not enough: a drifted constraint such as
  -- `action <> 'suspend' or action = 'unsuspend'` mentions both words while
  -- still rejecting every suspension. Forum v1 and the closed-beta delta both
  -- use one positive action = ANY(ARRAY[...]) allow-list, so require that
  -- canonical shape before checking its members.
  if action_contract not like '%''suspend''::text%' then
    raise exception 'suspension admin preflight: the moderation log does not permit the suspend action';
  end if;
  if action_contract not like '%''unsuspend''::text%' then
    raise exception 'suspension admin preflight: the moderation log does not permit the unsuspend action';
  end if;
  if action_contract !~ '^CHECK \(\(action = ANY \(ARRAY\[.*\]\)\)\)$' then
    raise exception 'suspension admin preflight: the moderation-log action constraint is not the reviewed positive allow-list shape';
  end if;
end;
$$;

select
  current_database() as database_name,
  (select count(*)::integer from public.forum_suspensions) as existing_suspension_rows,
  false as database_changed;

rollback;
