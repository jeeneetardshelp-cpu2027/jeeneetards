-- ============================================================
-- CHAPTER CLASS SCOPES v13 - PERSISTENT CLONE AUTHORIZATION
-- ISOLATED RESTORE CLONE nusprumijjthmrthaitp ONLY. NEVER RUN ON PRODUCTION.
-- ============================================================

begin;

create table if not exists public.chapter_scope_v13_clone_authorization (
  clone_ref text primary key,
  authorized_at timestamptz not null default now(),
  constraint chapter_scope_v13_approved_clone
    check (clone_ref = 'nusprumijjthmrthaitp')
);

revoke all on table public.chapter_scope_v13_clone_authorization
  from public, anon, authenticated;

insert into public.chapter_scope_v13_clone_authorization (clone_ref)
values ('nusprumijjthmrthaitp')
on conflict (clone_ref) do nothing;

commit;

select clone_ref, authorized_at
  from public.chapter_scope_v13_clone_authorization
 where clone_ref = 'nusprumijjthmrthaitp';
