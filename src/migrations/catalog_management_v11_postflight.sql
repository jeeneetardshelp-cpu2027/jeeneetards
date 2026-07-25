select
  to_regclass('public.catalog_management_audit') is not null
    as audit_table_exists,
  to_regprocedure('public.catalog_manage_capability()') is not null
    as capability_function_exists,
  to_regprocedure('public.get_manage_playlists(text,integer,integer)') is not null
    as list_function_exists,
  to_regprocedure(
    'public.update_managed_playlist(bigint,text,text,text,bigint,bigint[],bigint[],text,text,text,text)'
  ) is not null as update_function_exists,
  to_regprocedure(
    'public.set_managed_video_taxonomy(bigint,bigint,bigint[],bigint[],boolean)'
  ) is not null as video_taxonomy_function_exists,
  to_regprocedure(
    'public.clear_managed_video_taxonomy(bigint,bigint,boolean)'
  ) is not null as video_taxonomy_clear_function_exists,
  to_regprocedure(
    'public.reassign_video_chapter(bigint,bigint,bigint,bigint,boolean)'
  ) is not null as chapter_function_exists,
  to_regprocedure('public.delete_managed_playlist(bigint,text)') is not null
    as delete_function_exists,
  has_function_privilege(
    'authenticated',
    'public.catalog_manage_capability()',
    'execute'
  ) as authenticated_can_call_capability,
  not has_function_privilege(
    'anon',
    'public.catalog_manage_capability()',
    'execute'
  ) as anon_cannot_call_capability,
  (
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.catalog_management_audit')
  ) as audit_rls_enabled;
