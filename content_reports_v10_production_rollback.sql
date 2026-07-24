-- EMERGENCY ROLLBACK for content_reports_hardening_v10.sql.
-- Preserves every report row, but re-opens anonymous submission. Keep the
-- frontend report control disabled if this rollback is ever used.

begin;

drop trigger if exists trg_enforce_content_report_submission
on public.content_reports;
drop function if exists public.enforce_content_report_submission();

drop policy if exists "signed-in users report own" on public.content_reports;
drop policy if exists "anyone reports" on public.content_reports;
create policy "anyone reports"
on public.content_reports
for insert
with check (reporter_id is null or reporter_id = auth.uid());

grant insert on table public.content_reports to anon, authenticated, service_role;
grant usage, select on sequence public.content_reports_id_seq
to anon, authenticated, service_role;

commit;

select
  not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.content_reports'::regclass
      and tgname = 'trg_enforce_content_report_submission'
      and not tgisinternal
  ) as trigger_removed,
  has_table_privilege('anon', 'public.content_reports', 'INSERT')
    as anon_insert_restored,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_reports'
      and policyname = 'anyone reports'
  ) as legacy_policy_restored;
