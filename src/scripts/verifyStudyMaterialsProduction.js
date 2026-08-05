// Anonymous, read-only production postflight for the reviewed NCERT Physics,
// Chemistry, Biology and Class 10 Science collections. It verifies exact
// sources, curriculum scopes, directory filters and chapter-context reads
// without an admin credential.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(file = ".env") {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const at = line.indexOf("=");
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

const env = fs.existsSync(".env") ? { ...process.env, ...readEnv() } : process.env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
  process.exit(2);
}

const CLASS_11_PHYSICS_PAGES = new Map([
  ["keph101", 12], ["keph102", 14], ["keph103", 22], ["keph104", 22],
  ["keph105", 21], ["keph106", 35], ["keph107", 17], ["keph201", 13],
  ["keph202", 22], ["keph203", 24], ["keph204", 18], ["keph205", 15],
  ["keph206", 19], ["keph207", 22],
]);
const CLASS_12_PHYSICS_PAGES = new Map([
  ["leph101", 44], ["leph102", 36], ["leph103", 26], ["leph104", 29],
  ["leph105", 18], ["leph106", 23], ["leph107", 24], ["leph108", 14],
  ["leph201", 34], ["leph202", 19], ["leph203", 16], ["leph204", 16],
  ["leph205", 17], ["leph206", 21],
]);
const CLASS_11_CHEMISTRY_PAGES = new Map([
  ["kech101", 28], ["kech102", 45], ["kech103", 26],
  ["kech104", 36], ["kech105", 32], ["kech106", 53],
  ["kech201", 21], ["kech202", 39], ["kech203", 33],
]);
const CLASS_12_CHEMISTRY_PAGES = new Map([
  ["lech101", 30], ["lech102", 30], ["lech103", 28],
  ["lech104", 29], ["lech105", 23], ["lech201", 34],
  ["lech202", 34], ["lech203", 32], ["lech204", 22],
  ["lech205", 22],
]);
const CLASS_11_BIOLOGY_PAGES = new Map([
  ["kebo101", 9], ["kebo102", 13], ["kebo103", 14],
  ["kebo104", 18], ["kebo105", 16], ["kebo106", 8],
  ["kebo107", 6], ["kebo108", 19], ["kebo109", 16],
  ["kebo110", 11], ["kebo111", 22], ["kebo112", 13],
  ["kebo113", 15], ["kebo114", 12], ["kebo115", 12],
  ["kebo116", 12], ["kebo117", 13], ["kebo118", 9],
  ["kebo119", 14],
]);
const CLASS_12_BIOLOGY_PAGES = new Map([
  ["lebo101", 25], ["lebo102", 15], ["lebo103", 10],
  ["lebo104", 28], ["lebo105", 31], ["lebo106", 17],
  ["lebo107", 22], ["lebo108", 12], ["lebo109", 16],
  ["lebo110", 11], ["lebo111", 17], ["lebo112", 11],
  ["lebo113", 13],
]);
const CLASS_10_SCIENCE_PAGES = new Map([
  ["jesc101", 16], ["jesc102", 20], ["jesc103", 21],
  ["jesc104", 21], ["jesc105", 21], ["jesc106", 13],
  ["jesc107", 15], ["jesc108", 6], ["jesc109", 27],
  ["jesc110", 10], ["jesc111", 24], ["jesc112", 13],
  ["jesc113", 10],
]);
const EXPECTED_PAGES = new Map([
  ...CLASS_11_PHYSICS_PAGES,
  ...CLASS_12_PHYSICS_PAGES,
  ...CLASS_11_CHEMISTRY_PAGES,
  ...CLASS_12_CHEMISTRY_PAGES,
  ...CLASS_11_BIOLOGY_PAGES,
  ...CLASS_12_BIOLOGY_PAGES,
  ...CLASS_10_SCIENCE_PAGES,
]);
const EXPECTED_URLS = [...EXPECTED_PAGES.keys()].map(
  (code) => `https://ncert.nic.in/textbook/pdf/${code}.pdf`,
);

const db = createClient(url, key, { auth: { persistSession: false } });
const checks = [];
let failed = 0;

function record(label, pass, detail) {
  checks.push({ label, pass, detail });
  if (!pass) failed += 1;
}

async function materials(filters) {
  const { data, error } = await db.rpc("get_study_materials", {
    p_goal_slug: filters.goal ?? null,
    p_board_slug: filters.board ?? null,
    p_class_slug: filters.stage ?? null,
    p_subject_slug: filters.subject ?? null,
    p_chapter_slug: filters.chapter ?? null,
    p_chapter_id: filters.chapterId ?? null,
    p_video_id: null,
    p_material_type: filters.type ?? null,
    p_limit: 60,
    p_offset: 0,
  });
  if (error) throw error;
  return data ?? [];
}

const { data: batch, error: materialError } = await db
  .from("study_materials")
  .select("id, title, source_name, source_url, material_type, page_count, rights_status, review_status")
  .in("source_url", EXPECTED_URLS)
  .order("source_url");
if (materialError) throw materialError;
record("ninety-two approved NCERT chapters", batch?.length === 92, `rows=${batch?.length ?? 0}`);

const badMetadata = (batch ?? []).filter((row) => {
  const code = row.source_url.match(/\/((?:keph|leph|kech|lech|kebo|lebo|jesc)\d{3})[.]pdf$/)?.[1];
  return row.source_name !== "NCERT"
    || row.material_type !== "full_notes"
    || row.rights_status !== "official_source"
    || row.review_status !== "approved"
    || EXPECTED_PAGES.get(code) !== Number(row.page_count);
});
record("every source and page count is exact", badMetadata.length === 0, `invalid=${badMetadata.length}`);

const materialIds = (batch ?? []).map((row) => row.id);
const { data: scopes, error: scopeError } = await db
  .from("study_material_scopes")
  .select("id, material_id")
  .in("material_id", materialIds);
if (scopeError) throw scopeError;
record("two hundred sixty-six public curriculum scopes", scopes?.length === 266, `rows=${scopes?.length ?? 0}`);

const physics11 = { stage: "class-11", subject: "physics" };
const physics12 = { stage: "class-12", subject: "physics" };
const chemistry11 = { stage: "class-11", subject: "chemistry" };
const chemistry12 = { stage: "class-12", subject: "chemistry" };
const biology11 = { stage: "class-11", subject: "biology" };
const biology12 = { stage: "class-12", subject: "biology" };
const chemistry10 = { stage: "class-10", subject: "chemistry" };
const biology10 = { stage: "class-10", subject: "biology" };
const physics10 = { stage: "class-10", subject: "physics" };
for (const [label, filters, expected] of [
  ["JEE Class 11 Physics directory", { ...physics11, goal: "jee" }, 14],
  ["NEET Class 11 Physics directory", { ...physics11, goal: "neet" }, 14],
  ["CBSE Class 11 Physics directory", { ...physics11, goal: "school", board: "cbse" }, 14],
  ["JEE Class 12 Physics directory", { ...physics12, goal: "jee" }, 14],
  ["NEET Class 12 Physics directory", { ...physics12, goal: "neet" }, 14],
  ["CBSE Class 12 Physics directory", { ...physics12, goal: "school", board: "cbse" }, 14],
  ["JEE Class 11 Chemistry directory", { ...chemistry11, goal: "jee" }, 9],
  ["NEET Class 11 Chemistry directory", { ...chemistry11, goal: "neet" }, 9],
  ["CBSE Class 11 Chemistry directory", { ...chemistry11, goal: "school", board: "cbse" }, 9],
  ["JEE Class 12 Chemistry directory", { ...chemistry12, goal: "jee" }, 10],
  ["NEET Class 12 Chemistry directory", { ...chemistry12, goal: "neet" }, 10],
  ["CBSE Class 12 Chemistry directory", { ...chemistry12, goal: "school", board: "cbse" }, 10],
  ["NEET Class 11 Biology directory", { ...biology11, goal: "neet" }, 19],
  ["CBSE Class 11 Biology directory", { ...biology11, goal: "school", board: "cbse" }, 19],
  ["NEET Class 12 Biology directory", { ...biology12, goal: "neet" }, 13],
  ["CBSE Class 12 Biology directory", { ...biology12, goal: "school", board: "cbse" }, 13],
  ["CBSE Class 10 Chemistry directory", { ...chemistry10, goal: "school", board: "cbse" }, 4],
  ["CBSE Class 10 Biology directory", { ...biology10, goal: "school", board: "cbse" }, 5],
  ["CBSE Class 10 Physics directory", { ...physics10, goal: "school", board: "cbse" }, 4],
]) {
  const rows = await materials(filters);
  record(label, rows.length === expected && Number(rows[0]?.total_count) === expected, `rows=${rows.length}`);
}

for (const [chapter, expected] of [
  ["kinematics", 2],
  ["laws-of-motion", 1],
  ["newtons-laws-of-motion-nlm", 1],
  ["friction", 1],
  ["system-of-particles-and-centre-of-mass", 1],
  ["rotational-motion", 1],
  ["oscillations-and-waves", 2],
]) {
  const rows = await materials({ ...physics11, goal: "jee", chapter });
  record(`${chapter} chapter mapping`, rows.length === expected, `rows=${rows.length}`);
}

for (const chapter of [
  "the-living-world",
  "biological-classification",
  "plant-kingdom",
  "animal-kingdom",
  "morphology-of-flowering-plants",
  "anatomy-of-flowering-plants",
  "structural-organisation-in-animals",
  "cell-the-unit-of-life",
  "biomolecules",
  "cell-cycle-and-cell-division",
  "photosynthesis-in-higher-plants",
  "respiration-in-plants",
  "plant-growth-and-development",
  "breathing-and-exchange-of-gases",
  "body-fluids-and-circulation",
  "excretory-products-and-their-elimination",
  "locomotion-and-movement",
  "neural-control-and-coordination",
  "chemical-coordination-and-integration",
]) {
  const rows = await materials({ ...biology11, goal: "neet", chapter });
  record(`${chapter} Class 11 Biology mapping`, rows.length === 1, `rows=${rows.length}`);
}

for (const chapter of [
  "sexual-reproduction-in-flowering-plants",
  "human-reproduction",
  "reproductive-health",
  "principles-of-inheritance-and-variation",
  "molecular-basis-of-inheritance",
  "evolution",
  "human-health-and-disease",
  "microbes-in-human-welfare",
  "biotechnology-principles-and-processes",
  "biotechnology-and-its-applications",
  "organisms-and-populations",
  "ecosystem",
  "biodiversity-and-conservation",
]) {
  const rows = await materials({ ...biology12, goal: "neet", chapter });
  record(`${chapter} Class 12 Biology mapping`, rows.length === 1, `rows=${rows.length}`);
}

for (const [subject, chapters10] of [
  ["chemistry", [
    "chemical-reactions-and-equations",
    "acids-bases-and-salts",
    "metals-and-non-metals",
    "carbon-and-its-compounds",
  ]],
  ["biology", [
    "life-processes",
    "control-and-coordination",
    "how-do-organisms-reproduce",
    "heredity",
    "our-environment",
  ]],
  ["physics", [
    "light-reflection-and-refraction",
    "human-eye-and-colourful-world",
    "electricity",
    "magnetic-effects-of-electric-current",
  ]],
]) {
  for (const chapter of chapters10) {
    const rows = await materials({
      goal: "school", board: "cbse", stage: "class-10", subject, chapter,
    });
    record(`${chapter} Class 10 Science mapping`, rows.length === 1, `rows=${rows.length}`);
  }
}

for (const [chapter, expected] of [
  ["electrostatics", 2],
  ["capacitance", 1],
  ["current-electricity", 1],
  ["ray-optics-and-optical-instruments", 1],
  ["dual-nature-of-radiation-and-matter", 1],
  ["atoms", 1],
  ["modern-physics", 4],
  ["semiconductor-electronics", 1],
]) {
  const rows = await materials({ ...physics12, goal: "jee", chapter });
  record(`${chapter} Class 12 mapping`, rows.length === expected, `rows=${rows.length}`);
}

for (const chapter of [
  "introduction-to-chemistry",
  "mole-concept",
  "thermochemistry",
  "chemical-equilibrium",
  "ionic-equilibrium",
  "purification-and-characterisation-of-organic-compounds",
  "structural-isomerism",
  "stereoisomerism",
  "organic-reaction-mechanisms",
  "hydrocarbons",
]) {
  const rows = await materials({ ...chemistry11, goal: "jee", chapter });
  record(`${chapter} Class 11 Chemistry mapping`, rows.length === 1, `rows=${rows.length}`);
}

for (const [chapter, expected] of [
  ["solutions", 1],
  ["electrochemistry", 1],
  ["chemical-kinetics", 1],
  ["the-d-and-f-block-elements", 1],
  ["coordination-compounds", 1],
  ["organic-compounds-containing-halogens", 1],
  ["organic-compounds-containing-oxygen", 2],
  ["carboxylic-acids-and-derivatives", 1],
  ["organic-compounds-containing-nitrogen", 1],
  ["amines", 1],
  ["biomolecules", 1],
]) {
  const rows = await materials({ ...chemistry12, goal: "jee", chapter });
  record(`${chapter} Class 12 Chemistry mapping`, rows.length === expected, `rows=${rows.length}`);
}

const { data: curriculum, error: curriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-11",
    p_subject_slug: "physics",
  },
);
if (curriculumError) throw curriculumError;
const chapters = (curriculum ?? []).filter((row) => row.level === "chapter");
record("material filter exposes fifteen chapter nodes", chapters.length === 15, `rows=${chapters.length}`);

const { data: class12Curriculum, error: class12CurriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-12",
    p_subject_slug: "physics",
  },
);
if (class12CurriculumError) throw class12CurriculumError;
const class12Chapters = (class12Curriculum ?? []).filter((row) => row.level === "chapter");
record("Class 12 material filter exposes fourteen chapter nodes", class12Chapters.length === 14, `rows=${class12Chapters.length}`);

const { data: chemistryCurriculum, error: chemistryCurriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-11",
    p_subject_slug: "chemistry",
  },
);
if (chemistryCurriculumError) throw chemistryCurriculumError;
const chemistryChapters = (chemistryCurriculum ?? []).filter((row) => row.level === "chapter");
record("Class 11 Chemistry material filter exposes sixteen chapter nodes", chemistryChapters.length === 16, `rows=${chemistryChapters.length}`);

const { data: chemistry12Curriculum, error: chemistry12CurriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-12",
    p_subject_slug: "chemistry",
  },
);
if (chemistry12CurriculumError) throw chemistry12CurriculumError;
const chemistry12Chapters = (chemistry12Curriculum ?? []).filter((row) => row.level === "chapter");
record("Class 12 Chemistry material filter exposes eleven chapter nodes", chemistry12Chapters.length === 11, `rows=${chemistry12Chapters.length}`);

const { data: biologyCurriculum, error: biologyCurriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-11",
    p_subject_slug: "biology",
  },
);
if (biologyCurriculumError) throw biologyCurriculumError;
const biologyChapters = (biologyCurriculum ?? []).filter((row) => row.level === "chapter");
record("Class 11 Biology material filter exposes nineteen chapter nodes", biologyChapters.length === 19, `rows=${biologyChapters.length}`);

const { data: biology12Curriculum, error: biology12CurriculumError } = await db.rpc(
  "get_study_material_curriculum",
  {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-12",
    p_subject_slug: "biology",
  },
);
if (biology12CurriculumError) throw biology12CurriculumError;
const biology12Chapters = (biology12Curriculum ?? []).filter((row) => row.level === "chapter");
record("Class 12 Biology material filter exposes thirteen chapter nodes", biology12Chapters.length === 13, `rows=${biology12Chapters.length}`);

for (const [subject, expected] of [
  ["chemistry", 4], ["biology", 5], ["physics", 4],
]) {
  const { data, error } = await db.rpc("get_study_material_curriculum", {
    p_goal_slug: "school",
    p_board_slug: "cbse",
    p_class_slug: "class-10",
    p_subject_slug: subject,
  });
  if (error) throw error;
  const subjectChapters = (data ?? []).filter((row) => row.level === "chapter");
  record(
    `Class 10 ${subject} material filter exposes ${expected} chapter nodes`,
    subjectChapters.length === expected,
    `rows=${subjectChapters.length}`,
  );
}

const inapplicable = await materials({ goal: "jee", stage: "class-11", subject: "biology" });
record("JEE Biology intentionally remains empty", inapplicable.length === 0, `rows=${inapplicable.length}`);

const inapplicable12 = await materials({ goal: "jee", stage: "class-12", subject: "biology" });
record("JEE Class 12 Biology intentionally remains empty", inapplicable12.length === 0, `rows=${inapplicable12.length}`);

const entrance10 = await materials({ goal: "jee", stage: "class-10" });
record("Class 10 NCERT Science remains School-only", entrance10.length === 0, `rows=${entrance10.length}`);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.label} (${check.detail})`);
}
if (failed) {
  console.error(`\n${failed} study-material production check${failed === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log("\nStudy-material production postflight passed (anonymous, read-only).\n");
}
