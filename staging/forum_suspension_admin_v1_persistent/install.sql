-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 - PERSISTENT DISPOSABLE-STAGING INSTALL
-- STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Preflight SHA-256: f72b8b986c51b7d4e9d8152c8fb7c7be90b74efb17c81c393daedb3463eb4860
-- Audit SHA-256: ee05eef1cddaf809a4243e42f2037ac0ccd41797f55b2c13f40096549192f6f5
-- Migration SHA-256: b3aedd53e5277a61d65ceff6f2b726d284dc0b28b9891af87af86230b13da49c
-- Postflight SHA-256: 3bbb66f082dca359a8133605536baaf112d7f464cb20f8f03bb2fe80ca5bb3d1
-- ============================================================================

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

-- Read-only suspension audit. Counts only; no username, reason text,
-- moderator identity, or student content is returned.
begin transaction read only;

select
  count(*)::integer as suspension_rows,
  count(*) filter (where suspended_until > now())::integer as active_suspensions,
  count(*) filter (where suspended_until <= now())::integer as expired_rows_not_yet_lifted,
  count(*) filter (
    where suspended_until > now() + interval '365 days'
  )::integer as suspensions_beyond_the_wrapper_limit,
  count(*) filter (where created_by is null)::integer as rows_with_no_recorded_moderator
from public.forum_suspensions;

select
  count(*) filter (where action = 'suspend')::integer as suspend_log_entries,
  count(*) filter (where action = 'unsuspend')::integer as unsuspend_log_entries
from public.forum_moderation_log;

rollback;

-- Forum suspension admin v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight and audit first.
--
-- forum_admin_set_suspension() takes a uuid, but no forum RPC ever returns a
-- content author's uuid: the moderation queue identifies the author of a
-- reported post only by public username, and every read path deliberately
-- exposes author_username and never author_id. So the reviewed suspension RPC
-- cannot be driven from the admin UI at all today -- the only user id the
-- browser holds is the REPORTER's, which is the wrong person.
--
-- Rather than leak author uuids into the browser to make a form work, this
-- delta adds a username-taking wrapper, exactly as
-- forum_admin_set_beta_member(text, boolean) already does for the same reason.
begin;


-- The staging marker and inactive forum state are checked inside the same
-- transaction that creates the wrappers. A successful earlier preflight is
-- not treated as authorization for a different database or later run.
do $forum_suspension_admin_stage_guard$
declare
  true_markers integer;
  staging_markers integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;

  select
    count(*) filter (where id = true),
    count(*) filter (where id = true and lower(btrim(name)) = 'staging')
  into true_markers, staging_markers
  from public.app_environment;

  if true_markers <> 1 or staging_markers <> 1 then
    raise exception 'REFUSING: suspension-admin install requires exactly one staging marker';
  end if;

  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: forum mode must remain off during suspension-admin installation';
  end if;

  if to_regprocedure(
       'public.forum_admin_set_suspension_by_username(text,integer,text)'
     ) is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'REFUSING: suspension-admin wrappers already exist';
  end if;
end;
$forum_suspension_admin_stage_guard$;

-- Session-local baseline used only by the terminal evidence row. It is
-- created after the staging guard and inside the migration transaction.
create temporary table forum_suspension_admin_stage_baseline
on commit preserve rows
as select
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  (select count(*)::integer from public.forum_moderation_log) as moderation_log_rows,
  (select count(*)::integer from public.forum_posts) as post_rows,
  (select count(*)::integer from public.forum_comments) as comment_rows,
  (select count(*)::integer from public.forum_reports) as report_rows;


create function public.forum_admin_set_suspension_by_username(
  p_username text,
  p_days integer,
  p_reason text
)
returns table (
  username text,
  suspended_until timestamptz,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text := btrim(coalesce(p_username, ''));
  target_user uuid;
  target_is_admin boolean;
  cleaned_reason text := btrim(coalesce(p_reason, ''));
  until timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  -- STRICT so a case-insensitive collision is refused rather than resolved
  -- arbitrarily. forum_profiles_username_ci_idx should make that impossible
  -- and the preflight refuses to install without it, but picking one of two
  -- students at random is the kind of failure that must never be silent.
  begin
    select p.id, p.is_admin into strict target_user, target_is_admin
    from public.profiles p
    where lower(btrim(p.username)) = lower(candidate)
      and public.forum_username_is_allowed(p.username);
  exception
    when no_data_found then
      raise exception using errcode = 'P0002', message = 'student username not found';
    when too_many_rows then
      raise exception using errcode = 'P0003',
        message = 'that username matches more than one profile; resolve the collision before suspending';
  end;

  -- Suspension only blocks forum contribution; it does not remove moderator
  -- rights, so creating or extending one cannot contain a compromised
  -- moderator. Lifting must remain possible, though: a student may have been
  -- suspended before being promoted, and this username wrapper is the only
  -- browser-safe path that can identify that account without exposing UUIDs.
  if target_is_admin and p_days is not null and p_days > 0 then
    raise exception using errcode = '42501',
      message = 'moderator accounts cannot be suspended here';
  end if;

  if p_days is null or p_days <= 0 then
    -- Passing a null deadline makes the reviewed RPC delete the row and log
    -- 'unsuspend'. The log reason is not null-checked there, but an empty
    -- audit entry is useless to the next moderator reading it.
    perform public.forum_admin_set_suspension(
      target_user, null, nullif(cleaned_reason, '')
    );
  else
    -- forum_suspensions requires a 3-to-500 character reason and a deadline
    -- after created_at. Both are enforced here so the caller gets a usable
    -- message instead of a raw constraint violation.
    if char_length(cleaned_reason) < 3 or char_length(cleaned_reason) > 500 then
      raise exception using errcode = '22023',
        message = 'a 3 to 500 character suspension reason is required';
    end if;
    if p_days > 365 then
      raise exception using errcode = '22023',
        message = 'suspensions are limited to 365 days';
    end if;
    until := now() + make_interval(days => p_days);
    perform public.forum_admin_set_suspension(target_user, until, cleaned_reason);
  end if;

  return query
  select p.username, s.suspended_until, s.reason
  from public.profiles p
  left join public.forum_suspensions s on s.user_id = p.id
  where p.id = target_user;
end;
$$;

create function public.forum_admin_list_suspensions()
returns table (
  username text,
  suspended_until timestamptz,
  reason text,
  created_at timestamptz,
  created_by_username text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select
    p.username,
    s.suspended_until,
    s.reason,
    s.created_at,
    actor.username,
    s.suspended_until > now()
  from public.forum_suspensions s
  join public.profiles p on p.id = s.user_id
  left join public.profiles actor on actor.id = s.created_by
  -- Active first, then soonest to expire. An expired row stays listed until
  -- it is lifted, so a moderator can still see that the account has history.
  order by (s.suspended_until > now()) desc, s.suspended_until, p.id;
end;
$$;

revoke all on function public.forum_admin_set_suspension_by_username(text,integer,text)
  from public, anon, authenticated;
revoke all on function public.forum_admin_list_suspensions()
  from public, anon, authenticated;
grant execute on function public.forum_admin_set_suspension_by_username(text,integer,text)
  to authenticated, service_role;
grant execute on function public.forum_admin_list_suspensions()
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

-- Read-only structural and grant verification for suspension admin v1.
begin transaction read only;

do $$
declare
  definition record;
begin
  for definition in
    select
      oid::regprocedure as signature,
      prosecdef as is_security_definer,
      coalesce(proconfig, array[]::text[]) as config
    from pg_proc
    where oid in (
      'public.forum_admin_set_suspension_by_username(text,integer,text)'::regprocedure,
      'public.forum_admin_list_suspensions()'::regprocedure
    )
  loop
    if not definition.is_security_definer
       or not definition.config @> array['search_path=""'] then
      raise exception 'suspension admin postflight: % is not fail closed', definition.signature;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.forum_admin_set_suspension_by_username(text,integer,text)', 'execute')
     or has_function_privilege('anon', 'public.forum_admin_list_suspensions()', 'execute') then
    raise exception 'suspension admin postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_set_suspension_by_username(text,integer,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.forum_admin_list_suspensions()', 'execute') then
    raise exception 'suspension admin postflight: authenticated execute grant is missing';
  end if;

  -- The browser must still never reach the suspension table directly; the
  -- security-definer wrappers are the only sanctioned path.
  if has_table_privilege('anon', 'public.forum_suspensions', 'select')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'select')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'insert')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'update')
     or has_table_privilege('authenticated', 'public.forum_suspensions', 'delete') then
    raise exception 'suspension admin postflight: direct browser access to forum_suspensions leaked';
  end if;
end;
$$;

select
  to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
    as set_suspension_by_username_ready,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_ready,
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  false as database_changed;

rollback;

-- Terminal evidence outside the postflight read-only transaction.
select
  (select lower(btrim(name)) from public.app_environment where id = true)
    as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is not null as set_suspension_by_username_installed,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_installed,
  (select count(*) from public.forum_suspensions) =
    (select suspension_rows from forum_suspension_admin_stage_baseline)
    as suspension_rows_unchanged,
  (select count(*) from public.forum_moderation_log) =
    (select moderation_log_rows from forum_suspension_admin_stage_baseline)
    as moderation_log_rows_unchanged,
  (select count(*) from public.forum_posts) =
    (select post_rows from forum_suspension_admin_stage_baseline)
    as posts_unchanged,
  (select count(*) from public.forum_comments) =
    (select comment_rows from forum_suspension_admin_stage_baseline)
    as comments_unchanged,
  (select count(*) from public.forum_reports) =
    (select report_rows from forum_suspension_admin_stage_baseline)
    as reports_unchanged;
