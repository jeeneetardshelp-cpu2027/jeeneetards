-- ============================================================
--  CONTENT REPORTS  —  lets anyone flag a broken/miscategorised/
--  inappropriate video or course; admins triage them. Run once.
-- ============================================================

create table if not exists public.content_reports (
    id          bigint generated always as identity primary key,
    target_type text   not null check (target_type in ('video','playlist')),
    target_id   bigint not null,
    reason      text   not null check (reason in ('broken','wrong-category','inappropriate','other')),
    note        text,
    reporter_id uuid   references public.profiles(id) on delete set null,  -- null = anonymous
    status      text   not null default 'pending' check (status in ('pending','reviewed','dismissed')),
    created_at  timestamptz not null default now()
);

create index if not exists idx_content_reports_status on public.content_reports (status);

alter table public.content_reports enable row level security;

-- Anyone can file a report (signed in or not). reporter_id must be either
-- null (anonymous) or the reporter's own id — no spoofing someone else.
drop policy if exists "anyone reports" on public.content_reports;
create policy "anyone reports" on public.content_reports
    for insert
    with check (reporter_id is null or reporter_id = auth.uid());

-- Only admins can read or triage reports.
drop policy if exists "admin reads reports" on public.content_reports;
create policy "admin reads reports" on public.content_reports
    for select using (public.is_admin());

drop policy if exists "admin updates reports" on public.content_reports;
create policy "admin updates reports" on public.content_reports
    for update using (public.is_admin()) with check (public.is_admin());

-- Check (as admin): select * from public.content_reports order by created_at desc;
