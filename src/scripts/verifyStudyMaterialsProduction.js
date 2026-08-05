// Read-only postflight for the first study-material production batch.
// It verifies public visibility, exact curriculum scopes and contextual
// chapter retrieval without using an admin or service-role credential.

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

const db = createClient(url, key, { auth: { persistSession: false } });
const checks = [];
let failed = 0;

function record(label, pass, detail) {
  checks.push({ label, pass, detail });
  if (!pass) failed += 1;
}

async function rpc(filters) {
  const { data, error } = await db.rpc("get_study_materials", {
    p_goal_slug: filters.goal ?? null,
    p_board_slug: filters.board ?? null,
    p_class_slug: filters.stage ?? null,
    p_subject_slug: filters.subject ?? null,
    p_chapter_slug: filters.chapter ?? null,
    p_chapter_id: filters.chapterId ?? null,
    p_video_id: null,
    p_material_type: filters.type ?? null,
    p_limit: 10,
    p_offset: 0,
  });
  if (error) throw error;
  return data ?? [];
}

const { data: chapters, error: chapterError } = await db
  .from("chapters")
  .select("id, name, slug, subjects!inner(slug)")
  .eq("slug", "kinematics")
  .eq("subjects.slug", "physics");
if (chapterError) throw chapterError;
const chapterId = chapters?.[0]?.id ?? null;
record("Physics Kinematics chapter exists", Number.isInteger(chapterId), `id=${chapterId ?? "missing"}`);

const { data: materials, error: materialError } = await db
  .from("study_materials")
  .select("id, title, source_name, source_url, material_type, review_status")
  .order("id");
if (materialError) throw materialError;
record("one approved public material", materials?.length === 1 && materials[0].review_status === "approved", `rows=${materials?.length ?? 0}`);
record(
  "official NCERT source is exact",
  materials?.[0]?.source_name === "NCERT"
    && materials?.[0]?.source_url === "https://ncert.nic.in/textbook/pdf/keph102.pdf"
    && materials?.[0]?.material_type === "full_notes",
  materials?.[0]?.title ?? "missing",
);

const { data: scopes, error: scopeError } = await db
  .from("study_material_scopes")
  .select("id, material_id, learning_goal_id, board_id, class_level_id, subject_id, chapter_id")
  .order("id");
if (scopeError) throw scopeError;
record("three public curriculum scopes", scopes?.length === 3, `rows=${scopes?.length ?? 0}`);

const common = { stage: "class-11", subject: "physics", chapter: "kinematics" };
for (const [label, filters] of [
  ["JEE directory", { ...common, goal: "jee" }],
  ["NEET directory", { ...common, goal: "neet" }],
  ["CBSE Class 11 directory", { ...common, goal: "school", board: "cbse" }],
]) {
  const rows = await rpc(filters);
  record(label, rows.length === 1 && rows[0].scopes?.length === 3, `rows=${rows.length}`);
}

const contextual = await rpc({ chapterId });
record("lecture chapter context", contextual.length === 1, `rows=${contextual.length}`);
const unrelated = await rpc({ ...common, goal: "jee", stage: "class-12" });
record("unrelated class remains empty", unrelated.length === 0, `rows=${unrelated.length}`);

for (const check of checks) {
  console.log(`${check.pass ? "✓" : "✗"} ${check.label} (${check.detail})`);
}
if (failed) {
  console.error(`\n${failed} study-material production check${failed === 1 ? "" : "s"} failed.`);
  process.exitCode = 1;
} else {
  console.log("\nStudy-material production postflight passed (anonymous, read-only).");
}
