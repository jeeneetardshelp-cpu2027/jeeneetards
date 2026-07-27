// draftManifest.js — auto-draft a per-video chapter manifest for review.
//
// Fetches a YouTube playlist, pulls the subject's REAL chapter list from the
// database, and proposes a chapter for each video (rules-only, mapChapters.js).
// Writes a draft manifest (import-shaped) plus a review sidecar, and prints a
// table so you can eyeball the flagged rows. It writes NO database rows and
// makes NO import — it only prepares the manifest the existing dry-run + v12
// import already consume.
//
//   node src/scripts/draftManifest.js --playlist <PLAYLIST_ID> --subject "Biology"
//   node src/scripts/draftManifest.js --playlist <ID> --subject Physics --out docs/manifests/draft.json
//
// Then: review the flagged rows, fill any null chapters, and run your normal
// dry-run + v12 import against the finished manifest.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { getPlaylistVideos } from "./youtubeNode.js";
import { draftAssignments } from "./classify/mapChapters.js";

const here = dirname(fileURLToPath(import.meta.url));
const C = { dim: "\x1b[2m", red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", reset: "\x1b[0m" };
const fail = (m) => { console.error(`${C.red}✗ ${m}${C.reset}`); process.exit(1); };

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
    if (argv[i] === "--playlist") a.playlist = argv[++i];
    else if (argv[i] === "--subject") a.subject = argv[++i];
    else if (argv[i] === "--out") a.out = argv[++i];
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.playlist || !args.subject)
    fail('usage: --playlist <PLAYLIST_ID> --subject "<Subject name>" [--out <file>]');

  const env = loadEnv();
  // Server key only — never the public/bundled VITE_YOUTUBE_API_KEY (enforced by
  // scripts.envkeys.test.js), matching refreshVideoStats.js.
  const ytKey = env.YOUTUBE_API_KEY;
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!ytKey) fail("YOUTUBE_API_KEY missing from .env (server key — not VITE_YOUTUBE_API_KEY).");
  if (!url || !key) fail("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Subject -> its chapter list (the only chapters we may propose).
  const { data: subjects, error: subErr } = await db.from("subjects").select("id, name");
  if (subErr) fail(`subjects query failed: ${subErr.message}`);
  const subject = (subjects ?? []).find(
    (s) => s.name.toLowerCase() === args.subject.toLowerCase());
  if (!subject) fail(`subject "${args.subject}" not found. Have: ${subjects.map((s) => s.name).join(", ")}`);

  const { data: chapters, error: chErr } = await db
    .from("chapters").select("name").eq("subject_id", subject.id).order("display_order");
  if (chErr) fail(`chapters query failed: ${chErr.message}`);
  const chapterNames = (chapters ?? []).map((c) => c.name);
  if (!chapterNames.length) fail(`subject "${subject.name}" has no chapters yet — create them first.`);

  console.log(`${C.dim}Fetching playlist ${args.playlist}…${C.reset}`);
  const videos = await getPlaylistVideos(ytKey, args.playlist);
  if (!videos.length) fail("playlist returned no usable videos.");

  // Manifest position convention (see ingestionSafety.validateMappedSourcePositions):
  // 1-indexed = YouTube sourcePosition + 1, preserving gaps left by
  // deleted/private videos. NOT a re-sequenced 1..N.
  const mapped = videos.map((v, i) => ({
    videoId: v.videoId,
    title: v.title,
    position: (Number.isInteger(v.sourcePosition) ? v.sourcePosition : v.position ?? i) + 1,
  }));
  const { rows, summary } = draftAssignments(mapped, chapterNames);

  // --- review table -------------------------------------------------
  console.log(`\n${subject.name} · ${chapterNames.length} chapters · ${videos.length} videos\n`);
  for (const r of rows) {
    const flag = !r.chapter ? `${C.red}UNMATCHED${C.reset}`
      : r.review ? `${C.yellow}review ${r.confidence}${C.reset}`
      : `${C.green}auto ${r.confidence}${C.reset}`;
    const alt = r.review && r.alternatives.length ? `  ${C.dim}alt: ${r.alternatives.join(", ")}${C.reset}` : "";
    console.log(`  #${String(r.position).padStart(2)} [${flag}] ${r.title.slice(0, 60)}`);
    console.log(`        → ${r.chapter ?? "(fill in)"}${alt}`);
  }
  console.log(
    `\n${C.green}${summary.auto} auto${C.reset} · ` +
    `${C.yellow}${summary.review} to review${C.reset} · ` +
    `${C.red}${summary.unmatched} unmatched${C.reset} of ${summary.total}\n`);

  // --- write import-shaped manifest + review sidecar ----------------
  const manifest = {
    version: 1,
    request_id: randomUUID(),
    youtube_playlist_id: args.playlist,
    assignments: rows.map((r) => ({
      position: r.position,
      youtube_video_id: r.youtube_video_id,
      chapter: r.chapter, // null = you must map it before importing
    })),
  };
  const outPath = args.out
    ? resolve(process.cwd(), args.out)
    : resolve(here, `../../docs/manifests/draft-${args.playlist}.json`);
  const reviewPath = outPath.replace(/\.json$/, ".review.json");
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(reviewPath, JSON.stringify({ subject: subject.name, summary, rows }, null, 2) + "\n", "utf8");

  console.log(`Draft manifest → ${outPath}`);
  console.log(`Review detail  → ${reviewPath}`);
  if (summary.review || summary.unmatched) {
    console.log(`\n${C.yellow}Next:${C.reset} fix the flagged/null rows in the manifest, then run your`);
    console.log(`normal dry-run + v12 import. The import fails closed on any unmapped chapter.`);
  } else {
    console.log(`\n${C.green}All rows auto-mapped with confidence — still eyeball them, then dry-run + import.${C.reset}`);
  }
}

main().catch((e) => fail(e.message));
