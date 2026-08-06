begin transaction read only;

do $$
begin
  if to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_get_my_identity()') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null then
    raise exception 'username claim postflight: required functions are missing';
  end if;
  if to_regclass('public.forum_profiles_username_ci_idx') is null then
    raise exception 'username claim postflight: case-insensitive unique index is missing';
  end if;
  if has_function_privilege('anon', 'public.forum_claim_username(text)', 'execute') then
    raise exception 'username claim postflight: anonymous claim grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_claim_username(text)', 'execute') then
    raise exception 'username claim postflight: authenticated claim grant missing';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'username', 'update')
     or has_column_privilege('authenticated', 'public.profiles', 'username', 'insert') then
    raise exception 'username claim postflight: direct browser username write leaked';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'update')
     or not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update') then
    raise exception 'username claim postflight: ordinary profile editing grant was lost';
  end if;
end;
$$;

rollback;
