import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "staging/forum_suspension_admin_v1_persistent");
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

const normalize = (value) => String(value).replace(/\r\n/g, "\n");
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

const stagingGuard = `-- The staging marker and inactive forum state are checked inside the same
-- transaction that creates the wrappers. A successful earlier preflight is
-- not treated as authorization for a different database or later run.
do $forum_suspension_admin_stage_guard$
declare
  true_markers integer;
  staging_markers integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;

  select
    count(*) filter (where id = true),
    count(*) filter (where id = true and lower(btrim(name)) = 'staging')
  into true_markers, staging_markers
  from public.app_environment;

  if true_markers <> 1 or staging_markers <> 1 then
    raise exception 'REFUSING: suspension-admin install requires exactly one staging marker';
  end if;

  if not exists (
    select 1 from public.forum_settings where id = true and mode = 'off'
  ) then
    raise exception 'REFUSING: forum mode must remain off during suspension-admin installation';
  end if;

  if to_regprocedure(
       'public.forum_admin_set_suspension_by_username(text,integer,text)'
     ) is not null
     or to_regprocedure('public.forum_admin_list_suspensions()') is not null then
    raise exception 'REFUSING: suspension-admin wrappers already exist';
  end if;
end;
$forum_suspension_admin_stage_guard$;`;

const baselineEvidence = `-- Session-local baseline used only by the terminal evidence row. It is
-- created after the staging guard and inside the migration transaction.
create temporary table forum_suspension_admin_stage_baseline
on commit preserve rows
as select
  (select count(*)::integer from public.forum_suspensions) as suspension_rows,
  (select count(*)::integer from public.forum_moderation_log) as moderation_log_rows,
  (select count(*)::integer from public.forum_posts) as post_rows,
  (select count(*)::integer from public.forum_comments) as comment_rows,
  (select count(*)::integer from public.forum_reports) as report_rows;`;

const transactionMarker = "\nbegin;\n";
const markerIndex = sourceText.migration.indexOf(transactionMarker);
if (markerIndex < 0) {
  throw new Error("REFUSING: migration no longer has the reviewed top-level begin marker");
}
const guardedMigration = [
  sourceText.migration.slice(0, markerIndex + transactionMarker.length),
  stagingGuard,
  baselineEvidence,
  sourceText.migration.slice(markerIndex + transactionMarker.length),
].join("\n\n");

const install = `-- ============================================================================
-- FORUM SUSPENSION ADMIN v1 - PERSISTENT DISPOSABLE-STAGING INSTALL
-- STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Preflight SHA-256: ${expectedHashes.preflight}
-- Audit SHA-256: ${expectedHashes.audit}
-- Migration SHA-256: ${expectedHashes.migration}
-- Postflight SHA-256: ${expectedHashes.postflight}
-- ============================================================================

${sourceText.preflight.trim()}

${sourceText.audit.trim()}

${guardedMigration.trim()}

${sourceText.postflight.trim()}

-- Terminal evidence outside the postflight read-only transaction.
select
  (select lower(btrim(name)) from public.app_environment where id = true)
    as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regprocedure(
    'public.forum_admin_set_suspension_by_username(text,integer,text)'
  ) is not null as set_suspension_by_username_installed,
  to_regprocedure('public.forum_admin_list_suspensions()') is not null
    as list_suspensions_installed,
  (select count(*) from public.forum_suspensions) =
    (select suspension_rows from forum_suspension_admin_stage_baseline)
    as suspension_rows_unchanged,
  (select count(*) from public.forum_moderation_log) =
    (select moderation_log_rows from forum_suspension_admin_stage_baseline)
    as moderation_log_rows_unchanged,
  (select count(*) from public.forum_posts) =
    (select post_rows from forum_suspension_admin_stage_baseline)
    as posts_unchanged,
  (select count(*) from public.forum_comments) =
    (select comment_rows from forum_suspension_admin_stage_baseline)
    as comments_unchanged,
  (select count(*) from public.forum_reports) =
    (select report_rows from forum_suspension_admin_stage_baseline)
    as reports_unchanged;
`;

const rollback = normalize(sourceText.rollback);
const artifacts = {
  "install.sql": normalize(install),
  "rollback.sql": rollback,
};
const artifactHashes = Object.fromEntries(
  Object.entries(artifacts).map(([name, text]) => [name, sha256(text)]),
);

const readme = `# Forum suspension-admin v1 persistent staging package

This local package installs only the two reviewed suspension-admin wrappers on
the disposable Supabase staging clone. It is not production authorization, and
creating this package does not authorize running it on staging.

The single install buffer contains the reviewed operations in this order:

1. read-only preflight;
2. read-only counts-only audit;
3. atomic migration, with the staging and forum-off guard inside its transaction;
4. read-only postflight;
5. terminal evidence.

## Before any approved staging run

- Confirm the project ref is the disposable staging project, not production
  \`kezelafqhgqrprpadmlf\`.
- Confirm the clone contains no real production user data.
- Recompute both hashes in \`artifacts.sha256.txt\`.
- Paste and run the complete \`install.sql\` buffer once; do not run fragments.
- If any assertion errors, stop and report it before changing or retrying SQL.

## Successful terminal row

- \`environment_after = staging\`
- \`forum_mode = off\`
- \`set_suspension_by_username_installed = true\`
- \`list_suspensions_installed = true\`
- \`suspension_rows_unchanged = true\`
- \`moderation_log_rows_unchanged = true\`
- \`posts_unchanged = true\`
- \`comments_unchanged = true\`
- \`reports_unchanged = true\`

The unchanged fields compare against a session-local baseline captured after
the staging guard and inside the migration transaction. The later JWT proof
must create a temporary suspension, verify it, lift it, and prove no fixture
residue remains.

\`rollback.sql\` is the exact reviewed staging/test-only rollback. It removes
only these two wrappers and deliberately retains moderation history.
`;

mkdirSync(outputDir, { recursive: true });
for (const [name, text] of Object.entries(artifacts)) {
  writeFileSync(resolve(outputDir, name), text, "utf8");
}
writeFileSync(
  resolve(outputDir, "artifacts.sha256.txt"),
  `${Object.entries(artifactHashes).map(([name, hash]) => `${hash}  ${name}`).join("\n")}\n`,
  "utf8",
);
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");
writeFileSync(
  resolve(outputDir, "source_manifest.json"),
  `${JSON.stringify({
    status: "prepared-local-only-not-authorized-for-execution",
    sources: Object.fromEntries(Object.entries(sources).map(([name, path]) => [
      name,
      { path, sha256: expectedHashes[name] },
    ])),
    artifacts: Object.fromEntries(Object.entries(artifactHashes).map(([name, hash]) => [
      name,
      { path: `staging/forum_suspension_admin_v1_persistent/${name}`, sha256: hash },
    ])),
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Created ${outputDir}`);
for (const [name, hash] of Object.entries(artifactHashes)) {
  console.log(`SHA-256 ${hash}  ${name}`);
}
console.log("No database connection was made; execution is not authorized.");
