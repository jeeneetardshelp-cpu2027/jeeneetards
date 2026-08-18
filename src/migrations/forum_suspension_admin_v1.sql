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
