-- Legacy rerunnable profile-read hardening.
--
-- This file originally made every profile column except is_admin public.
-- That still exposed OAuth full_name/avatar_url and stable account IDs. Keep
-- the historical migration safe to re-run by enforcing the current contract:
-- only the separately claimed forum username is browser-readable.

begin;

revoke select on table public.profiles from public, anon, authenticated;
grant select (username) on table public.profiles to anon, authenticated;
grant select on table public.profiles to service_role;

do $$
declare
  exposed_columns text;
begin
  if has_table_privilege('anon', 'public.profiles', 'select')
     or has_table_privilege('authenticated', 'public.profiles', 'select') then
    raise exception 'browser role still has table-level SELECT on public.profiles';
  end if;

  if not has_column_privilege('anon', 'public.profiles', 'username', 'select')
     or not has_column_privilege('authenticated', 'public.profiles', 'username', 'select') then
    raise exception 'public forum username is not readable by both browser roles';
  end if;

  select string_agg(c.column_name, ', ' order by c.ordinal_position)
    into exposed_columns
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'profiles'
     and c.column_name <> 'username'
     and (
       has_column_privilege('anon', 'public.profiles', c.column_name, 'select')
       or has_column_privilege('authenticated', 'public.profiles', c.column_name, 'select')
     );

  if exposed_columns is not null then
    raise exception 'private profile columns remain browser-readable: %', exposed_columns;
  end if;

  if not has_table_privilege('service_role', 'public.profiles', 'select') then
    raise exception 'service_role lost SELECT on public.profiles';
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
