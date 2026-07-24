// driftReport.js — DRY RUN. Reports array/junction disagreement in
// playlists.class_levels. Read-only: it issues SELECTs and nothing else.
// No DDL, no INSERT/UPDATE/DELETE, no RPC. Safe to run before any migration.
//
// It answers the question v4_class_levels_migration.sql will ask, so you can
// see what that migration would do BEFORE it does it — in particular how many
// playlists are classified ONLY in the array and would have been wiped by the
// v3 one-line "repair".
//
//   node src/scripts/driftReport.js                 # staging (.env.staging)
//   DRIFT_TARGET=production DRIFT_ALLOW_PROD=1 node src/scripts/driftReport.js
//
// Output: human table + drift-report.json
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readEnv = (p) => {
  const out = {};
  try {
    for (const l of readFileSync(resolve(root, p), "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* optional */ }
  return out;
};
const die = (m) => { console.error(`\x1b[31m${m}\x1b[0m`); process.exit(2); };

const target = process.env.DRIFT_TARGET ?? "staging";
let URL, KEY;
if (target === "production") {
  // Read-only or not, production is opt-in and never the default.
  if (process.env.DRIFT_ALLOW_PROD !== "1")
    die("Refusing to read production without DRIFT_ALLOW_PROD=1.");
  const e = readEnv(".env");
  URL = e.VITE_SUPABASE_URL; KEY = e.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) die("SUPABASE_SERVICE_ROLE_KEY missing from .env");
} else {
  const e = readEnv(".env.staging");
  URL = process.env.TEST_SUPABASE_URL ?? e.TEST_SUPABASE_URL;
  KEY = process.env.TEST_SERVICE_KEY ?? e.TEST_SERVICE_KEY;
  if (!URL || !KEY) die("Set TEST_SUPABASE_URL / TEST_SERVICE_KEY in .env.staging");
}

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (res, what) => { if (res.error) die(`[${what}] ${res.error.message}`); return res.data; };

const SLUG_TO_LABEL = { "class-10": "10th", "class-11": "11th", "class-12": "12th", dropper: "Dropper" };
const KNOWN = new Set(Object.values(SLUG_TO_LABEL));
const sortUniq = (a) => [...new Set(a ?? [])].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  console.log(`\x1b[36m• DRY RUN (read-only) against: ${URL}\x1b[0m\n`);

  const playlists = must(await db.from("playlists").select("id, title, class_levels").order("id"), "playlists");
  const junction = must(await db.from("playlist_class_levels").select("playlist_id, class_levels(slug)"), "junction");

  const byPlaylist = new Map();
  for (const row of junction) {
    const label = SLUG_TO_LABEL[row.class_levels?.slug] ?? row.class_levels?.slug;
    if (!byPlaylist.has(row.playlist_id)) byPlaylist.set(row.playlist_id, []);
    byPlaylist.get(row.playlist_id).push(label);
  }

  const rows = playlists.map((p) => {
    const arr = sortUniq(p.class_levels);
    const jun = sortUniq(byPlaylist.get(p.id));
    const unknown = arr.filter((l) => !KNOWN.has(l));
    let verdict;
    if (unknown.length) verdict = "unknown-label";
    else if (!arr.length && !jun.length) verdict = "both-empty";
    else if (same(arr, jun)) verdict = "agree";
    else if (!jun.length) verdict = "array-only";
    else if (!arr.length) verdict = "junction-only";
    else verdict = "conflict";
    return { id: p.id, title: p.title, array: arr, junction: jun, unknown, verdict };
  });

  const counts = {};
  for (const r of rows) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;

  const order = ["agree", "both-empty", "array-only", "junction-only", "unknown-label", "conflict"];
  console.log("VERDICT SUMMARY");
  for (const k of order) if (counts[k]) console.log(`  ${k.padEnd(15)} ${counts[k]}`);
  console.log(`  ${"TOTAL".padEnd(15)} ${rows.length}\n`);

  const show = (v, note) => {
    const list = rows.filter((r) => r.verdict === v);
    if (!list.length) return;
    console.log(`${v.toUpperCase()} — ${note}`);
    for (const r of list.slice(0, 50))
      console.log(`  #${r.id} ${String(r.title).slice(0, 46).padEnd(46)} array=[${r.array}] junction=[${r.junction}]`);
    if (list.length > 50) console.log(`  … and ${list.length - 50} more`);
    console.log("");
  };
  show("array-only", "classified ONLY in the array. The v3 repair would have DELETED these. v4 backfills them into the junction.");
  show("conflict", "array and junction both non-empty and disagree. THE MIGRATION WILL ABORT until a human resolves each.");
  show("unknown-label", "label not in 10th/11th/12th/Dropper. THE MIGRATION WILL ABORT.");
  show("junction-only", "array empty, junction authoritative. Safe: the array gets filled.");

  const blocking = (counts["conflict"] ?? 0) + (counts["unknown-label"] ?? 0);
  const report = {
    target: URL, when: new Date().toISOString(), dry_run: true, wrote_nothing: true,
    total_playlists: rows.length, counts,
    would_backfill: counts["array-only"] ?? 0,
    would_abort: blocking > 0,
    blocking_rows: rows.filter((r) => r.verdict === "conflict" || r.verdict === "unknown-label"),
    rows,
  };
  writeFileSync(resolve(root, "drift-report.json"), JSON.stringify(report, null, 2));

  if (blocking > 0) {
    console.log(`\x1b[31mMIGRATION WOULD ABORT: ${blocking} row(s) need a human decision.\x1b[0m`);
  } else {
    console.log(`\x1b[32mMigration would proceed: backfill ${report.would_backfill}, abort 0.\x1b[0m`);
  }
  console.log("report -> drift-report.json");
}

main().catch((e) => die(e.message ?? String(e)));
