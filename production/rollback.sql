-- ============================================================
--  PRODUCTION ROLLBACK — reverses production_migration.sql
--
--  Run ONLY if the migration has been applied and you need to go back.
--  Like the migration, this is one implicit transaction in the SQL Editor.
--
--  READ THIS FIRST — what this does and does not undo:
--
--  UNDONE:  the derived-array triggers, the v4/v6 functions, the grant changes.
--           After this, playlists.class_levels goes back to being an ordinary
--           application-maintained column (i.e. it can drift again).
--
--  NOT UNDONE, deliberately:  the class-levels BACKFILL. The migration only
--           ever ADDED playlist_class_levels rows that were missing — it never
--           deleted a classification. Reversing the backfill would destroy real
--           data to restore a worse state. public.class_levels_migration_audit
--           records exactly which playlists were backfilled, per run_id, if you
--           ever need to identify them.
--
--  NOT UNDONE:  the new reference tables (category_learning_goals,
--           learning_goal_class_levels, playlist_boards, app_environment,
--           class_levels_migration_audit) and their seeded rows. They are
--           additive and harmless; dropping them would cascade-delete board and
--           mapping data. Drop them by hand later if you truly want them gone.
--
--  ⚠ ROLL THE FRONTEND BACK TOO. The deployed app sends learning_goal_id and
--    reads category_learning_goals / playlist_boards / the goal junction. A
--    database rolled back to v2 with a v6 frontend leaves imports failing and
--    Browse empty. Redeploy the pre-v6 build in the same window.
-- ============================================================

-- 1. Stop the array being derived.
drop trigger if exists trg_force_class_levels  on public.playlists;
drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels;

-- 2. Remove the v4/v6 function surface.
drop function if exists public.migrate_class_levels(boolean);
drop function if exists public.purge_migration_audit(int);
drop function if exists public.create_course(jsonb);
drop function if exists public.clear_video_taxonomy(bigint);
drop function if exists public.set_video_taxonomy(bigint, bigint[], bigint[]);
drop function if exists public.validate_import_payload(jsonb, text, boolean);
drop function if exists public.force_derived_class_levels();
drop function if exists public.class_label_to_slug(text);
-- derived_class_levels is used by nothing else once the triggers are gone:
drop function if exists public.derived_class_levels(bigint);

-- 3. Restore the previous importer.
--    import_playlist(jsonb, text) is REPLACED, not dropped, by re-running the
--    v2 file. Paste the full contents of src/migrations/import_playlist_v2.sql
--    HERE, or run it as a second statement batch immediately after this one.
--
--    Do not skip this: dropping the v6 function without restoring v2 leaves the
--    admin panel with no importer at all.

-- 4. Confirm the rollback.
select
  (select count(*) from pg_trigger
    where tgname in ('trg_force_class_levels','trg_sync_pl_class_array')
      and not tgisinternal)                                    as triggers_remaining,   -- expect 0
  to_regprocedure('public.migrate_class_levels(boolean)')      is null as migrate_fn_gone,
  to_regprocedure('public.create_course(jsonb)')               is null as create_course_gone,
  to_regprocedure('public.import_playlist(jsonb, text)')       is not null as importer_restored,
  (select count(*) from public.class_levels_migration_audit)   as audit_rows_kept;
