// Build a persistent staging-only installer for the reviewed closed-beta delta.
// This script only reads local SQL and writes review artifacts. It never opens
// a database connection or reads credentials.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  preflight: "src/migrations/forum_closed_beta_v1_preflight.sql",
  audit: "src/migrations/forum_closed_beta_v1_audit.sql",
  migration: "src/migrations/forum_closed_beta_v1.sql",
  postflight: "src/migrations/forum_closed_beta_v1_postflight.sql",
  rollback: "src/migrations/forum_closed_beta_v1_rollback.sql",
  helper: "staging/forum_closed_beta_v1_persistent/http_fixture_helper.sql",
  helperRollback:
    "staging/forum_closed_beta_v1_persistent/http_fixture_helper_rollback.sql",
  verifier: "src/scripts/verifyForumClosedBetaJwtStaging.js",
};
const outputDir = resolve(root, "staging/forum_closed_beta_v1_persistent");
const outputName = "install.sql";
const outputPath = resolve(outputDir, outputName);

const missing = Object.values(sources).filter((path) => !existsSync(resolve(root, path)));
if (missing.length > 0) throw new Error(`REFUSING: missing ${missing.join(", ")}`);

const normalize = (value) => String(value).replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (path) => normalize(readFileSync(resolve(root, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceText = Object.fromEntries(
  Object.entries(sources).map(([key, path]) => [key, read(path)]),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceText).map(([key, value]) => [key, sha256(value)]),
);

const stagingGuard = `-- Persistent closed-beta staging guard. It runs after both read-only gates
-- and before the first beta DDL statement.
do $forum_beta_persistent_stage_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment
  where id = true and lower(name) = 'staging';
  if environment_count <> 1
     or exists (
       select 1 from public.app_environment where id = true and lower(name) <> 'staging'
     ) then
    raise exception 'REFUSING: persistent closed beta requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_posts') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_list_reports(integer)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'REFUSING: reviewed persistent forum baseline is incomplete';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null then
    raise exception 'REFUSING: closed-beta delta is already installed';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: forum mode must be off';
  end if;
  if exists (select 1 from auth.users)
     or exists (select 1 from public.profiles) then
    raise exception 'REFUSING: staging identity store is not empty';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_reports) then
    raise exception 'REFUSING: staging forum data is not empty';
  end if;
end;
$forum_beta_persistent_stage_guard$;
`;

const artifact = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PERSISTENT STAGING INSTALL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Preflight SHA-256: ${sourceHashes.preflight}
-- Audit SHA-256: ${sourceHashes.audit}
-- Migration SHA-256: ${sourceHashes.migration}
-- Postflight SHA-256: ${sourceHashes.postflight}
-- ============================================================================

${sourceText.preflight.trim()}

${sourceText.audit.trim()}

${stagingGuard.trim()}

${sourceText.migration.trim()}

${sourceText.postflight.trim()}

-- Terminal evidence outside the postflight read-only transaction.
select
  (select lower(name) from public.app_environment where id = true) = 'staging'
    as environment_is_staging,
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_beta_members') is not null as beta_table_installed,
  to_regprocedure('public.forum_is_beta_member()') is not null as beta_check_installed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
    as beta_admin_write_installed,
  to_regprocedure('public.forum_admin_list_beta_members()') is not null
    as beta_admin_list_installed,
  not exists (select 1 from public.forum_beta_members) as no_beta_members_created,
  not exists (select 1 from public.forum_posts) as no_posts_created,
  not exists (select 1 from public.forum_reports) as no_reports_created;
`;

const readme = `# Forum closed-beta v1 persistent staging package

This package installs the already-reviewed closed-beta delta **persistently on
the disposable staging clone only**. It does not authorize production work or
opening forum mode.

## Install gate

The generated installer runs the exact preflight and audit, then checks the
staging marker immediately before the first beta DDL. It also requires the
reviewed forum baseline, mode \`off\`, an empty Auth/profile store, no forum
content, and no existing beta objects.

Recompute \`install.sql.sha256.txt\` before running. Paste the complete buffer
into the disposable staging SQL editor and run it once. The terminal row must
have nine fields and every field must be \`true\`.

If the migration commits but postflight or terminal evidence fails, do not
retry. Run the guarded \`src/migrations/forum_closed_beta_v1_rollback.sql\`,
inspect the failure, and verify that the SQL client honours explicit
transactions.

## Real HTTP/JWT proof

After a reviewed persistent install:

1. Install \`http_fixture_helper.sql\` and verify its five-field terminal row.
2. Run \`npm run verify:forum-beta-jwt-staging -- --confirm-forum-beta-jwt-staging\`
   with the guarded staging environment variables.
3. Review the complete JSON evidence file, including cleanup residue.
4. Remove the helper with \`http_fixture_helper_rollback.sql\` and verify its
   three-field terminal row.

The helper accepts only three exact \`@staging.invalid\` Auth fixtures marked
for the current run, is executable only by \`service_role\`, and back-dates the
accounts past the ten-minute writer cooldown. The service-role credential stays
in the uncommitted staging environment file and never enters evidence.

The verifier must finish with mode \`off\`, zero beta memberships, zero fixture
accounts/profiles, and no fixture forum data or audit residue. A failed remote
assertion is a stop condition; do not edit around it live.

The completed 2026-08-07 disposable-staging run is recorded in
\`REAL_STAGING_NOTES.md\`; its complete sanitized 31-check evidence is preserved
in \`REAL_STAGING_JWT_EVIDENCE_2026-08-07.json\`.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, normalize(artifact), "utf8");
const artifactHash = sha256(readFileSync(outputPath));
writeFileSync(
  resolve(outputDir, `${outputName}.sha256.txt`),
  `${artifactHash}  ${outputName}\n`,
  "utf8",
);
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");
writeFileSync(
  resolve(outputDir, "source_manifest.json"),
  `${JSON.stringify({
    status: "persistent-disposable-staging-only-not-executed",
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(sources).map(([key, path]) => [key, {
      path,
      sha256: sourceHashes[key],
    }])),
    artifact: {
      path: `staging/forum_closed_beta_v1_persistent/${outputName}`,
      sha256: artifactHash,
    },
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Created ${outputPath}`);
console.log(`SHA-256 ${artifactHash}`);
console.log("No database connection was made; forum mode remains OFF.");
