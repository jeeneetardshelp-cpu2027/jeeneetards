-- Read-only evidence after applying per_video_chapter_import_v12.sql.
begin read only;

do $postflight$
declare
  v_capability jsonb;
  v_rls boolean;
begin
  if to_regprocedure(
       'public.import_playlist_with_chapters(jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.per_video_chapter_import_capability()'
     ) is null
     or to_regprocedure(
       'public.per_video_chapter_import_video_snapshot(bigint)'
     ) is null
     or to_regclass('public.playlist_import_audit') is null
     or to_regclass('public.playlist_import_audit_id_seq') is null then
    raise exception 'v12 postflight failed: capability objects are missing';
  end if;

  v_capability := public.per_video_chapter_import_capability();
  if (v_capability->>'version')::int <> 12
     or (v_capability->>'per_video_chapter_id')::boolean is not true
     or (v_capability->>'request_replay')::boolean is not true then
    raise exception 'v12 postflight failed: capability contract mismatch';
  end if;

  select c.relrowsecurity
  into v_rls
  from pg_class c
  where c.oid = 'public.playlist_import_audit'::regclass;
  if v_rls is not true
     or has_function_privilege(
       'anon',
       'public.import_playlist_with_chapters(jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.import_playlist_with_chapters(jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.import_playlist_with_chapters(jsonb,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.per_video_chapter_import_snapshot(bigint)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.per_video_chapter_import_video_snapshot(bigint)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.per_video_chapter_import_capability()',
       'EXECUTE'
     )
     or has_table_privilege(
       'anon',
       'public.playlist_import_audit',
       'SELECT'
     )
     or not has_table_privilege(
       'authenticated',
       'public.playlist_import_audit',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.playlist_import_audit',
       'SELECT'
     )
     or has_sequence_privilege(
       'anon',
       'public.playlist_import_audit_id_seq',
       'USAGE'
     )
     or has_sequence_privilege(
       'anon',
       'public.playlist_import_audit_id_seq',
       'UPDATE'
     )
     or has_sequence_privilege(
       'authenticated',
       'public.playlist_import_audit_id_seq',
       'USAGE'
     )
     or has_sequence_privilege(
       'authenticated',
       'public.playlist_import_audit_id_seq',
       'UPDATE'
     )
     or has_sequence_privilege(
       'service_role',
       'public.playlist_import_audit_id_seq',
       'USAGE'
     )
     or has_sequence_privilege(
       'service_role',
       'public.playlist_import_audit_id_seq',
       'UPDATE'
     )
     or not exists (
       select 1
       from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = 'playlist_import_audit'
         and p.policyname = 'admin reads playlist import audit'
         and p.cmd = 'SELECT'
         and p.qual like '%is_admin%'
     ) then
    raise exception 'v12 postflight failed: grants or RLS mismatch';
  end if;
end;
$postflight$;

select public.per_video_chapter_import_capability() as capability;

select
  to_regprocedure('public.import_playlist_with_chapters(jsonb,text)') is not null
    as mapped_import_exists,
  to_regclass('public.playlist_import_audit') is not null
    as import_audit_exists,
  (
    select c.relrowsecurity
    from pg_class c
    where c.oid = 'public.playlist_import_audit'::regclass
  ) as import_audit_rls_enabled;

select
  has_function_privilege(
    'anon',
    'public.import_playlist_with_chapters(jsonb,text)',
    'EXECUTE'
  ) as anon_can_import,
  has_function_privilege(
    'anon',
    'public.per_video_chapter_import_capability()',
    'EXECUTE'
  ) as anon_can_read_capability,
  has_function_privilege(
    'authenticated',
    'public.import_playlist_with_chapters(jsonb,text)',
    'EXECUTE'
  ) as authenticated_has_guarded_entry,
  has_function_privilege(
    'service_role',
    'public.import_playlist_with_chapters(jsonb,text)',
    'EXECUTE'
  ) as service_role_can_import,
  has_function_privilege(
    'authenticated',
    'public.per_video_chapter_import_snapshot(bigint)',
    'EXECUTE'
  ) as authenticated_can_call_private_snapshot,
  has_table_privilege(
    'anon',
    'public.playlist_import_audit',
    'SELECT'
  ) as anon_can_read_audit,
  has_table_privilege(
    'authenticated',
    'public.playlist_import_audit',
    'SELECT'
  ) as authenticated_has_guarded_audit_read,
  has_table_privilege(
    'service_role',
    'public.playlist_import_audit',
    'SELECT'
  ) as service_role_can_read_audit,
  has_sequence_privilege(
    'anon',
    'public.playlist_import_audit_id_seq',
    'USAGE'
  ) or has_sequence_privilege(
    'anon',
    'public.playlist_import_audit_id_seq',
    'UPDATE'
  ) as anon_can_advance_audit_sequence,
  has_sequence_privilege(
    'authenticated',
    'public.playlist_import_audit_id_seq',
    'USAGE'
  ) or has_sequence_privilege(
    'authenticated',
    'public.playlist_import_audit_id_seq',
    'UPDATE'
  ) as authenticated_can_advance_audit_sequence,
  has_sequence_privilege(
    'service_role',
    'public.playlist_import_audit_id_seq',
    'USAGE'
  ) or has_sequence_privilege(
    'service_role',
    'public.playlist_import_audit_id_seq',
    'UPDATE'
  ) as service_role_can_advance_audit_sequence;

select count(*) as recorded_mapped_imports
from public.playlist_import_audit;

rollback;
