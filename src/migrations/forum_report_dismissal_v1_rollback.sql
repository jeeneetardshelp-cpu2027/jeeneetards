-- Staging/test-only rollback for the report-dismissal delta.
begin;

do $$
declare
  environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'report dismissal rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'report dismissal rollback refused for environment %', coalesce(environment_name, 'unmarked');
  end if;
end;
$$;

drop function public.forum_admin_dismiss_report(bigint);

notify pgrst, 'reload schema';
commit;
