-- ============================================================
--  POST-MIGRATION EVIDENCE — production. Read-only: SELECTs only.
--
--  Run immediately after production_migration.sql, inside the maintenance
--  window, BEFORE announcing the migration complete. Save the output.
--
--  ⚠ The Supabase SQL Editor shows only the LAST statement's result. Run these
--    ONE AT A TIME, or highlight a single query and press Run to execute just
--    the selection.
--
--  This is the production counterpart of src/migrations/staging_evidence_queries.sql.
--  The staging-only sections (DRIFTFX fixtures, TESTPL cleanup checks, the
--  has_trigger() helper) are removed — none of those exist in production.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Did the migration run, and what did it decide?
--    Expect exactly ONE run_id. Verdict mix should mirror the pre-migration
--    drift report: mostly 'agree', plus one row per array-only playlist that
--    was backfilled.
-- ------------------------------------------------------------
select run_id,
       verdict,
       count(*)         as playlists,
       min(migrated_at) as run_started
  from public.class_levels_migration_audit
 group by run_id, verdict
 order by run_started, verdict;


-- ------------------------------------------------------------
-- 2. FINAL DRIFT — must be 0. This is the pass/fail gate.
-- ------------------------------------------------------------
select count(*) as drifted_playlists
  from public.playlists p
 where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
       is distinct from
       (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x);


-- ------------------------------------------------------------
-- 3. If (2) is not 0, this names the offenders. Otherwise returns nothing.
-- ------------------------------------------------------------
select p.id, p.title,
       p.class_levels                     as array_says,
       public.derived_class_levels(p.id)  as junction_says
  from public.playlists p
 where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
       is distinct from
       (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x)
 order by p.id;


-- ------------------------------------------------------------
-- 4. Nothing was LOST. Every playlist that had a classification before the
--    migration must still have one. A row here means a classification was
--    dropped — the exact failure v3 would have caused.
-- ------------------------------------------------------------
select a.playlist_id, a.verdict, a.array_labels as before_migration,
       public.derived_class_levels(a.playlist_id) as after_migration
  from public.class_levels_migration_audit a
 where coalesce(array_length(a.array_labels, 1), 0) > 0
   and coalesce(array_length(public.derived_class_levels(a.playlist_id), 1), 0) = 0;
-- Expect ZERO rows.


-- ------------------------------------------------------------
-- 5. Triggers are installed.
-- ------------------------------------------------------------
select t.tgname as trigger_name, c.relname as on_table, pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and t.tgname in ('trg_force_class_levels','trg_sync_pl_class_array')
 order by c.relname, t.tgname;
-- Expect exactly 2 rows.


-- ------------------------------------------------------------
-- 6. AUTHORIZATION — `anon` must be able to execute NOTHING sensitive.
--    Expect: NONE
-- ------------------------------------------------------------
select coalesce(string_agg(distinct routine_name, ', '), 'NONE') as anon_can_execute_sensitive
  from information_schema.routine_privileges
 where routine_schema = 'public'
   and grantee = 'anon'
   and privilege_type = 'EXECUTE'
   and routine_name in ('import_playlist','create_course','set_video_taxonomy','clear_video_taxonomy',
                        'migrate_class_levels','purge_migration_audit','validate_import_payload');


-- ------------------------------------------------------------
-- 7. `authenticated` must NOT hold EXECUTE on the service_role-only functions.
--    Expect: NONE
--    (import_playlist / create_course / set_video_taxonomy / clear_video_taxonomy
--     are correctly granted to authenticated — admins are authenticated users —
--     so they are deliberately not listed here.)
-- ------------------------------------------------------------
select coalesce(string_agg(distinct routine_name, ', '), 'NONE') as authenticated_overgranted
  from information_schema.routine_privileges
 where routine_schema = 'public'
   and grantee = 'authenticated'
   and privilege_type = 'EXECUTE'
   and routine_name in ('migrate_class_levels','purge_migration_audit','validate_import_payload');


-- ------------------------------------------------------------
-- 8. The environment marker exists but is EMPTY. This is what permanently
--    keeps the integration test harness from ever running against production.
--    Expect: table_exists = true, rows = 0
-- ------------------------------------------------------------
select to_regclass('public.app_environment') is not null as table_exists,
       (select count(*) from public.app_environment)     as rows;


-- ------------------------------------------------------------
-- 9. Taxonomy mapping completeness — every goal and every category mapped.
--    Expect both to be 'NONE'.
-- ------------------------------------------------------------
select
  coalesce((select string_agg(lg.slug, ', ') from public.learning_goals lg
             where not exists (select 1 from public.category_learning_goals m
                                where m.learning_goal_id = lg.id)), 'NONE') as unmapped_goals,
  coalesce((select string_agg(c.slug, ', ') from public.categories c
             where not exists (select 1 from public.category_learning_goals m
                                where m.category_id = c.id)), 'NONE')       as unmapped_categories;


-- ------------------------------------------------------------
-- 10. Content is intact — compare against the numbers you recorded BEFORE
--     the migration. No row count should have decreased.
-- ------------------------------------------------------------
select
  (select count(*) from public.playlists)             as playlists,
  (select count(*) from public.videos)                as videos,
  (select count(*) from public.institutes_channels)   as channels,
  (select count(*) from public.playlist_videos)       as playlist_video_links,
  (select count(*) from public.playlist_class_levels) as playlist_class_links,
  (select count(*) from public.video_learning_goals)  as video_goal_links;
