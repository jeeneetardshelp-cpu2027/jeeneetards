// Build the review-only Forum closed-beta v1 production delta package.
//
// This script reads local, already-reviewed SQL sources and writes local
// artifacts. It never reads credentials, opens a database connection, or
// authorizes production execution. The generated installer is one explicit
// transaction and leaves the forum mode OFF with no beta members.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "production/forum_closed_beta_v1_release");
const targetProjectRef = "kezelafqhgqrprpadmlf";
const generatorPath = "src/scripts/buildForumClosedBetaProductionPackage.js";

const sources = {
  preflight: "src/migrations/forum_closed_beta_v1_preflight.sql",
  audit: "src/migrations/forum_closed_beta_v1_audit.sql",
  migration: "src/migrations/forum_closed_beta_v1.sql",
  postflight: "src/migrations/forum_closed_beta_v1_postflight.sql",
  rollback: "src/migrations/forum_closed_beta_v1_rollback.sql",
};

const normalize = (value) => String(value).replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (path) => normalize(readFileSync(resolve(root, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceText = Object.fromEntries(
  Object.entries(sources).map(([name, path]) => [name, read(path)]),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceText).map(([name, value]) => [name, sha256(value)]),
);

function transactionBody(source, label) {
  const lines = normalize(source).split("\n");
  const beginIndex = lines.findIndex((line) => /^\s*begin(?: transaction read only)?;\s*$/i.test(line));
  let endIndex = -1;
  for (let index = lines.length - 1; index > beginIndex; index -= 1) {
    if (/^\s*(?:commit|rollback);\s*$/i.test(lines[index])) {
      endIndex = index;
      break;
    }
  }
  if (beginIndex < 0 || endIndex <= beginIndex) {
    throw new Error(`REFUSING: ${label} transaction wrapper drifted`);
  }
  if (lines.slice(endIndex + 1).join("\n").trim()) {
    throw new Error(`REFUSING: ${label} has SQL after its transaction`);
  }
  return `${lines.slice(0, beginIndex).join("\n").trim()}\n${lines
    .slice(beginIndex + 1, endIndex).join("\n").trim()}\n`;
}

function rollbackOperations(source) {
  const startMarker = "drop function public.forum_admin_list_beta_members();";
  const endMarker = "notify pgrst, 'reload schema';";
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf(endMarker);
  if (start < 0 || end <= start) {
    throw new Error("REFUSING: closed-beta rollback structure drifted");
  }
  return `${source.slice(start, end).trim()}\n`;
}

const preflightBody = transactionBody(sourceText.preflight, sources.preflight);
const migrationBody = transactionBody(sourceText.migration, sources.migration);
const postflightBody = transactionBody(sourceText.postflight, sources.postflight);
const reviewedRollbackOperations = rollbackOperations(sourceText.rollback);

const sourceHashHeader = Object.entries(sources)
  .map(([name, path]) => `-- ${name}: ${sourceHashes[name]}  ${path}`)
  .join("\n");

const activityPredicate = `exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events)`;

function productionGuard(label, betaState) {
  const betaAssertion = betaState === "absent"
    ? `if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'REFUSING: ${label} found existing closed-beta objects';
  end if;`
    : `if to_regclass('public.forum_beta_members') is null
     or to_regprocedure('public.forum_is_beta_member()') is null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
     or to_regprocedure('public.forum_admin_list_beta_members()') is null then
    raise exception 'REFUSING: ${label} closed-beta installation is incomplete';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'REFUSING: ${label} found beta members';
  end if;`;

  return `do $forum_beta_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: ${label} requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: ${label} requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: ${label} requires the reviewed Forum v1 production baseline';
  end if;
  if to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_topics') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_votes') is null
     or to_regclass('public.forum_user_stats') is null
     or to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_rate_events') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_list_reports(integer)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'REFUSING: ${label} Forum v1 objects are incomplete';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: ${label} requires forum mode off';
  end if;
  if (${activityPredicate}) then
    raise exception 'REFUSING: ${label} requires an unused Forum v1 baseline';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'REFUSING: ${label} requires the six reviewed launch topics';
  end if;
  ${betaAssertion}
end;
$forum_beta_production_guard$;`;
}

const preflight = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION PREFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE INSTALLER.
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("closed-beta production preflight", "absent")}
select
  current_database() as database_name,
  public.forum_mode() as forum_mode,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_present,
  false as database_changed;
commit;

-- Exact reviewed closed-beta preflight, unchanged.
${sourceText.preflight.trim()}
`;

const audit = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION AUDIT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("closed-beta production audit", "absent")}
select false as database_changed;
commit;

-- Exact reviewed counts-only closed-beta audit, unchanged.
${sourceText.audit.trim()}
`;

const install = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION INSTALL - ATOMIC, NON-IDEMPOTENT, MODE OFF
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE EXACT-HASH APPROVAL.
-- ============================================================================
${sourceHashHeader}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

${productionGuard("closed-beta production install", "absent")}

-- Exact reviewed closed-beta preflight with only its transaction removed.
${preflightBody.trim()}

-- Exact reviewed closed-beta migration with only its transaction removed.
${migrationBody.trim()}

-- Exact reviewed closed-beta postflight with only its transaction removed.
${postflightBody.trim()}

do $forum_beta_production_terminal_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: forum mode is not off';
  end if;
  if exists (select 1 from public.forum_beta_members) then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: beta members were created';
  end if;
  if (${activityPredicate}) then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: forum activity was created';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'CLOSED-BETA PRODUCTION INSTALL: Forum v1 rollback state drifted';
  end if;
end;
$forum_beta_production_terminal_assert$;

notify pgrst, 'reload schema';
commit;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_beta_members') is not null as beta_table_installed,
  to_regprocedure('public.forum_is_beta_member()') is not null as beta_check_installed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
    as beta_admin_write_installed,
  to_regprocedure('public.forum_admin_list_beta_members()') is not null
    as beta_admin_list_installed,
  not exists (select 1 from public.forum_beta_members) as no_beta_members_created,
  not exists (select 1 from public.forum_posts) as no_posts_created,
  not exists (select 1 from public.forum_reports) as no_reports_created,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained;
`;

const postflight = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION POSTFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("closed-beta production postflight", "present")}
select false as database_changed;
commit;

-- Exact reviewed closed-beta postflight, unchanged.
${sourceText.postflight.trim()}

begin transaction read only;
select
  public.forum_mode() = 'off' as forum_mode_is_off,
  not exists (select 1 from public.forum_beta_members) as no_beta_members,
  not exists (select 1 from public.forum_posts) as no_posts,
  not exists (select 1 from public.forum_reports) as no_reports,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained,
  false as database_changed;
commit;
`;

const rollback = `-- ============================================================================
-- FORUM CLOSED-BETA v1 PRODUCTION ROLLBACK - DESTRUCTIVE, GUARDED, PRE-BETA ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE EXACT-HASH APPROVAL.
--
-- This removes only the closed-beta delta. It refuses unless mode is OFF,
-- there are no beta members, and the Forum v1 baseline remains unused.
-- ============================================================================
${sourceHashHeader}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

${productionGuard("closed-beta production rollback", "present")}

-- Exact reviewed rollback operations. Only the staging guard and outer
-- transaction wrapper from the source rollback are replaced.
${reviewedRollbackOperations.trim()}

do $forum_beta_production_rollback_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'closed-beta production rollback: forum mode drifted';
  end if;
  if to_regclass('public.forum_beta_members') is not null
     or to_regprocedure('public.forum_is_beta_member()') is not null
     or to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
     or to_regprocedure('public.forum_admin_list_beta_members()') is not null then
    raise exception 'closed-beta production rollback: beta objects remain';
  end if;
  if to_regclass('public.forum_settings') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_list_reports(integer)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'closed-beta production rollback: Forum v1 baseline was damaged';
  end if;
end;
$forum_beta_production_rollback_assert$;

notify pgrst, 'reload schema';
commit;

select
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regclass('public.forum_beta_members') is null as beta_table_removed,
  to_regprocedure('public.forum_is_beta_member()') is null as beta_check_removed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
    as beta_admin_write_removed,
  to_regprocedure('public.forum_admin_list_beta_members()') is null
    as beta_admin_list_removed,
  to_regclass('public.forum_settings') is not null as baseline_forum_retained,
  to_regprocedure('public.forum_claim_username(text)') is not null as username_claim_retained,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_retained;
`;

const readme = `# Forum closed-beta v1 production delta package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project \`${targetProjectRef}\`.

SQL cannot read a Supabase project reference. Every artifact therefore requires
\`public.app_environment\` to exist with **zero rows**, the production convention
in this repository. The operator must still confirm the project reference in
the Supabase dashboard before any future run.

## Files and future run order

1. \`preflight.sql\` - read-only; retain every result row.
2. \`audit.sql\` - read-only counts and readiness booleans; no student identity
   or content values are returned.
3. \`install.sql\` - the production mutation; requires a separate deliberate
   approval of its exact SHA-256 and a fresh verified PITR/backup restore point.
4. \`postflight.sql\` - read-only after installation.

The preflight and installer refuse unless the reviewed Forum v1 production
baseline and its private rollback state are present, mode is \`off\`, all
non-seed forum tables are empty, six launch topics remain active, and no beta
object exists.

## Atomicity and terminal state

\`install.sql\` is one explicit transaction. It contains the exact reviewed
closed-beta preflight, migration, and postflight bodies with only their outer
transaction wrappers removed. Any assertion failure aborts the transaction.
Stop and review the error and database state; do not edit or retry live.

The package is deliberately non-idempotent. Do not add \`if not exists\`.
Successful installation leaves forum mode \`off\`, creates no beta members or
forum activity, retains the baseline \`forum_install_state\`, and does not alter
the frontend release flag.

The install terminal row has nine booleans and every field must be \`true\`.
The postflight must then pass independently.

## Rollback

Do not run \`rollback.sql\` automatically. It is a separately destructive,
separately approved recovery action that removes only the closed-beta delta and
retains Forum v1. It refuses after mode changes, beta enrollment, or any forum
activity. Once membership or beta testing starts, this rollback is no longer
the approved recovery path.

## Later gates not authorized here

Installing this schema does not authorize mode \`beta\`, adding beta members,
production Auth/JWT write tests, a frontend deployment, or opening the forum.
With mode \`off\`, anonymous production forum reads must continue to fail closed.

## Hash review

Run \`npm.cmd run build:forum-beta-production\`, independently recompute every
entry in \`SHA256SUMS.txt\`, compare \`source_manifest.json\`, and review the
full SQL. The builder never reads credentials or connects to Supabase.
`;

const artifacts = {
  "preflight.sql": normalize(preflight),
  "audit.sql": normalize(audit),
  "install.sql": normalize(install),
  "postflight.sql": normalize(postflight),
  "rollback.sql": normalize(rollback),
  "README.md": normalize(readme),
};

mkdirSync(outputDir, { recursive: true });
for (const [name, value] of Object.entries(artifacts)) {
  writeFileSync(resolve(outputDir, name), value, "utf8");
}

const artifactHashes = Object.fromEntries(
  Object.entries(artifacts).map(([name, value]) => [name, sha256(value)]),
);
const manifest = {
  status: "prepared-only-not-authorized-for-production-execution",
  targetProjectRef,
  sourcePolicy: "exact reviewed bodies; outer wrappers replaced only inside guarded artifacts",
  generator: { path: generatorPath, sha256: sha256(read(generatorPath)) },
  sources: Object.fromEntries(Object.entries(sources).map(([name, path]) => [name, {
    path,
    sha256: sourceHashes[name],
  }])),
  artifacts: Object.fromEntries(Object.entries(artifactHashes).map(([name, hash]) => [name, {
    path: `production/forum_closed_beta_v1_release/${name}`,
    sha256: hash,
  }])),
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(resolve(outputDir, "source_manifest.json"), manifestText, "utf8");

const reviewHashes = {
  ...artifactHashes,
  "source_manifest.json": sha256(manifestText),
};
const sums = Object.entries(reviewHashes)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, hash]) => `${hash}  ${name}`)
  .join("\n") + "\n";
writeFileSync(resolve(outputDir, "SHA256SUMS.txt"), sums, "utf8");

console.log(`Created ${outputDir}`);
for (const [name, hash] of Object.entries(artifactHashes)) {
  console.log(`${hash}  ${name}`);
}
console.log("No database connection was made; production execution is not authorized.");
