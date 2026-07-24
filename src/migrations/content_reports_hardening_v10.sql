-- CONTENT REPORTS v10 — signed-in submission + database-side abuse controls.
--
-- Additive/idempotent. Existing report rows are preserved. This migration
-- removes anonymous INSERT access but does not alter admin read/update rules.

alter table public.content_reports enable row level security;

drop policy if exists "anyone reports" on public.content_reports;
drop policy if exists "signed-in users report own" on public.content_reports;
create policy "signed-in users report own"
on public.content_reports
for insert
to authenticated
with check (
  auth.uid() is not null
  and reporter_id = auth.uid()
);

revoke insert on table public.content_reports from public, anon;
grant insert on table public.content_reports to authenticated, service_role;
revoke all on sequence public.content_reports_id_seq from public, anon;
grant usage, select on sequence public.content_reports_id_seq
to authenticated, service_role;

create or replace function public.enforce_content_report_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Administrative maintenance and test cleanup use service_role and remain
  -- outside the student limit. RLS is still the primary client boundary.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if v_uid is null or new.reporter_id is distinct from v_uid then
    raise exception using
      errcode = '42501',
      message = 'authenticated reporter_id required';
  end if;

  if new.note is not null and char_length(new.note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'report note must be 1000 characters or fewer';
  end if;

  if new.target_type = 'video'
     and not exists (select 1 from public.videos where id = new.target_id) then
    raise exception using errcode = '22023', message = 'unknown video target';
  elsif new.target_type = 'playlist'
     and not exists (select 1 from public.playlists where id = new.target_id) then
    raise exception using errcode = '22023', message = 'unknown playlist target';
  end if;

  -- Serialize submissions per account so concurrent requests cannot race past
  -- the duplicate or hourly-limit checks.
  perform pg_advisory_xact_lock(
    hashtextextended('content-report:' || v_uid::text, 0)
  );

  if exists (
    select 1
    from public.content_reports r
    where r.reporter_id = v_uid
      and r.target_type = new.target_type
      and r.target_id = new.target_id
      and r.reason = new.reason
      and r.status = 'pending'
  ) then
    raise exception using
      errcode = '23505',
      message = 'an equivalent report is already pending';
  end if;

  if (
    select count(*)
    from public.content_reports r
    where r.reporter_id = v_uid
      and r.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'report rate limit exceeded; try again later';
  end if;

  -- Client-supplied moderation state and timestamps are never trusted.
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_content_report_submission()
from public, anon, authenticated;
grant execute on function public.enforce_content_report_submission()
to service_role;

drop trigger if exists trg_enforce_content_report_submission
on public.content_reports;
create trigger trg_enforce_content_report_submission
before insert on public.content_reports
for each row execute function public.enforce_content_report_submission();
