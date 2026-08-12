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
  if action_contract not like '%''suspend''%' then
    raise exception 'suspension admin preflight: the moderation log does not permit the suspend action';
  end if;
  if action_contract not like '%''unsuspend''%' then
    raise exception 'suspension admin preflight: the moderation log does not permit the unsuspend action';
  end if;
end;
$$;

select
  current_database() as database_name,
  (select count(*)::integer from public.forum_suspensions) as existing_suspension_rows,
  false as database_changed;

rollback;
