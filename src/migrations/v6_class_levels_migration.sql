-- ============================================================
--  v6 STEP 2 — run the class_levels migration.
--
--  Run AFTER import_playlist_v6.sql, and ONLY after the dry-run drift report
--  (npm run drift:report) has been read and approved.
--
--  All the logic now lives in public.migrate_class_levels() so that its abort
--  paths can be tested automatically (review item 4). This file is just the
--  invocation. One function call is one transaction: if the audit finds an
--  unknown label or an ambiguous conflict, it raises, and the audit rows, the
--  backfill and the trigger creation are ALL rolled back together.
--
--  Expected output on current production data (per drift-report.json):
--    {"backfilled": 0, "drift_after": 0, "verdicts": {"agree": 7}, ...}
-- ============================================================

select public.migrate_class_levels(true);

-- Evidence for this run (kept; prior runs are never overwritten):
--   select run_id, verdict, count(*)
--     from public.class_levels_migration_audit
--    group by run_id, verdict order by run_id;
--
-- Retention is explicit, not automatic:
--   select public.purge_migration_audit(3);   -- keep the 3 most recent runs
