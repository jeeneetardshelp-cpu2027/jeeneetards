// Build a clone-only, rollback-always rehearsal for the reviewed chapter
// class-scope drafts. This script reads and writes local files only.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(
  root,
  "production/chapter_class_scopes_v13_clone_rehearsal",
);

const sources = [
  {
    path: "src/migrations/chapter_class_scopes_v13_draft.sql",
    sha256: "89e2de12ccfd3916403ca093a6f6af4a248aac1631ad0fef66c25d9becd5b2a9",
  },
  {
    path: "src/migrations/chapter_class_scopes_v13_browse_draft.sql",
    sha256: "c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315",
  },
];

const expected = {
  playlists: 292,
  videos: 3088,
  memberships: 3094,
  chapters: 241,
  subjects: 9,
  classLevels: 4,
  protectedCourses: 83,
  protectedMemberships: 1350,
  protectedFingerprint: "6829fcb6eae22479db7b82b7b3da654d",
  curriculumDefHash: "b71d62cc849eec7a72d1607ce205186e",
  facetsDefHash: "48f982ef788b570def824aa770ae892b",
  curriculumAclHash: "37a7ab878ddb3c8de2877e90e7224b7e",
  facetsAclHash: "37a7ab878ddb3c8de2877e90e7224b7e",
};

const normalize = (value) => value.replace(/\r\n/g, "\n");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function unwrapReviewedDraft(source, label) {
  const normalized = normalize(source);
  if (countMatches(normalized, /^begin;$/gm) !== 1) {
    throw new Error(`REFUSING: ${label} must contain exactly one top-level BEGIN`);
  }
  if (countMatches(normalized, /^commit;$/gm) !== 1) {
    throw new Error(`REFUSING: ${label} must contain exactly one top-level COMMIT`);
  }
  if (countMatches(normalized, /^do \$not_approved\$$/gm) !== 1) {
    throw new Error(`REFUSING: ${label} must contain exactly one review guard`);
  }

  const withoutGuard = normalized.replace(
    /-- Fail closed even if this file is pasted into a SQL editor accidentally\.\n(?:-- [^\n]+\n)*do \$not_approved\$\n[\s\S]*?\n\$not_approved\$;\n/,
    "",
  );
  if (
    withoutGuard === normalized ||
    withoutGuard.includes("$not_approved$") ||
    withoutGuard.includes("Fail closed even if this file")
  ) {
    throw new Error(`REFUSING: could not remove only the review guard from ${label}`);
  }

  return withoutGuard
    .replace(/^begin;\n/m, "")
    .replace(/\ncommit;\s*$/, "\n")
    .trim();
}

const loaded = sources.map((source) => {
  const body = normalize(readFileSync(resolve(root, source.path), "utf8"));
  const actual = sha256(body);
  if (actual !== source.sha256) {
    throw new Error(
      `REFUSING: ${source.path} changed; expected ${source.sha256}, got ${actual}`,
    );
  }
  return { ...source, body: unwrapReviewedDraft(body, source.path) };
});

const curriculumSignature =
  "public.get_browse_curriculum(text,text,text)";
const facetsSignature =
  "public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)";

const protectedStats = `
select
  (select count(*)
     from public.playlists p
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_courses,
  (select count(*)
     from public.playlist_videos pv
     join public.playlists p on p.id = pv.playlist_id
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_memberships,
  md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
       where p.id < 167 and exists (
         select 1
           from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
       )
    ) y), '')
  ) as protected_fingerprint`;

const preflight = `-- ============================================================
-- CHAPTER CLASS SCOPES v13 - READ-ONLY CLONE PREFLIGHT
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- Generated from hash-pinned review artifacts. No write statements.
-- ============================================================

select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as memberships,
  (select count(*) from public.chapters) as chapters,
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.class_levels) as class_levels,
  to_regclass('public.chapter_class_levels') as preexisting_scope_table,
  to_regprocedure('${curriculumSignature}') is not null as has_curriculum_rpc,
  to_regprocedure('${facetsSignature}') is not null as has_facet_rpc;

${protectedStats};
`;

const rehearsal = `-- ============================================================
-- CHAPTER CLASS SCOPES v13 - ROLLBACK-ONLY CLONE REHEARSAL
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- THIS FILE HAS NO COMMIT AND ENDS THE CHANGE TRANSACTION WITH ROLLBACK.
-- ============================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $baseline_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is not null then
    raise exception 'REFUSING: chapter_class_levels already exists';
  end if;
  if to_regprocedure('${curriculumSignature}') is null
     or to_regprocedure('${facetsSignature}') is null then
    raise exception 'REFUSING: expected browse functions are missing';
  end if;
  if (select count(*) from public.playlists) <> ${expected.playlists}
     or (select count(*) from public.videos) <> ${expected.videos}
     or (select count(*) from public.playlist_videos) <> ${expected.memberships}
     or (select count(*) from public.chapters) <> ${expected.chapters}
     or (select count(*) from public.subjects) <> ${expected.subjects}
     or (select count(*) from public.class_levels) <> ${expected.classLevels} then
    raise exception 'REFUSING: clone catalogue differs from the reviewed snapshot';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_courses <> ${expected.protectedCourses}
     or v_protected.protected_memberships <> ${expected.protectedMemberships}
     or v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'REFUSING: protected original-83 JEE baseline differs';
  end if;
end
$baseline_guard$;

-- SOURCE 1: ${sources[0].path}
-- SHA-256: ${sources[0].sha256}
${loaded[0].body}

-- SOURCE 2: ${sources[1].path}
-- SHA-256: ${sources[1].sha256}
${loaded[1].body}

do $post_apply_guard$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> ${expected.playlists}
     or (select count(*) from public.videos) <> ${expected.videos}
     or (select count(*) from public.playlist_videos) <> ${expected.memberships}
     or (select count(*) from public.chapters) <> ${expected.chapters} then
    raise exception 'POST-APPLY: catalogue count drift';
  end if;
  if (select count(*) from public.chapter_class_levels) <> 5 then
    raise exception 'POST-APPLY: expected exactly five canonical scope rows';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'POST-APPLY: protected original-83 JEE fingerprint drift';
  end if;
end
$post_apply_guard$;

select ch.name as chapter, cl.name as canonical_class, ccl.source_url
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  join public.class_levels cl on cl.id = ccl.class_level_id
 order by ch.name;

rollback;

do $rollback_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is not null then
    raise exception 'ROLLBACK FAILED: chapter_class_levels still exists';
  end if;
  if (select count(*) from public.playlists) <> ${expected.playlists}
     or (select count(*) from public.videos) <> ${expected.videos}
     or (select count(*) from public.playlist_videos) <> ${expected.memberships}
     or (select count(*) from public.chapters) <> ${expected.chapters} then
    raise exception 'ROLLBACK FAILED: catalogue count drift';
  end if;
  if md5(pg_get_functiondef(to_regprocedure('${curriculumSignature}')::oid)) <>
       '${expected.curriculumDefHash}'
     or md5(pg_get_functiondef(to_regprocedure('${facetsSignature}')::oid)) <>
       '${expected.facetsDefHash}' then
    raise exception 'ROLLBACK FAILED: browse function definition drift';
  end if;
  if (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('${curriculumSignature}')) <>
       '${expected.curriculumAclHash}'
     or (select md5(coalesce(p.proacl::text, '')) from pg_proc p
       where p.oid = to_regprocedure('${facetsSignature}')) <>
       '${expected.facetsAclHash}' then
    raise exception 'ROLLBACK FAILED: browse function grant drift';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'ROLLBACK FAILED: protected original-83 JEE fingerprint drift';
  end if;
end
$rollback_guard$;

select 'rollback verified; no persistent database change' as result;
`;

const readme = `# Chapter class scopes v13 - clone rehearsal package

Run this package only on an isolated restore clone of the reviewed production
snapshot. Never run either SQL file on production. The pinned function and ACL
hashes are specific to this reviewed snapshot.

1. Run \`read_only_preflight.sql\` and require exactly
   \`${expected.playlists} / ${expected.videos} / ${expected.memberships} / ${expected.chapters} / ${expected.subjects} / ${expected.classLevels}\`,
   protected \`${expected.protectedCourses} / ${expected.protectedMemberships}\`, fingerprint
   \`${expected.protectedFingerprint}\`, both RPCs present, and no scope table.
2. In the same verified clone, run \`rollback_rehearsal.sql\` as a whole.
3. Require the final result: \`rollback verified; no persistent database change\`.
4. If the SQL client stops after an error, issue \`rollback;\` or close the
   connection. The generated file contains no \`commit\`.

The rehearsal temporarily creates the table/rows and replaces the two browse
functions inside one transaction, checks counts and the protected fingerprint,
then rolls everything back. Source definitions and grants are verified after
rollback. It is not a production migration package.

Because the changes never become visible outside the transaction, browser QA
cannot be evidence from this rollback-only gate. A persistent clone-only gate
must be approved separately before browser/runtime verification.
`;

mkdirSync(outputDir, { recursive: true });
const outputs = new Map([
  ["read_only_preflight.sql", preflight],
  ["rollback_rehearsal.sql", rehearsal],
  ["README.md", readme],
]);

for (const [name, content] of outputs) {
  writeFileSync(resolve(outputDir, name), normalize(content), "utf8");
}

const hashManifest = [...outputs]
  .map(([name, content]) => `${sha256(normalize(content))}  ${name}`)
  .join("\n");
writeFileSync(
  resolve(outputDir, "chapter_class_scope_rehearsal.sha256.txt"),
  `${hashManifest}\n`,
  "utf8",
);

console.log(`Built ${outputDir}`);
for (const line of hashManifest.split("\n")) console.log(`  ${line}`);
console.log("No database connection was made; target remains isolated clone only.");
