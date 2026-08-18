import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = "production/forum_suspension_admin_v1_release";
const outputDir = resolve(root, outputDirectory);
const generatorPath = "src/scripts/buildForumSuspensionAdminProductionPackage.js";
const targetProjectRef = "kezelafqhgqrprpadmlf";
const sources = {
  preflight: "src/migrations/forum_suspension_admin_v1_preflight.sql",
  audit: "src/migrations/forum_suspension_admin_v1_audit.sql",
  migration: "src/migrations/forum_suspension_admin_v1.sql",
  postflight: "src/migrations/forum_suspension_admin_v1_postflight.sql",
  rollback: "src/migrations/forum_suspension_admin_v1_rollback.sql",
};
const expectedHashes = {
  preflight: "f72b8b986c51b7d4e9d8152c8fb7c7be90b74efb17c81c393daedb3463eb4860",
  audit: "ee05eef1cddaf809a4243e42f2037ac0ccd41797f55b2c13f40096549192f6f5",
  migration: "b3aedd53e5277a61d65ceff6f2b726d284dc0b28b9891af87af86230b13da49c",
  postflight: "3bbb66f082dca359a8133605536baaf112d7f464cb20f8f03bb2fe80ca5bb3d1",
  rollback: "bdbb1e893ea28530254e847e0e8b15889e54ae714e9bc82035fc89e94b073b4c",
};

const normalize = (value) => String(value).replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (relativePath) => normalize(readFileSync(resolve(root, relativePath), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceText = Object.fromEntries(
  Object.entries(sources).map(([name, path]) => [name, read(path)]),
);

for (const [name, text] of Object.entries(sourceText)) {
  const actual = sha256(text);
  if (actual !== expectedHashes[name]) {
    throw new Error(
      `REFUSING: ${sources[name]} changed; expected ${expectedHashes[name]}, got ${actual}`,
    );
  }
}

const sourceHashHeader = Object.entries(sources)
  .map(([name, path]) => `-- ${name}: ${expectedHashes[name]}  ${path}`)
  .join("\n");

function productionGuard(phase, installed) {
  const wrapperCondition = installed
    ? `to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is null
     or to_regprocedure('public.forum_admin_list_suspensions()') is null`
    : `to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null`;
  const wrapperMessage = installed
    ? "suspension-admin installation is incomplete"
    : "suspension-admin wrappers already exist";

  return `do $forum_suspension_admin_production_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: suspension-admin production ${phase} requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: suspension-admin production ${phase} requires the empty production environment marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: suspension-admin production ${phase} requires the reviewed Forum v1 production baseline';
  end if;
  if to_regclass('public.profiles') is null
     or to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_votes') is null
     or to_regclass('public.forum_user_stats') is null
     or to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_moderation_log') is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_rate_events') is null
     or to_regprocedure('public.forum_mode()') is null
     or to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is null
     or to_regprocedure('public.forum_username_is_allowed(text)') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception 'REFUSING: suspension-admin production ${phase} Forum v1 objects are incomplete';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: suspension-admin production ${phase} requires forum mode off';
  end if;
  if to_regprocedure(
       'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
     ) is not null then
    raise exception 'REFUSING: suspension-admin production ${phase} found a staging fixture helper';
  end if;
  if ${wrapperCondition} then
    raise exception 'REFUSING: suspension-admin production ${phase} ${wrapperMessage}';
  end if;
end;
$forum_suspension_admin_production_guard$;`;
}

function baselineTable(tableName) {
  return `create temporary table ${tableName}
on commit preserve rows
as select
  (select count(*)::integer from public.profiles) as profile_rows,
  (select count(*)::integer from public.forum_posts) as post_rows,
  (select count(*)::integer from public.forum_comments) as comment_rows,
  (select count(*)::integer from public.forum_votes) as vote_rows,
  (select count(*)::integer from public.forum_user_stats) as user_stat_rows,
  (select count(*)::integer from public.forum_reports) as report_rows,
  (select count(*)::integer from public.forum_moderation_log) as moderation_log_rows,
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  (select count(*)::integer from public.forum_rate_events) as rate_event_rows;`;
}

function unchangedColumns(tableName) {
  return `
  (select count(*) from public.profiles) =
    (select profile_rows from ${tableName})
    as profiles_unchanged,
  (select count(*) from public.forum_posts) =
    (select post_rows from ${tableName})
    as posts_unchanged,
  (select count(*) from public.forum_comments) =
    (select comment_rows from ${tableName})
    as comments_unchanged,
  (select count(*) from public.forum_votes) =
    (select vote_rows from ${tableName})
    as votes_unchanged,
  (select count(*) from public.forum_user_stats) =
    (select user_stat_rows from ${tableName})
    as user_stats_unchanged,
  (select count(*) from public.forum_reports) =
    (select report_rows from ${tableName})
    as reports_unchanged,
  (select count(*) from public.forum_moderation_log) =
    (select moderation_log_rows from ${tableName})
    as moderation_log_unchanged,
  (select count(*) from public.forum_suspensions) =
    (select suspension_rows from ${tableName})
    as suspensions_unchanged,
  (select count(*) from public.forum_rate_events) =
    (select rate_event_rows from ${tableName})
    as rate_events_unchanged`;
}

const transactionMarker = "\nbegin;\n";
const transactionIndex = sourceText.migration.indexOf(transactionMarker);
if (transactionIndex < 0) {
  throw new Error("REFUSING: migration no longer has the reviewed top-level begin marker");
}
const guardedMigration = [
  sourceText.migration.slice(0, transactionIndex + transactionMarker.length),
  "set local lock_timeout = '5s';\nset local statement_timeout = '180s';",
  productionGuard("install", false),
  baselineTable("forum_suspension_admin_production_install_baseline"),
  sourceText.migration.slice(transactionIndex + transactionMarker.length),
].join("\n\n");

const preflight = normalize(`-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION PREFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE INSTALLER.
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("preflight", false)}
select
  current_database() as database_name,
  (select mode from public.forum_settings where id = true) as forum_mode,
  (select count(*) from public.forum_install_state) = 1 as baseline_state_present,
  false as database_changed;
commit;

-- Exact reviewed source preflight, unchanged.
${sourceText.preflight.trim()}
`);

const audit = normalize(`-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION AUDIT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("audit", false)}
select false as database_changed;
commit;

-- Exact reviewed counts-only source audit, unchanged.
${sourceText.audit.trim()}
`);

const install = normalize(`-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION INSTALL - MUTATING, ATOMIC, GUARDED
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.
-- ============================================================================
${sourceHashHeader}

-- Read-only gates run first. The production guard is repeated inside the
-- mutation transaction, so an earlier successful check is never authorization.
${sourceText.preflight.trim()}

${sourceText.audit.trim()}

${guardedMigration.trim()}

${sourceText.postflight.trim()}

-- Terminal evidence after the independent postflight.
select
  (select mode from public.forum_settings where id = true) = 'off'
    as forum_mode_is_off,
  (select count(*) from public.forum_install_state) = 1
    as baseline_state_retained,
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is not null as set_suspension_by_username_installed,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_installed,
  to_regprocedure(
    'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
  ) is null as staging_fixture_helper_absent,
${unchangedColumns("forum_suspension_admin_production_install_baseline")};
`);

const postflight = normalize(`-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION POSTFLIGHT - READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("postflight", true)}
select false as database_changed;
commit;

-- Exact reviewed source postflight, unchanged.
${sourceText.postflight.trim()}

begin transaction read only;
select
  (select mode from public.forum_settings where id = true) = 'off'
    as forum_mode_is_off,
  (select count(*) from public.forum_install_state) = 1
    as baseline_state_retained,
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is not null as set_suspension_by_username_installed,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_installed,
  to_regprocedure(
    'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
  ) is null as staging_fixture_helper_absent,
  false as database_changed;
commit;
`);

const rollback = normalize(`-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 PRODUCTION ROLLBACK - DESTRUCTIVE, GUARDED
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING REQUIRES SEPARATE EXACT-HASH OWNER APPROVAL.
--
-- This removes only the two username-facing wrappers. Suspension rows and
-- moderation history are deliberately retained; the reviewed UUID RPC remains.
-- ============================================================================
${sourceHashHeader}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
${productionGuard("rollback", true)}
${baselineTable("forum_suspension_admin_production_rollback_baseline")}

drop function public.forum_admin_list_suspensions();
drop function public.forum_admin_set_suspension_by_username(text,integer,text);

do $forum_suspension_admin_production_rollback_assert$
begin
  if to_regprocedure(
       'public.forum_admin_set_suspension_by_username(text,integer,text)'
     ) is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'suspension-admin production rollback: wrappers remain';
  end if;
  if to_regprocedure(
       'public.forum_admin_set_suspension(uuid,timestamptz,text)'
     ) is null
     or to_regclass('public.forum_suspensions') is null
     or to_regclass('public.forum_moderation_log') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'suspension-admin production rollback: Forum v1 baseline was damaged';
  end if;
  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'suspension-admin production rollback: forum mode drifted';
  end if;
end;
$forum_suspension_admin_production_rollback_assert$;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is null as set_suspension_by_username_removed,
  to_regprocedure('public.forum_admin_list_suspensions()') is null
    as list_suspensions_removed,
  to_regprocedure(
    'public.forum_admin_set_suspension(uuid,timestamptz,text)'
  ) is not null as reviewed_suspension_rpc_retained,
  (select mode from public.forum_settings where id = true) = 'off'
    as forum_mode_is_off,
  (select count(*) from public.forum_install_state) = 1
    as baseline_state_retained,
${unchangedColumns("forum_suspension_admin_production_rollback_baseline")};
`);

const readme = `# Forum suspension-admin v1 production package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project \`${targetProjectRef}\`.

SQL cannot read a Supabase project reference. Every artifact therefore requires
\`public.app_environment\` to exist with **zero rows**, the production convention
in this repository. The operator must still confirm the project reference in
the Supabase dashboard before any future run.

## Files and future run order

1. \`preflight.sql\` - read-only; retain every result row.
2. \`audit.sql\` - read-only counts only; no username, reason, account id,
   student content, or email is returned.
3. \`install.sql\` - production mutation. It requires separate deliberate
   approval of its exact SHA-256 and a fresh verified PITR/backup restore point.
4. \`postflight.sql\` - independent read-only verification after installation.

The installer is deliberately non-idempotent and creates only two functions.
It leaves forum mode \`off\`, creates no suspension or moderation row, changes no
profile or forum-content row, installs no staging fixture helper, and does not
change \`RELEASE_FEATURES.forum\`.

The mutation is one explicit transaction. The production marker, Forum v1
baseline, forum-off state, staging-helper absence, and wrapper absence are
checked again inside that transaction before either function is created. Any
failure aborts the transaction; stop and review rather than editing or retrying
live SQL.

## Successful installer evidence

Every boolean in the terminal row must be \`true\`: mode off, baseline retained,
both wrappers installed, staging helper absent, and all nine profile/forum table
counts unchanged. Then run the independent postflight and retain its rows.

## Rollback

Do not run \`rollback.sql\` automatically. It is a separate destructive action
requiring separate exact-hash approval. It removes only the two wrappers and
retains every suspension and moderation-log row. The reviewed UUID-taking
\`forum_admin_set_suspension(uuid, timestamptz, text)\` RPC remains available,
but the browser admin UI loses its username-based path after rollback.

## Not authorized by this package

Preparing or installing these wrappers does not authorize changing forum mode,
changing the frontend release flag, creating production test accounts, running
JWT write tests, suspending a student, or deploying UI changes.

## Review

Run \`npm.cmd run build:forum-suspension-admin-production\`, independently
recompute every entry in \`SHA256SUMS.txt\`, compare \`source_manifest.json\`,
read the full SQL, and verify the package PR before considering execution.
The builder reads no credential and makes no network or database connection.
`;

const artifacts = {
  "preflight.sql": preflight,
  "audit.sql": audit,
  "install.sql": install,
  "postflight.sql": postflight,
  "rollback.sql": rollback,
  "README.md": normalize(readme),
};
const artifactHashes = Object.fromEntries(
  Object.entries(artifacts).map(([name, value]) => [name, sha256(value)]),
);

mkdirSync(outputDir, { recursive: true });
for (const [name, value] of Object.entries(artifacts)) {
  writeFileSync(resolve(outputDir, name), value, "utf8");
}

const manifest = {
  status: "prepared-only-not-authorized-for-production-execution",
  targetProjectRef,
  sourcePolicy: "exact reviewed sources; production guards and transaction framing are generated locally",
  generator: {
    path: generatorPath,
    sha256: sha256(read(generatorPath)),
  },
  sources: Object.fromEntries(Object.entries(sources).map(([name, path]) => [
    name,
    { path, sha256: expectedHashes[name] },
  ])),
  artifacts: Object.fromEntries(Object.entries(artifactHashes).map(([name, hash]) => [
    name,
    { path: `${outputDirectory}/${name}`, sha256: hash },
  ])),
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(resolve(outputDir, "source_manifest.json"), manifestText, "utf8");

const sums = {
  ...artifactHashes,
  "source_manifest.json": sha256(manifestText),
};
writeFileSync(
  resolve(outputDir, "SHA256SUMS.txt"),
  `${Object.entries(sums).sort(([left], [right]) => left.localeCompare(right))
    .map(([name, hash]) => `${hash}  ${name}`).join("\n")}\n`,
  "utf8",
);

console.log(`Created ${outputDir}`);
for (const [name, hash] of Object.entries(sums)) {
  console.log(`SHA-256 ${hash}  ${name}`);
}
console.log("No credential was read and no database connection was made.");
console.log("Production execution is not authorized.");
