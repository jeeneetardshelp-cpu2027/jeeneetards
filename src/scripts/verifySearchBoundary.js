// verifySearchBoundary.js — READ-ONLY boundary evidence for universal search.
//
// Runs as a logged-out student (anon key) and as a signed-out-but-not-admin
// caller, and records what each is actually allowed to do. No writes, no DDL.
//
//   npm run verify:search            -> against VITE_SUPABASE_URL (.env)
//   npm run verify:search -- staging -> against TEST_SUPABASE_URL (.env.staging)
//
// The point is that a GRANT is a claim and this is the check. Supabase grants
// EXECUTE on every new public function to anon/authenticated/service_role by
// default, so "I revoked it from public" has been wrong here before.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const readEnv = (f) => {
  try {
    return Object.fromEntries(
      readFileSync(f, "utf8").split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
  } catch { return {}; }
};

const prod = readEnv(".env");
const stg = readEnv(".env.staging");
const useStaging = process.argv.includes("staging");

const URL = useStaging ? stg.TEST_SUPABASE_URL : prod.VITE_SUPABASE_URL;
const ANON = useStaging ? stg.TEST_ANON_KEY : prod.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error(useStaging
    ? "No .env.staging with TEST_SUPABASE_URL/TEST_ANON_KEY. Nothing to verify."
    : "No VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env.");
  process.exit(2);
}
console.log(`\nBoundary probe — ${useStaging ? "STAGING" : "PRODUCTION"} ${URL}`);
console.log("Anon key only. Read-only. No DDL.\n");

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
};

// Does a table exist, and how many rows does anon ACTUALLY get back?
//
// Deliberately NOT `{ head: true }`: with a head request supabase-js does not
// surface a missing-table error, so an ABSENT table comes back looking
// readable. That bug made this script report two non-existent tables as an
// anon leak. Fetch real rows and count them.
//
// Note the distinction this function is built around: a table protected by RLS
// answers successfully with ZERO rows. "The query succeeded" is not evidence of
// a leak; only rows are.
async function probeTable(t) {
  const { data, error } = await anon.from(t).select("*").limit(200);
  // PGRST205 = table not found in schema cache; 42P01 = undefined_table
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" ||
        /does not exist|Could not find the table/i.test(error.message))
      return { state: "absent", rows: 0, detail: `absent (${error.code})` };
    return { state: "denied", rows: 0, detail: `denied: ${error.code} ${error.message}` };
  }
  const n = data?.length ?? 0;
  return n > 0
    ? { state: "readable", rows: n, detail: `${n} rows returned to anon` }
    : { state: "empty", rows: 0, detail: "query allowed, but 0 rows returned (RLS or empty table)" };
}

async function probeRpc(fn, args) {
  const { error } = await anon.rpc(fn, args);
  if (!error) return { state: "allowed", detail: "anon may execute" };
  if (error.code === "PGRST202" || /Could not find the function/i.test(error.message))
    return { state: "absent", detail: `absent (${error.code || "not found"})` };
  if (error.code === "42501" || /permission denied|not authorized/i.test(error.message))
    return { state: "denied", detail: `denied: ${error.message}` };
  return { state: "error", detail: `${error.code}: ${error.message}` };
}

const main = async () => {
  // ---- 1. universal_search itself -------------------------------------
  const us = await probeRpc("universal_search", { p_query: "kinematics", p_types: null, p_limit: 3, p_offset: 0 });
  if (us.state === "absent") {
    record("universal_search is callable by a logged-out student", false,
      "NOT INSTALLED on this database — the migration has not been applied here.");
  } else {
    record("universal_search is callable by a logged-out student",
      us.state === "allowed", us.detail);
  }

  // ---- 2. the catalogue the search reads ------------------------------
  for (const t of ["chapters", "playlists", "videos", "institutes_channels"]) {
    const r = await probeTable(t);
    record(`anon can read ${t} (public browsing works without login)`,
      r.state === "readable", r.detail);
  }

  // ---- 3. faculty capability gate -------------------------------------
  const teachers = await probeTable("teachers");
  record("teacher identity tables: present or absent",
    true, `public.teachers is ${teachers.state} — ${teachers.detail}`);

  if (teachers.state === "absent") {
    record("faculty group is correctly ABSENT (teachers_v7 not applied here)",
      true, "capability gate holds: no faculty results can be produced, and none are faked");
  }

  // ---- 4. unreviewed identity claims must be unreadable ----------------
  const aliases = await probeTable("teacher_aliases");
  if (aliases.state === "readable") {
    // If the table exists AND is readable, prove only VERIFIED rows come back.
    const { data } = await anon.from("teacher_aliases").select("status").limit(200);
    const bad = (data ?? []).filter((r) => r.status !== "verified");
    record("anon sees ONLY verified aliases (no unreviewed identity claims)",
      bad.length === 0, bad.length ? `leaked ${bad.length} non-verified rows` : "0 non-verified rows visible");
  } else {
    record("teacher_aliases is not openly readable by anon", true, aliases.detail);
  }

  // ---- 5. admin-only surfaces must refuse anon ------------------------
  for (const [fn, args] of [
    ["search_teacher_candidates", { p_query: "abj", p_limit: 5 }],
    ["resolve_teacher_exact", { p_name: "ABJ Sir" }],
    ["create_teacher", { p_display_name: "SHOULD NOT WORK" }],
    ["scan_free_text_teachers", {}],
  ]) {
    const r = await probeRpc(fn, args);
    record(`anon is refused ${fn}()`,
      r.state === "denied" || r.state === "absent",
      r.state === "absent" ? "not installed here" : r.detail);
  }

  // ---- 6. the admin proposal log ---------------------------------------
  const props = await probeTable("teacher_name_proposals");
  record("anon cannot read teacher_name_proposals (unreviewed identity claims)",
    props.state !== "readable", props.detail);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailed:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  }
  process.exitCode = failed.length ? 1 : 0;
};

main().catch((e) => { console.error(e); process.exitCode = 1; });
