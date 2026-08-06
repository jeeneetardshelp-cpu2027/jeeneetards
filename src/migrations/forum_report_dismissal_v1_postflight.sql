-- Read-only structural and grant verification for report dismissal v1.
begin transaction read only;

do $$
declare
  function_is_security_definer boolean;
  function_config text[];
begin
  if to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'report dismissal postflight: dismissal RPC is missing';
  end if;
  select prosecdef, proconfig
    into function_is_security_definer, function_config
  from pg_proc
  where oid = 'public.forum_admin_dismiss_report(bigint)'::regprocedure;
  if not function_is_security_definer
     or not coalesce(function_config, array[]::text[]) @> array['search_path=""'] then
    raise exception 'report dismissal postflight: security-definer search path is not fail closed';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_dismiss_report(bigint)', 'execute') then
    raise exception 'report dismissal postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_dismiss_report(bigint)', 'execute') then
    raise exception 'report dismissal postflight: authenticated execute grant is missing';
  end if;
  if has_table_privilege('authenticated', 'public.forum_reports', 'update') then
    raise exception 'report dismissal postflight: authenticated direct report update leaked';
  end if;
end;
$$;

rollback;
