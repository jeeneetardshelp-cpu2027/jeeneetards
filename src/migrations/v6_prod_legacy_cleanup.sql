-- ============================================================
--  PRODUCTION PRELUDE — remove the legacy v1 importer.
--
--  WHY THIS FILE EXISTS
--  production ran `import_rpc.sql`, which created:
--        public.import_playlist(payload jsonb)              -- ONE argument
--        grant execute on that function to authenticated;
--
--  v4/v6 create a DIFFERENT signature:
--        public.import_playlist(payload jsonb, mode text default 'merge')
--
--  Different argument lists mean Postgres keeps BOTH. The old one has none of
--  v6's validation — no explicit learning goal, no category↔goal check, no
--  class/goal compatibility, no board rules — and it is granted to every
--  authenticated user.
--
--  Worse, ImportPlaylistForm calls rpc("import_playlist", { payload }) with no
--  `mode`. With both overloads present, a payload-only call can resolve to the
--  LEGACY function, silently bypassing every validation this whole exercise
--  added.
--
--  Staging never hit this: its bootstrap includes import_playlist_v2.sql, which
--  drops the 1-arg version. The production path does not include v2 (v4/v6
--  supersede it), so the drop has to be stated explicitly here.
--
--  Safe on a database that never had it: `drop function if exists` is a no-op.
--  Runs inside the same transaction as the rest of the migration, so there is
--  never a moment where no importer exists.
-- ============================================================

drop function if exists public.import_playlist(jsonb);

-- Also drop the v1-era single-argument helper if it is still present. Same
-- reasoning: superseded, and its presence creates resolution ambiguity.
drop function if exists public.import_playlist(payload jsonb);

-- Verification (run after the migration): must return exactly ONE row,
-- `payload jsonb, mode text`.
--
--   select p.proname, pg_get_function_identity_arguments(p.oid) as args
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'import_playlist';
