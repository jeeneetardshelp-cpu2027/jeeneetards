// Build the owner-approved v14 production wrapper from the exact rollback-only
// rehearsal artifact. This script reads and writes local files only.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const sourcePath = resolve(
  root,
  "production/chapter_class_scopes_v14_clone_rehearsal/rollback_rehearsal.sql",
);
const outputDir = resolve(root, "production/chapter_class_scopes_v14_production");
const outputPath = resolve(outputDir, "production_apply.sql");
const postflightPath = resolve(outputDir, "read_only_postflight.sql");
const expectedSourceSha =
  "dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0";
const reviewedSourceSha =
  "6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459";
const productionRef = "kezelafqhgqrprpadmlf";
const pitrRestorePoint = "02 Aug 2026, 13:31:42 UTC+05:30";

const normalize = (value) => value.replace(/\r\n/g, "\n");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const source = normalize(readFileSync(sourcePath, "utf8"));
if (sha256(source) !== expectedSourceSha) {
  throw new Error("REFUSING: v14 rollback rehearsal hash drift");
}
if (!source.includes(`-- SHA-256: ${reviewedSourceSha}`)) {
  throw new Error("REFUSING: reviewed v14 source hash is absent");
}

const rehearsalHeader = `-- ============================================================
-- CHAPTER CLASS SCOPES v14 - ROLLBACK-ONLY CLONE REHEARSAL
-- ISOLATED RESTORE CLONE ONLY. NEVER RUN ON PRODUCTION.
-- NO COMMIT: THE CHANGE TRANSACTION ENDS WITH ROLLBACK.
-- ============================================================`;

const productionHeader = `-- ============================================================
-- CHAPTER CLASS SCOPES v14 - PRODUCTION APPLY
-- PRODUCTION PROJECT ${productionRef} ONLY.
-- OWNER-APPROVED SOURCE SHA-256 ${reviewedSourceSha}.
-- PITR RESTORE POINT ${pitrRestorePoint}.
-- DERIVED FROM ROLLBACK REHEARSAL SHA-256 ${expectedSourceSha}.
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
end
$target_guard$;`;

const rollbackMarker = "\nrollback;\n\n\ndo $rollback_guard$";
const rollbackIndex = source.indexOf(rollbackMarker);
if (!source.startsWith(rehearsalHeader)) {
  throw new Error("REFUSING: v14 rehearsal header drift");
}
if (rollbackIndex === -1) {
  throw new Error("REFUSING: v14 rollback tail structure drift");
}
if (!source.endsWith("select 'v14 rollback verified; no persistent database change' as result;\n")) {
  throw new Error("REFUSING: v14 rollback result structure drift");
}

const transactionBody = source
  .slice(0, rollbackIndex)
  .replace(rehearsalHeader, productionHeader);
const production = `${transactionBody}\ncommit;\n\nselect 'v14 persistent production apply verified' as result;\n`;

const overlapCount = (goal, subject) => `(
  select count(*) from (
    select slug from public.get_browse_curriculum('${goal}', 'class-11', '${subject}')
     where level = 'chapter'
    intersect
    select slug from public.get_browse_curriculum('${goal}', 'class-12', '${subject}')
     where level = 'chapter'
  ) overlap_rows
)`;

const chapterCount = (goal, classSlug, subject) => `(
  select count(*) from public.get_browse_curriculum('${goal}', '${classSlug}', '${subject}')
   where level = 'chapter'
)`;

const readOnlyPostflight = `-- CHAPTER CLASS SCOPES v14 - READ-ONLY PRODUCTION POSTFLIGHT
-- Target ${productionRef}; no data or schema mutation.

with protected as (
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
    ) as protected_fingerprint
)
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as memberships,
  (select count(*) from public.chapters) as chapters,
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.class_levels) as class_levels,
  (select count(*) from public.chapter_class_levels) as scope_rows,
  (select count(*) from public.chapter_class_levels where reviewed_on = date '2026-08-02') as v14_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'class-11') as class_11_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'class-12') as class_12_scope_rows,
  (select count(*) from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
   where cl.slug = 'dropper') as dropper_scope_rows,
  protected.protected_courses,
  protected.protected_memberships,
  protected.protected_fingerprint,
  ${chapterCount("jee", "class-11", "chemistry")} as jee_chemistry_11,
  ${chapterCount("jee", "class-12", "chemistry")} as jee_chemistry_12,
  ${overlapCount("jee", "chemistry")} as jee_chemistry_overlap,
  ${chapterCount("jee", "class-11", "mathematics")} as jee_mathematics_11,
  ${chapterCount("jee", "class-12", "mathematics")} as jee_mathematics_12,
  ${overlapCount("jee", "mathematics")} as jee_mathematics_overlap,
  ${chapterCount("neet", "class-11", "physics")} as neet_physics_11,
  ${chapterCount("neet", "class-12", "physics")} as neet_physics_12,
  ${overlapCount("neet", "physics")} as neet_physics_overlap,
  ${chapterCount("neet", "class-11", "chemistry")} as neet_chemistry_11,
  ${chapterCount("neet", "class-12", "chemistry")} as neet_chemistry_12,
  ${overlapCount("neet", "chemistry")} as neet_chemistry_overlap,
  ${chapterCount("neet", "class-11", "biology")} as neet_biology_11,
  ${chapterCount("neet", "class-12", "biology")} as neet_biology_12,
  ${overlapCount("neet", "biology")} as neet_biology_overlap,
  ${chapterCount("school", "class-10", "mathematics")} as school_mathematics_10,
  exists (
    select 1 from public.get_browse_curriculum('school', 'class-10', 'mathematics')
     where level = 'chapter' and slug = 'probability'
  ) as school_probability_visible,
  has_table_privilege('anon', 'public.chapter_class_levels', 'select') as anon_scope_select,
  has_table_privilege('authenticated', 'public.chapter_class_levels', 'select') as authenticated_scope_select,
  has_function_privilege('anon', 'public.get_browse_curriculum(text,text,text)', 'execute') as anon_curriculum_execute,
  has_function_privilege('authenticated', 'public.get_browse_curriculum(text,text,text)', 'execute') as authenticated_curriculum_execute,
  has_function_privilege('anon', 'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)', 'execute') as anon_facets_execute,
  has_function_privilege('authenticated', 'public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)', 'execute') as authenticated_facets_execute
from protected;
`;

if ((production.match(/^begin;$/gm) ?? []).length !== 1) {
  throw new Error("REFUSING: production wrapper must contain one transaction");
}
if ((production.match(/^commit;$/gm) ?? []).length !== 1) {
  throw new Error("REFUSING: production wrapper must contain one commit");
}
if (/^rollback;$/m.test(production)) {
  throw new Error("REFUSING: production wrapper still contains rollback");
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, production, "utf8");
writeFileSync(postflightPath, readOnlyPostflight, "utf8");
const productionSha = sha256(production);
const postflightSha = sha256(readOnlyPostflight);
writeFileSync(
  resolve(outputDir, "production_apply.sha256.txt"),
  `${productionSha}  production_apply.sql\n`,
  "utf8",
);
writeFileSync(
  resolve(outputDir, "read_only_postflight.sha256.txt"),
  `${postflightSha}  read_only_postflight.sql\n`,
  "utf8",
);
writeFileSync(
  resolve(outputDir, "README.md"),
  `# Chapter class scopes v14 - production apply\n\n` +
    `Target: \`${productionRef}\` only.\n\n` +
    `PITR restore point: \`${pitrRestorePoint}\`.\n\n` +
    `Owner-approved review source SHA-256: \`${reviewedSourceSha}\`.\n\n` +
    `Rollback rehearsal SHA-256: \`${expectedSourceSha}\`.\n\n` +
    `The wrapper refuses a non-production environment, clone markers, ` +
    `catalogue drift, v13 scope drift, protected-JEE drift, and current browse ` +
    `drift before its additive insert. Its postflight runs before the single ` +
    `commit.\n\n` +
    `Production artifact SHA-256: \`${productionSha}\`.\n`,
  "utf8",
);

console.log(`Built ${outputPath}`);
console.log(`Reviewed source SHA-256: ${reviewedSourceSha}`);
console.log(`Rollback rehearsal SHA-256: ${expectedSourceSha}`);
console.log(`Production SHA-256: ${productionSha}`);
console.log(`Read-only postflight SHA-256: ${postflightSha}`);
console.log("No database connection was made.");
