// Build a staging-only, rollback-always rehearsal of the v9 production wrapper.
// It performs no connection. The generated SQL must be pasted into the
// disposable staging SQL Editor and must never be run on production.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  preflight: "src/migrations/catalog_navigation_v9_production_preflight.sql",
  core: "src/migrations/catalog_navigation_v9.sql",
  postflight: "src/migrations/catalog_navigation_v9_production_postflight.sql",
};
const missing = Object.values(sources).filter((path) => !existsSync(resolve(root, path)));
if (missing.length) {
  console.error(`REFUSING: missing ${missing.join(", ")}`);
  process.exit(1);
}

const read = (path) => readFileSync(resolve(root, path), "utf8");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const core = read(sources.core);
const expectedCore = "1609de029bc1d94e07ec021fff6499f3203e669bbca0887d1013453ff7425140";
if (sha(core) !== expectedCore) {
  console.error("REFUSING: the v9 core changed after staging verification.");
  process.exit(1);
}

const sql = `-- ============================================================
-- CATALOG NAVIGATION v9 — PRODUCTION WRAPPER REHEARSAL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- This deliberately ends with ROLLBACK. It temporarily removes the existing
-- v9 functions/indexes, executes the exact production preflight + verified
-- core + postflight, checks anonymous access and content counts, then restores
-- the original staging state.
--
-- If any error appears, stop and run this separately in the same SQL Editor:
--   rollback;
-- Then send Codex the first error verbatim.
-- ============================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $staging_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  if not exists (
    select 1 from public.app_environment where lower(coalesce(name, '')) = 'staging'
  ) then
    raise exception 'REFUSING: this rehearsal requires the staging marker';
  end if;
end
$staging_guard$;

-- Keep baseline numbers only as transaction-local settings. No table is
-- created, so there is no RLS surface and nothing persists after ROLLBACK.
select set_config('catalog_v9.baseline_playlists',
  (select count(*)::text from public.playlists), true);
select set_config('catalog_v9.baseline_videos',
  (select count(*)::text from public.videos), true);
select set_config('catalog_v9.baseline_playlist_video_links',
  (select count(*)::text from public.playlist_videos), true);
select set_config('catalog_v9.baseline_playlist_goal_links',
  (select count(*)::text from public.playlist_learning_goals), true);
select set_config('catalog_v9.baseline_playlist_class_links',
  (select count(*)::text from public.playlist_class_levels), true);

-- Make the production environment guard pass only inside this transaction.
update public.app_environment
   set name = 'production'
 where lower(coalesce(name, '')) = 'staging';

-- Remove the already-verified staging objects inside this transaction so the
-- production preflight can prove it refuses unknown existing definitions and
-- the core must really recreate every object.
drop function if exists public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text);
drop function if exists public.get_browse_curriculum(text, text, text);
drop index if exists public.idx_plg_goal_playlist;
drop index if exists public.idx_pcl_class_playlist;

-- EXACT PRODUCTION PREFLIGHT
${read(sources.preflight)}

-- EXACT STAGING-VERIFIED CORE (SHA-256 ${expectedCore})
${core}

-- EXACT PRODUCTION POSTFLIGHT
${read(sources.postflight)}

-- Prove the public boundary, not merely owner execution.
set local role anon;
select count(*) as anonymous_goal_rows
  from public.get_browse_curriculum(null, null, null);
select count(*) as anonymous_facet_rows
  from public.browse_facet_counts(null, null, null, null, null, null, null, null, null);
reset role;

do $content_check$
begin
  if exists (
    select 1
     where current_setting('catalog_v9.baseline_playlists')::bigint
             <> (select count(*) from public.playlists)
        or current_setting('catalog_v9.baseline_videos')::bigint
             <> (select count(*) from public.videos)
        or current_setting('catalog_v9.baseline_playlist_video_links')::bigint
             <> (select count(*) from public.playlist_videos)
        or current_setting('catalog_v9.baseline_playlist_goal_links')::bigint
             <> (select count(*) from public.playlist_learning_goals)
        or current_setting('catalog_v9.baseline_playlist_class_links')::bigint
             <> (select count(*) from public.playlist_class_levels)
  ) then
    raise exception 'CONTENT CHECK: a content or junction count changed';
  end if;
end
$content_check$;

-- Always restore the original functions, indexes, environment marker and rows.
rollback;

-- These checks run after rollback and describe the restored staging state.
select
  (select name from public.app_environment limit 1) as environment_after,
  to_regprocedure('public.get_browse_curriculum(text,text,text)') is not null
    as curriculum_function_restored,
  to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null
    as facet_function_restored,
  to_regclass('public.idx_plg_goal_playlist') is not null
    as goal_index_restored,
  to_regclass('public.idx_pcl_class_playlist') is not null
    as class_index_restored;
`;

const outputName = "catalog_navigation_v9_production_wrapper_staging_dry_run_v3.sql";
const output = resolve(root, outputName);
const hashOutput = resolve(root, "catalog_navigation_v9_production_wrapper_staging_dry_run_v3.sha256.txt");
writeFileSync(output, sql, "utf8");
const digest = sha(sql);
writeFileSync(hashOutput, `${digest}  ${outputName}\n`, "utf8");

console.log(`✓ ${output}`);
console.log(`  sha256: ${digest}`);
console.log("  target: disposable staging only; explicit rollback; no connection made");
