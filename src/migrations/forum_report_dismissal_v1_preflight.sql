-- Read-only preflight for the forum report-dismissal delta.
begin transaction read only;

do $$
declare
  report_status_contract text;
begin
  if to_regclass('public.forum_reports') is null then
    raise exception 'report dismissal preflight: forum_reports is missing';
  end if;
  if to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null then
    raise exception 'report dismissal preflight: forum_admin_dismiss_report(bigint) already exists; review drift before retrying';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'forum_reports'
      and column_name = 'status'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'forum_reports'
      and column_name = 'resolved_at'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'forum_reports'
      and column_name = 'resolved_by'
  ) then
    raise exception 'report dismissal preflight: report resolution columns are incomplete';
  end if;

  select pg_get_constraintdef(oid)
    into report_status_contract
  from pg_constraint
  where conrelid = 'public.forum_reports'::regclass
    and conname = 'forum_reports_status_check';
  if report_status_contract is null or report_status_contract not like '%dismissed%' then
    raise exception 'report dismissal preflight: dismissed is not an allowed report status';
  end if;
end;
$$;

rollback;
