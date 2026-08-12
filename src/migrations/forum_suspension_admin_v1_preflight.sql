-- Read-only preflight for the forum suspension-admin delta.
begin transaction read only;

do $$
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

  -- 'suspend'/'unsuspend' must already be permitted by the moderation-log
  -- action constraint; this delta deliberately does not widen it.
  if (
    select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.forum_moderation_log'::regclass
      and conname = 'forum_moderation_log_action_check'
  ) not like '%unsuspend%' then
    raise exception 'suspension admin preflight: the moderation log does not permit suspend/unsuspend actions';
  end if;
end;
$$;

select
  current_database() as database_name,
  (select count(*)::integer from public.forum_suspensions) as existing_suspension_rows,
  false as database_changed;

rollback;
