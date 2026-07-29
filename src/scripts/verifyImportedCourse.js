// verifyImportedCourse.js — independent post-import verification.
//
// Read-only. Checks an imported course against the invariants every import in
// this catalogue must hold, so verification is one command instead of an
// ad-hoc query each time:
//
//   node src/scripts/verifyImportedCourse.js --course 166
//   node src/scripts/verifyImportedCourse.js --course 166 --expect-chapter "Life Processes"
//   node src/scripts/verifyImportedCourse.js --course 164 --goal school --board cbse --class 10th
//
// Exits non-zero if any check fails, so it can gate a release step.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", reset: "\x1b[0m" };

// The protected JEE catalogue size. Any import that moves this has touched data
// it must not have. (The full JEE fingerprint is checked by the import tooling;
// this is the cheap independent guard.)
const JEE_COURSES = 83;

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* rely on process.env */ }
  return env;
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--course") a.course = argv[++i];
    else if (k === "--expect-chapter") a.expectChapter = argv[++i];
    else if (k === "--goal") a.goal = argv[++i];
    else if (k === "--board") a.board = argv[++i];
    else if (k === "--class") a.klass = argv[++i];
    else if (k === "--min-avg-minutes") a.minAvg = Number(argv[++i]);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.course) {
    console.error("usage: --course <id> [--expect-chapter <name>] [--goal <slug>] [--board <slug>] [--class <label>] [--min-avg-minutes <n>]");
    process.exit(1);
  }
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing"); process.exit(1); }

  const q = async (path) => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
  };

  const results = [];
  const check = (ok, label, detail = "") => {
    results.push(ok);
    const mark = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${mark} ${label}${detail ? ` ${C.dim}${detail}${C.reset}` : ""}`);
  };

  const course = (await q(
    `playlists?select=id,title,subject_id,subjects(name),playlist_learning_goals(learning_goals(slug))` +
    `,playlist_boards(boards(slug)),class_levels&id=eq.${args.course}`))[0];
  if (!course) { console.error(`course ${args.course} not found`); process.exit(1); }

  const goals = (course.playlist_learning_goals ?? []).map((g) => g.learning_goals?.slug).filter(Boolean);
  const boards = (course.playlist_boards ?? []).map((b) => b.boards?.slug).filter(Boolean);

  console.log(`\n#${course.id} ${course.title}`);
  console.log(`${C.dim}  subject=${course.subjects?.name} goals=[${goals}] boards=[${boards}] class=${JSON.stringify(course.class_levels)}${C.reset}\n`);

  const rows = await q(
    `playlist_videos?select=position,videos(title,subject_id,chapter_id,chapters(name,subject_id),embedding_status,duration_seconds)` +
    `&playlist_id=eq.${args.course}&order=position`);
  const vids = rows.map((r) => r.videos).filter(Boolean);

  // --- core invariants -------------------------------------------------
  check(vids.length > 0, "has videos", `${vids.length}`);
  check(vids.every((v) => v.chapter_id != null), "every video mapped to a chapter",
    `${vids.filter((v) => v.chapter_id == null).length} unmapped`);
  check(vids.every((v) => v.subject_id === course.subject_id), "every video matches the course subject");
  check(vids.every((v) => !v.chapters || v.chapters.subject_id === course.subject_id),
    "every chapter belongs to the course subject");
  check(vids.every((v) => v.embedding_status === "embeddable"), "every video is embeddable",
    `${vids.filter((v) => v.embedding_status !== "embeddable").length} blocked`);

  // --- scope isolation -------------------------------------------------
  if (args.goal) check(goals.length === 1 && goals[0] === args.goal, `goal is exactly [${args.goal}]`, `got [${goals}]`);
  check(!(goals.includes("jee") && goals.includes("neet")), "no JEE/NEET goal bleed");
  if (args.board) check(boards.includes(args.board), `board includes ${args.board}`, `got [${boards}]`);
  if (args.klass) check((course.class_levels ?? []).includes(args.klass), `class includes ${args.klass}`,
    `got ${JSON.stringify(course.class_levels)}`);

  // --- chapter distribution -------------------------------------------
  const byChapter = {};
  for (const v of vids) if (v.chapters) byChapter[v.chapters.name] = (byChapter[v.chapters.name] ?? 0) + 1;
  const chapterNames = Object.keys(byChapter);
  console.log(`  ${C.dim}chapters: ${chapterNames.join(" | ")}${C.reset}`);
  if (args.expectChapter) {
    check(chapterNames.length === 1 && chapterNames[0] === args.expectChapter,
      `all videos in single chapter "${args.expectChapter}"`, `got ${JSON.stringify(chapterNames)}`);
  }

  // --- content quality signal (the NEEV lesson: Shorts are not lectures)
  const durs = vids.map((v) => v.duration_seconds).filter(Boolean);
  if (durs.length) {
    const avg = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
    const mins = avg / 60;
    console.log(`  ${C.dim}avg lesson ${Math.floor(avg / 60)}m${avg % 60}s (min ${Math.min(...durs)}s, max ${Math.max(...durs)}s)${C.reset}`);
    if (args.minAvg) check(mins >= args.minAvg, `avg lesson >= ${args.minAvg}m`);
    else if (mins < 2) console.log(`  ${C.yellow}! avg lesson under 2m — Shorts, not lectures. The card will advertise "lectures".${C.reset}`);
  }

  // --- lesson order sanity (L-1, L-2, ... inversions) ------------------
  const lessonNums = rows
    .map((r) => (r.videos?.title ?? "").match(/\bL\s*-?\s*(\d+)\b/i)?.[1])
    .map((n) => (n == null ? null : Number(n)));
  const seen = lessonNums.filter((n) => n != null);
  if (seen.length >= 3) {
    const sorted = [...seen].every((n, i, arr) => i === 0 || arr[i - 1] <= n);
    if (!sorted) console.log(`  ${C.yellow}! lesson numbers out of order: ${seen.join(", ")}${C.reset}`);
  }

  // --- protected JEE catalogue -----------------------------------------
  const jee = await q("playlists?select=id,playlist_learning_goals!inner(learning_goals!inner(slug))" +
    "&playlist_learning_goals.learning_goals.slug=eq.jee&limit=2000");
  check(jee.length === JEE_COURSES, `JEE still ${JEE_COURSES} courses`, `got ${jee.length}`);

  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed ? C.red : C.green}${results.length - failed}/${results.length} checks passed${C.reset}\n`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(`${C.red}✗ ${e.message}${C.reset}`); process.exit(1); });
