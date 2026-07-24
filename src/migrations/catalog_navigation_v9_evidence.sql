-- CATALOG NAVIGATION v9 — production evidence (read-only).
-- Run each numbered section separately and save the results.

-- 1. Functions exist, are STABLE and remain SECURITY INVOKER.
select p.oid::regprocedure::text as function_signature,
       case p.provolatile when 's' then 'stable' else p.provolatile::text end as volatility,
       case when p.prosecdef then 'definer' else 'invoker' end as security,
       p.proconfig
  from pg_proc p
 where p.oid in (
   to_regprocedure('public.get_browse_curriculum(text,text,text)'),
   to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')
 )
 order by 1;
-- Expect exactly 2 rows, stable + invoker, with an empty search_path setting.

-- 2. Relevant EXECUTE grants. PUBLIC must be absent; anon, authenticated and
-- service_role must each appear for both functions.
select routine_name, grantee, privilege_type
  from information_schema.routine_privileges
 where routine_schema = 'public'
   and routine_name in ('get_browse_curriculum', 'browse_facet_counts')
 order by routine_name, grantee;

-- 3. Supporting indexes exist with the expected columns.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and indexname in ('idx_plg_goal_playlist', 'idx_pcl_class_playlist')
 order by indexname;
-- Expect exactly 2 rows.

-- 4. Anonymous execution boundary. This transaction is read-only and rolls
-- itself back. Expect goal rows followed by zero or more facet rows.
begin read only;
set local role anon;
select * from public.get_browse_curriculum(null, null, null);
select * from public.browse_facet_counts(
  null, null, null, null, null, null, null, null, null);
rollback;

-- 5. No content table was changed by this DDL-only migration. Compare these
-- counts with the baseline recorded immediately before applying it.
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as playlist_video_links,
  (select count(*) from public.playlist_learning_goals) as playlist_goal_links,
  (select count(*) from public.playlist_class_levels) as playlist_class_links;

