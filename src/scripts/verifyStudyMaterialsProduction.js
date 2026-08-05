// Anonymous, read-only production postflight for the reviewed NCERT Class 11
// and Class 12 Physics collections. It verifies the exact sources, curriculum
// scope counts, directory filters and chapter-context reads without an admin
// credential.

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

const CLASS_11_PAGES = new Map([
  ["keph101", 12], ["keph102", 14], ["keph103", 22], ["keph104", 22],
  ["keph105", 21], ["keph106", 35], ["keph107", 17], ["keph201", 13],
  ["keph202", 22], ["keph203", 24], ["keph204", 18], ["keph205", 15],
  ["keph206", 19], ["keph207", 22],
]);
const CLASS_12_PAGES = new Map([
  ["leph101", 44], ["leph102", 36], ["leph103", 26], ["leph104", 29],
  ["leph105", 18], ["leph106", 23], ["leph107", 24], ["leph108", 14],
  ["leph201", 34], ["leph202", 19], ["leph203", 16], ["leph204", 16],
  ["leph205", 17], ["leph206", 21],
]);
const EXPECTED_PAGES = new Map([...CLASS_11_PAGES, ...CLASS_12_PAGES]);
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
record("twenty-eight approved NCERT Physics chapters", batch?.length === 28, `rows=${batch?.length ?? 0}`);

const badMetadata = (batch ?? []).filter((row) => {
  const code = row.source_url.match(/\/([kl]eph\d{3})[.]pdf$/)?.[1];
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
record("one hundred five public curriculum scopes", scopes?.length === 105, `rows=${scopes?.length ?? 0}`);

const class11 = { stage: "class-11", subject: "physics" };
const class12 = { stage: "class-12", subject: "physics" };
for (const [label, filters] of [
  ["JEE Class 11 Physics directory", { ...class11, goal: "jee" }],
  ["NEET Class 11 Physics directory", { ...class11, goal: "neet" }],
  ["CBSE Class 11 Physics directory", { ...class11, goal: "school", board: "cbse" }],
  ["JEE Class 12 Physics directory", { ...class12, goal: "jee" }],
  ["NEET Class 12 Physics directory", { ...class12, goal: "neet" }],
  ["CBSE Class 12 Physics directory", { ...class12, goal: "school", board: "cbse" }],
]) {
  const rows = await materials(filters);
  record(label, rows.length === 14 && Number(rows[0]?.total_count) === 14, `rows=${rows.length}`);
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
  const rows = await materials({ ...class11, goal: "jee", chapter });
  record(`${chapter} chapter mapping`, rows.length === expected, `rows=${rows.length}`);
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
  const rows = await materials({ ...class12, goal: "jee", chapter });
  record(`${chapter} Class 12 mapping`, rows.length === expected, `rows=${rows.length}`);
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

const unrelated = await materials({ goal: "jee", stage: "class-12", subject: "chemistry" });
record("unrelated subject remains empty", unrelated.length === 0, `rows=${unrelated.length}`);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.label} (${check.detail})`);
}
if (failed) {
  console.error(`\n${failed} study-material production check${failed === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log("\nStudy-material production postflight passed (anonymous, read-only).\n");
}
