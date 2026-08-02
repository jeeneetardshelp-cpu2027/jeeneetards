// Build a clone-only, rollback-always rehearsal for the reviewed v14
// chapter-class mapping draft. This script reads and writes local files only.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(
  root,
  "production/chapter_class_scopes_v14_clone_rehearsal",
);

const source = {
  path: "src/migrations/chapter_class_scopes_v14_draft.sql",
  sha256: "6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459",
};

const expected = {
  playlists: 292,
  videos: 3088,
  memberships: 3094,
  chapters: 241,
  subjects: 9,
  classLevels: 4,
  existingScopeRows: 5,
  rehearsedScopeRows: 90,
  protectedCourses: 83,
  protectedMemberships: 1307,
  protectedFingerprint: "c742fabf93ff8dd33d6ecd5eb4793db0",
};

const normalize = (value) => value.replace(/\r\n/g, "\n");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function unwrapReviewedDraft(value) {
  const normalized = normalize(value);
  if (countMatches(normalized, /^begin;$/gm) !== 1) {
    throw new Error("REFUSING: v14 draft must contain one top-level BEGIN");
  }
  if (countMatches(normalized, /^commit;$/gm) !== 1) {
    throw new Error("REFUSING: v14 draft must contain one top-level COMMIT");
  }
  if (countMatches(normalized, /^do \$not_approved\$$/gm) !== 1) {
    throw new Error("REFUSING: v14 draft must contain one review guard");
  }

  const withoutGuard = normalized.replace(
    /do \$not_approved\$\n[\s\S]*?\n\$not_approved\$;\n/,
    "",
  );
  if (withoutGuard === normalized || withoutGuard.includes("$not_approved$")) {
    throw new Error("REFUSING: could not remove only the v14 review guard");
  }

  return withoutGuard
    .replace(/^begin;\n/m, "")
    .replace(/\ncommit;\s*$/, "\n")
    .trim();
}

const sourceText = normalize(readFileSync(resolve(root, source.path), "utf8"));
const sourceHash = sha256(sourceText);
if (sourceHash !== source.sha256) {
  throw new Error(
    `REFUSING: ${source.path} changed; expected ${source.sha256}, got ${sourceHash}`,
  );
}
const reviewedBody = unwrapReviewedDraft(sourceText);

const curriculumSignature = "public.get_browse_curriculum(text,text,text)";
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

const scopeRows = `
select ch.slug as chapter_slug, cl.slug as class_slug
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  join public.class_levels cl on cl.id = ccl.class_level_id`;

const overlapCount = (goal, subject) => `
select count(*) from (
  select slug from public.get_browse_curriculum('${goal}', 'class-11', '${subject}')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('${goal}', 'class-12', '${subject}')
   where level = 'chapter'
) overlapping_chapters`;

const chapterCount = (goal, classSlug, subject) => `
select count(*) from public.get_browse_curriculum('${goal}', '${classSlug}', '${subject}')
 where level = 'chapter'`;

const baselineGuard = `
do $baseline_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is null then
    raise exception 'REFUSING: v13 chapter_class_levels is missing';
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
     or (select count(*) from public.class_levels) <> ${expected.classLevels}
     or (select count(*) from public.chapter_class_levels) <> ${expected.existingScopeRows} then
    raise exception 'REFUSING: clone differs from the reviewed v13 snapshot';
  end if;
  if (select count(*) from (${scopeRows}) existing
       where (chapter_slug, class_slug) in (
         ('kinematics', 'class-11'),
         ('newtons-laws-of-motion-nlm', 'class-11'),
         ('work-energy-and-power', 'class-11'),
         ('ray-optics-and-optical-instruments', 'class-12'),
         ('modern-physics', 'class-12')
       )) <> ${expected.existingScopeRows} then
    raise exception 'REFUSING: the five v13 canonical rows differ';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_courses <> ${expected.protectedCourses}
     or v_protected.protected_memberships <> ${expected.protectedMemberships}
     or v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'REFUSING: protected original-83 JEE baseline differs';
  end if;
end
$baseline_guard$;`;

const currentBrowseGuard = `
do $current_browse_guard$
begin
  if (${chapterCount("jee", "class-11", "chemistry")}) <> 20
     or (${chapterCount("jee", "class-12", "chemistry")}) <> 31
     or (${overlapCount("jee", "chemistry")}) <> 11
     or (${chapterCount("jee", "class-11", "mathematics")}) <> 20
     or (${chapterCount("jee", "class-12", "mathematics")}) <> 19
     or (${overlapCount("jee", "mathematics")}) <> 8
     or (${chapterCount("neet", "class-11", "physics")}) <> 24
     or (${chapterCount("neet", "class-12", "physics")}) <> 25
     or (${overlapCount("neet", "physics")}) <> 22
     or (${chapterCount("neet", "class-11", "chemistry")}) <> 24
     or (${chapterCount("neet", "class-12", "chemistry")}) <> 25
     or (${overlapCount("neet", "chemistry")}) <> 24
     or (${chapterCount("neet", "class-11", "biology")}) <> 32
     or (${chapterCount("neet", "class-12", "biology")}) <> 32
     or (${overlapCount("neet", "biology")}) <> 32
     or (${chapterCount("school", "class-10", "mathematics")}) <> 14 then
    raise exception 'REFUSING: current browse output differs from reviewed evidence';
  end if;
end
$current_browse_guard$;`;

const preflight = `-- ============================================================
-- CHAPTER CLASS SCOPES v14 - READ-ONLY CLONE PREFLIGHT
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- Generated from one hash-pinned review artifact. No writes.
-- ============================================================

select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as memberships,
  (select count(*) from public.chapters) as chapters,
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.class_levels) as class_levels,
  to_regclass('public.chapter_class_levels') as scope_table,
  (select count(*) from public.chapter_class_levels) as scope_rows,
  to_regprocedure('${curriculumSignature}') is not null as has_curriculum_rpc,
  to_regprocedure('${facetsSignature}') is not null as has_facet_rpc;

${protectedStats};

${scopeRows}
 order by ch.slug, cl.slug;
`;

const postApplyGuard = `
do $post_apply_guard$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> ${expected.playlists}
     or (select count(*) from public.videos) <> ${expected.videos}
     or (select count(*) from public.playlist_videos) <> ${expected.memberships}
     or (select count(*) from public.chapters) <> ${expected.chapters}
     or (select count(*) from public.chapter_class_levels) <> ${expected.rehearsedScopeRows} then
    raise exception 'POST-APPLY: catalogue or canonical-scope count drift';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_courses <> ${expected.protectedCourses}
     or v_protected.protected_memberships <> ${expected.protectedMemberships}
     or v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'POST-APPLY: protected original-83 JEE baseline drift';
  end if;
  if (${overlapCount("jee", "chemistry")}) <> 0
     or (${overlapCount("jee", "mathematics")}) <> 1
     or (${overlapCount("neet", "physics")}) <> 0
     or (${overlapCount("neet", "chemistry")}) <> 3
     or (${overlapCount("neet", "biology")}) <> 0 then
    raise exception 'POST-APPLY: projected overlap counts differ';
  end if;
  if (${chapterCount("jee", "class-11", "chemistry")}) <> 19
     or (${chapterCount("jee", "class-12", "chemistry")}) <> 21
     or (${chapterCount("jee", "class-11", "mathematics")}) <> 17
     or (${chapterCount("jee", "class-12", "mathematics")}) <> 15
     or (${chapterCount("neet", "class-11", "physics")}) <> 15
     or (${chapterCount("neet", "class-12", "physics")}) <> 12
     or (${chapterCount("neet", "class-11", "chemistry")}) <> 15
     or (${chapterCount("neet", "class-12", "chemistry")}) <> 13
     or (${chapterCount("neet", "class-11", "biology")}) <> 19
     or (${chapterCount("neet", "class-12", "biology")}) <> 13
     or (${chapterCount("school", "class-10", "mathematics")}) <> 14 then
    raise exception 'POST-APPLY: projected class chapter totals differ';
  end if;
  if not exists (
    select 1 from public.get_browse_curriculum('school', 'class-10', 'mathematics')
     where level = 'chapter' and slug = 'probability'
  ) then
    raise exception 'POST-APPLY: shared School Class 10 Probability disappeared';
  end if;
end
$post_apply_guard$;`;

const rollbackGuard = `
do $rollback_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is null
     or (select count(*) from public.chapter_class_levels) <> ${expected.existingScopeRows} then
    raise exception 'ROLLBACK FAILED: v13 canonical rows were not restored';
  end if;
  if (select count(*) from public.playlists) <> ${expected.playlists}
     or (select count(*) from public.videos) <> ${expected.videos}
     or (select count(*) from public.playlist_videos) <> ${expected.memberships}
     or (select count(*) from public.chapters) <> ${expected.chapters} then
    raise exception 'ROLLBACK FAILED: catalogue count drift';
  end if;
  if to_regprocedure('${curriculumSignature}') is null
     or to_regprocedure('${facetsSignature}') is null then
    raise exception 'ROLLBACK FAILED: browse function missing';
  end if;
  select * into v_protected from (${protectedStats}) protected;
  if v_protected.protected_fingerprint <> '${expected.protectedFingerprint}' then
    raise exception 'ROLLBACK FAILED: protected original-83 JEE fingerprint drift';
  end if;
end
$rollback_guard$;`;

const rehearsal = `-- ============================================================
-- CHAPTER CLASS SCOPES v14 - ROLLBACK-ONLY CLONE REHEARSAL
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- NO COMMIT: THE CHANGE TRANSACTION ENDS WITH ROLLBACK.
-- ============================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

${baselineGuard}

${currentBrowseGuard}

-- REVIEWED SOURCE: ${source.path}
-- SHA-256: ${source.sha256}
${reviewedBody}

${postApplyGuard}

select
  (select count(*) from public.chapter_class_levels) as rehearsed_scope_rows,
  (${overlapCount("jee", "chemistry")}) as jee_chemistry_overlaps,
  (${overlapCount("jee", "mathematics")}) as jee_mathematics_overlaps,
  (${overlapCount("neet", "physics")}) as neet_physics_overlaps,
  (${overlapCount("neet", "chemistry")}) as neet_chemistry_overlaps,
  (${overlapCount("neet", "biology")}) as neet_biology_overlaps;

rollback;

${rollbackGuard}

${currentBrowseGuard.replaceAll("current_browse_guard", "restored_browse_guard")}

select 'v14 rollback verified; no persistent database change' as result;
`;

const readme = `# Chapter class scopes v14 - clone rehearsal package

This package is rollback-only and must run exclusively on a fresh isolated
restore clone of the reviewed production snapshot. **Never run it on production.**
It contains no production authorization and no persistent apply.

Pinned review source:

- \`${source.path}\`
- SHA-256 \`${source.sha256}\`

Required order:

1. Create or select a fresh isolated restore clone of production.
2. Run \`read_only_preflight.sql\`. Require exactly
   \`${expected.playlists} / ${expected.videos} / ${expected.memberships} / ${expected.chapters} / ${expected.subjects} / ${expected.classLevels}\`,
   five existing v13 scope rows, and protected
   \`${expected.protectedCourses} / ${expected.protectedMemberships} / ${expected.protectedFingerprint}\`.
3. Run \`rollback_rehearsal.sql\` as one complete script.
4. Require final result
   \`v14 rollback verified; no persistent database change\`.
5. If the client stops on any error, issue \`rollback;\` or close that SQL
   connection. Do not continue or fix forward.

Inside one transaction the rehearsal removes only the source review guard,
inserts the 85 reviewed rows, verifies 90 total canonical rows, validates the
projected JEE/NEET/School browse outputs and protected original-83 fingerprint,
then rolls back. Post-rollback checks require the five-row v13 state and the
original browse outputs.

The four deferred chapters remain absent: \`probability\`, \`p-block-elements\`,
\`surface-chemistry\`, and \`qualitative-analysis\`.

Successful rollback evidence is not approval for a persistent clone apply or
production. Those are later, separately authorized gates.
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

const manifest = [...outputs]
  .map(([name, content]) => `${sha256(normalize(content))}  ${name}`)
  .join("\n");
writeFileSync(
  resolve(outputDir, "chapter_class_scope_v14_rehearsal.sha256.txt"),
  `${manifest}\n`,
  "utf8",
);

console.log(`Built ${outputDir}`);
for (const line of manifest.split("\n")) console.log(`  ${line}`);
console.log("No database connection was made; this package is rollback-only.");
