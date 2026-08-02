// Build a production-targeted wrapper from the exact rehearsed v13 artifact.
// This script reads and writes local files only; it never connects to Supabase.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = resolve(
  root,
  "production/chapter_class_scopes_v13_clone_rehearsal/persistent_clone_apply.sql",
);
const outputDir = resolve(root, "production/chapter_class_scopes_v13_production");
const outputPath = resolve(outputDir, "production_apply.sql");
const expectedSourceSha =
  "3a36b1f0681ce8c2ba181a042e6d68086009c00bdcf1d7db5a7f80b00dc7f28f";
const productionRef = "kezelafqhgqrprpadmlf";
const pitrRestorePoint = "02 Aug 2026, 00:07:09 UTC+05:30";

const normalize = (value) => value.replace(/\r\n/g, "\n");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const source = normalize(readFileSync(sourcePath, "utf8"));
if (sha256(source) !== expectedSourceSha) {
  throw new Error("REFUSING: rehearsed persistent artifact hash drift");
}

const clonePreamble = `-- ============================================================
-- CHAPTER CLASS SCOPES v13 - PERSISTENT CLONE APPLY
-- ISOLATED RESTORE CLONE nusprumijjthmrthaitp ONLY. NEVER RUN ON PRODUCTION.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.chapter_scope_v13_clone_authorization') is null
     or not exists (
       select 1
         from public.chapter_scope_v13_clone_authorization
        where clone_ref = 'nusprumijjthmrthaitp'
     ) then
    raise exception 'REFUSING: approved restore-clone marker is absent';
  end if;
end
$target_guard$;`;

const productionPreamble = `-- ============================================================
-- CHAPTER CLASS SCOPES v13 - PRODUCTION APPLY
-- PRODUCTION PROJECT ${productionRef} ONLY.
-- OWNER-APPROVED AFTER PITR RESTORE POINT ${pitrRestorePoint}.
-- DERIVED FROM REHEARSED SHA-256 ${expectedSourceSha}.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
  if to_regclass('public.chapter_scope_v13_clone_authorization') is not null then
    raise exception 'REFUSING: restore-clone authorization marker exists';
  end if;
  if md5(pg_get_functiondef(to_regprocedure('public.get_browse_curriculum(text,text,text)')::oid)) <>
       'b71d62cc849eec7a72d1607ce205186e'
     or md5(pg_get_functiondef(to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')::oid)) <>
       '48f982ef788b570def824aa770ae892b' then
    raise exception 'REFUSING: pre-v13 browse function definition drift';
  end if;
  if (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('public.get_browse_curriculum(text,text,text)')) <>
       '37a7ab878ddb3c8de2877e90e7224b7e'
     or (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')) <>
       '37a7ab878ddb3c8de2877e90e7224b7e' then
    raise exception 'REFUSING: pre-v13 browse function grant drift';
  end if;
end
$target_guard$;`;

if (!source.startsWith(clonePreamble)) {
  throw new Error("REFUSING: clone target guard structure drift");
}
if (!source.endsWith("select 'persistent clone apply verified' as result;\n")) {
  throw new Error("REFUSING: clone postflight result structure drift");
}

const production = source
  .replace(clonePreamble, productionPreamble)
  .replace(
    "select 'persistent clone apply verified' as result;",
    "select 'persistent production apply verified' as result;",
  );

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, production, "utf8");
const productionSha = sha256(production);
writeFileSync(
  resolve(outputDir, "production_apply.sha256.txt"),
  `${productionSha}  production_apply.sql\n`,
  "utf8",
);
writeFileSync(
  resolve(outputDir, "README.md"),
  `# Chapter class scopes v13 - production apply\n\n` +
    `Target: \`${productionRef}\` only.\n\n` +
    `PITR restore point recorded before approval: \`${pitrRestorePoint}\`.\n\n` +
    `The migration body is derived from rehearsed artifact SHA-256 ` +
    `\`${expectedSourceSha}\`. The wrapper refuses non-empty ` +
    `\`app_environment\`, any clone authorization marker, function/ACL drift, ` +
    `catalogue drift, and protected-JEE fingerprint drift.\n\n` +
    `Production artifact SHA-256: \`${productionSha}\`.\n`,
  "utf8",
);

console.log(`Built ${outputPath}`);
console.log(`Source SHA-256: ${expectedSourceSha}`);
console.log(`Production SHA-256: ${productionSha}`);
console.log("No database connection was made.");
