-- Assertions executed in the same transaction as the production delta.
-- A failure here rolls back the functions and indexes together.

do $postflight$
declare
  v_signature text;
  v_security_definer boolean;
  v_volatility "char";
begin
  foreach v_signature in array array[
    'public.get_browse_curriculum(text,text,text)',
    'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'POSTFLIGHT: function % was not created', v_signature;
    end if;

    select p.prosecdef, p.provolatile
      into v_security_definer, v_volatility
      from pg_proc p
     where p.oid = to_regprocedure(v_signature);

    if v_security_definer then
      raise exception 'POSTFLIGHT: % must remain SECURITY INVOKER', v_signature;
    end if;
    if v_volatility <> 's' then
      raise exception 'POSTFLIGHT: % must remain STABLE', v_signature;
    end if;

    if not has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE')
       or not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'POSTFLIGHT: expected role grants are missing for %', v_signature;
    end if;
  end loop;

  if exists (
    select 1
      from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('get_browse_curriculum', 'browse_facet_counts')
       and grantee = 'PUBLIC'
       and privilege_type = 'EXECUTE'
  ) then
    raise exception 'POSTFLIGHT: PUBLIC still has EXECUTE on a v9 function';
  end if;

  if to_regclass('public.idx_plg_goal_playlist') is null
     or to_regclass('public.idx_pcl_class_playlist') is null then
    raise exception 'POSTFLIGHT: one or more v9 indexes are missing';
  end if;

  perform count(*)
    from public.get_browse_curriculum(null, null, null);
  perform count(*)
    from public.browse_facet_counts(null, null, null, null, null, null, null, null, null);
end
$postflight$;

