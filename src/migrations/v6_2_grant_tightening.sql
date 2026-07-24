-- ============================================================
--  v6.2 — GRANT TIGHTENING. Small, safe, idempotent.
--
--  Apply to a database that already has v6. It creates nothing, drops
--  nothing, and touches no data — it only removes EXECUTE privileges that
--  should never have been there.
--
--  WHY
--  Supabase projects ship with default privileges:
--      alter default privileges in schema public
--        grant all on functions to postgres, anon, authenticated, service_role;
--  so every function created in `public` is granted EXECUTE to `authenticated`
--  automatically. v6 revoked from `public, anon` but not `authenticated`, so
--  five functions intended to be service_role-only were executable by any
--  logged-in user:
--      migrate_class_levels, purge_migration_audit, validate_import_payload,
--      has_trigger, seed_blocking_drift_fixture, clear_blocking_drift_fixture
--
--  This was defence-in-depth rather than an open door — each of those
--  re-checks is_admin() OR service_role in its body, and the fixture helpers
--  also call __assert_not_production(). But the grant must match the intent,
--  and the "authenticated reaches the function body" path was untested.
--  Tests AU1-AU3 in verifyImport.js now cover it with a real non-admin user.
--
--  NOT tightened, deliberately: import_playlist, create_course,
--  set_video_taxonomy and clear_video_taxonomy remain granted to
--  `authenticated`, because admins ARE authenticated users. Their bodies
--  enforce is_admin().
-- ============================================================

revoke all on function public.migrate_class_levels(boolean)                from authenticated;
revoke all on function public.purge_migration_audit(int)                   from authenticated;
revoke all on function public.validate_import_payload(jsonb, text, boolean) from authenticated;

-- staging-only helpers (present only where staging_test_helpers.sql ran)
do $$
begin
  if to_regprocedure('public.has_trigger(text)') is not null then
    execute 'revoke all on function public.has_trigger(text) from authenticated';
  end if;
  if to_regprocedure('public.seed_blocking_drift_fixture()') is not null then
    execute 'revoke all on function public.seed_blocking_drift_fixture() from authenticated';
  end if;
  if to_regprocedure('public.clear_blocking_drift_fixture()') is not null then
    execute 'revoke all on function public.clear_blocking_drift_fixture() from authenticated';
  end if;
  if to_regprocedure('public.__assert_not_production()') is not null then
    execute 'revoke all on function public.__assert_not_production() from authenticated';
  end if;
end $$;

-- Verify: this should return zero rows.
select p.proname as still_granted_to_authenticated
  from information_schema.routine_privileges r
  join pg_proc p on p.proname = r.routine_name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where r.routine_schema = 'public'
   and r.grantee = 'authenticated'
   and r.privilege_type = 'EXECUTE'
   and p.proname in ('migrate_class_levels','purge_migration_audit','validate_import_payload',
                     'has_trigger','seed_blocking_drift_fixture','clear_blocking_drift_fixture',
                     '__assert_not_production')
 group by p.proname
 order by p.proname;
