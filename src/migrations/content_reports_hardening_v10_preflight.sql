-- READ ONLY. Run on the intended production project before v10.
-- Returns one evidence row and changes nothing.

do $$
declare
  v_environment text;
begin
  if to_regclass('public.content_reports') is null then
    raise exception 'content_reports table is missing';
  end if;
  if to_regclass('public.content_reports_id_seq') is null then
    raise exception 'content_reports identity sequence is missing';
  end if;
  if to_regclass('public.app_environment') is not null then
    execute 'select name from public.app_environment where id = true limit 1'
      into v_environment;
  end if;
  if v_environment in ('staging', 'test') then
    raise exception using errcode = '42501',
      message = 'refusing: target identifies as staging/test';
  end if;
end;
$$;

select
  current_database() as database_name,
  case
    when to_regclass('public.app_environment') is null
      then 'unmarked-production-candidate'
    else 'marked-non-staging-candidate'
  end as environment_marker,
  (select count(*) from public.content_reports) as report_rows,
  (select count(*) from public.content_reports where reporter_id is null) as anonymous_history_rows,
  (select count(*) from public.content_reports where note is not null and char_length(note) > 1000)
    as historical_long_notes,
  (
    select count(*)
    from (
      select reporter_id, target_type, target_id, reason
      from public.content_reports
      where reporter_id is not null and status = 'pending'
      group by reporter_id, target_type, target_id, reason
      having count(*) > 1
    ) duplicate_groups
  ) as existing_duplicate_pending_groups,
  (
    select count(*) from public.content_reports r
    where (r.target_type = 'video' and not exists (
      select 1 from public.videos v where v.id = r.target_id
    )) or (r.target_type = 'playlist' and not exists (
      select 1 from public.playlists p where p.id = r.target_id
    ))
  ) as historical_missing_targets,
  has_table_privilege('anon', 'public.content_reports', 'INSERT') as anon_insert_granted_before,
  has_table_privilege('authenticated', 'public.content_reports', 'INSERT')
    as authenticated_insert_granted_before,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_reports'
      and policyname = 'anyone reports'
  ) as legacy_anyone_policy_present,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.content_reports'::regclass
      and tgname = 'trg_enforce_content_report_submission'
      and not tgisinternal
  ) as hardening_trigger_already_present;
