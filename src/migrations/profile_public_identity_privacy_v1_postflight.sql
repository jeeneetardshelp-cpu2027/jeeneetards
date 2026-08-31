-- Public profile identity privacy v1 postflight.
-- Read-only verification of effective privileges after the migration.
begin transaction read only;

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
    raise exception 'username-only public access is missing';
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

select
  has_column_privilege('anon', 'public.profiles', 'username', 'select') as anon_username_public,
  not has_column_privilege('anon', 'public.profiles', 'full_name', 'select') as anon_full_name_private,
  not has_column_privilege('anon', 'public.profiles', 'avatar_url', 'select') as anon_avatar_url_private,
  not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'select') as authenticated_full_name_private,
  not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'select') as authenticated_avatar_url_private,
  has_table_privilege('service_role', 'public.profiles', 'select') as service_role_profile_access;

rollback;
