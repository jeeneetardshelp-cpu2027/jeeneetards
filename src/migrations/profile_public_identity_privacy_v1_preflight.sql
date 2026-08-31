-- Public profile identity privacy v1 preflight.
-- Read-only and safe to run before the migration.
begin transaction read only;

do $$
declare
  missing_columns text;
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is missing';
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing_columns
    from (values ('id'), ('username'), ('full_name'), ('avatar_url'), ('created_at'))
      as required(column_name)
   where not exists (
     select 1
       from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'profiles'
        and c.column_name = required.column_name
   );

  if missing_columns is not null then
    raise exception 'public.profiles is missing required columns: %', missing_columns;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'required Supabase roles are missing';
  end if;
end
$$;

select
  has_table_privilege('anon', 'public.profiles', 'select') as anon_table_select_before,
  has_table_privilege('authenticated', 'public.profiles', 'select') as authenticated_table_select_before,
  has_column_privilege('anon', 'public.profiles', 'username', 'select') as anon_username_select_before,
  has_column_privilege('anon', 'public.profiles', 'full_name', 'select') as anon_full_name_select_before,
  has_column_privilege('anon', 'public.profiles', 'avatar_url', 'select') as anon_avatar_url_select_before;

rollback;
