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
