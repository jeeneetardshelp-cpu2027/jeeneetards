import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  preflight: "src/migrations/forum_v1_preflight.sql",
  core: "src/migrations/forum_v1.sql",
  postflight: "src/migrations/forum_v1_postflight.sql",
};
const outputDir = resolve(root, "staging/forum_v1_persistent");
const outputName = "install.sql";
const outputPath = resolve(outputDir, outputName);

const normalize = (value) => String(value).replace(/\r\n/g, "\n");
const read = (relativePath) => normalize(readFileSync(resolve(root, relativePath), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const preflight = read(sources.preflight);
const core = read(sources.core);
const postflight = read(sources.postflight);
const sourceHashes = {
  preflight: sha256(preflight),
  core: sha256(core),
  postflight: sha256(postflight),
};

const stagingGuard = `-- Persistent staging guard. This executes after the read-only preflight and
-- before the first forum DDL statement.
do $forum_persistent_stage_guard$
declare
  environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;

  select count(*) into environment_count
  from public.app_environment
  where id = true and name = 'staging';

  if environment_count <> 1
     or exists (
       select 1 from public.app_environment where id = true and name <> 'staging'
     ) then
    raise exception 'REFUSING: persistent forum install requires exactly one staging marker';
  end if;

  if to_regclass('public.forum_settings') is not null
     or to_regclass('public.forum_posts') is not null
     or to_regprocedure('public.forum_create_post(text,text,text)') is not null then
    raise exception 'REFUSING: forum objects already exist';
  end if;
end;
$forum_persistent_stage_guard$;
`;

const artifact = `-- ============================================================================
-- FORUM v1 PERSISTENT STAGING INSTALL
-- STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Preflight SHA-256: ${sourceHashes.preflight}
-- Core SHA-256: ${sourceHashes.core}
-- Postflight SHA-256: ${sourceHashes.postflight}
-- ============================================================================

${preflight.trim()}

${stagingGuard.trim()}

${core.trim()}

${postflight.trim()}

-- Terminal evidence outside the postflight read-only transaction.
select
  (select name from public.app_environment where id = true) as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regclass('public.forum_posts') is not null as forum_posts_installed,
  to_regprocedure('public.forum_create_post(text,text,text)') is not null as forum_rpcs_installed,
  (select count(*) from public.forum_topics where is_active) = 6 as six_topics_installed;
`;

const readme = `# Forum v1 persistent staging install

This package installs the reviewed forum schema **persistently on the disposable
staging clone only**. It is not a production package.

The generated SQL contains the exact reviewed preflight, core migration and
postflight. A staging marker guard runs after the read-only preflight and before
the first forum DDL. The installed forum mode remains \`off\`.

## Expected terminal row

- \`environment_after = staging\`
- \`forum_mode = off\`
- \`forum_posts_installed = true\`
- \`forum_rpcs_installed = true\`
- \`six_topics_installed = true\`

If the core commits but postflight or terminal evidence fails, do not retry the
installer. Run the guarded \`src/migrations/forum_v1_rollback.sql\`, inspect the
failure, and rebuild from an empty staging schema.

After installation, install \`http_fixture_helper.sql\`, run the guarded HTTP
JWT verifier, then run \`http_fixture_helper_rollback.sql\`. The helper is
staging-only, restricted to \`service_role\`, and must not remain installed.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, normalize(artifact), "utf8");
const artifactHash = sha256(readFileSync(outputPath));
writeFileSync(resolve(outputDir, `${outputName}.sha256.txt`), `${artifactHash}  ${outputName}\n`, "utf8");
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");
writeFileSync(resolve(outputDir, "source_manifest.json"), `${JSON.stringify({
  status: "persistent-disposable-staging-only",
  generatedAt: new Date().toISOString(),
  sources: {
    preflight: { path: sources.preflight, sha256: sourceHashes.preflight },
    core: { path: sources.core, sha256: sourceHashes.core },
    postflight: { path: sources.postflight, sha256: sourceHashes.postflight },
  },
  artifact: { path: `staging/forum_v1_persistent/${outputName}`, sha256: artifactHash },
}, null, 2)}\n`, "utf8");

console.log(`Created ${outputPath}`);
console.log(`SHA-256 ${artifactHash}`);
console.log("Forum mode remains OFF; no database connection was made.");
