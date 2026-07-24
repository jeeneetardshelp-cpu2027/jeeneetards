// verifyClassLevelSync.js — are the two class-level stores actually in sync?
//
// READ-ONLY. No writes, no DDL.
//
// CORRECTING AN EARLIER CLAIM: I previously reported the stores as "in sync"
// because both showed 7 rows. Equal totals prove nothing. Seven playlists each
// tagged "11th" in the array, with seven junction rows all pointing at Class 12,
// would also total 7-and-7 while every single row disagreed.
//
// The real question is per-playlist: for EACH playlist, does the sorted set of
// class slugs derived from playlists.class_levels[] equal the sorted set from
// playlist_class_levels? This compares them one playlist at a time and reports
// the mismatch count.
//
// It matters because the catalogue filters on the JUNCTION while the cards
// display the ARRAY. If they disagree, a student filters to Class 12 and sees
// a card badged "11th".
//
//   npm run verify:classsync
//   npm run verify:classsync -- --selftest   (proves the harness fails loudly)

import { client, must, rows, count, all, ProbeError } from "./dbProbe.js";

const LABEL_TO_SLUG = {
  "10th": "class-10", "11th": "class-11", "12th": "class-12", Dropper: "dropper",
};

const sameSet = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const db = client({ service: true });

  // --- SELF-TEST: the harness must FAIL on a bad column, not print a number.
  if (process.argv.includes("--selftest")) {
    console.log("Self-test: querying a column that does not exist.\n");
    try {
      // This is the exact query that previously printed "42703".
      const n = count("selftest", await db.from("playlist_class_levels").select("id", { count: "exact" }));
      console.error(`FAIL — the harness returned ${n} instead of throwing.`);
      console.error("A probe that cannot fail cannot produce evidence.");
      process.exitCode = 1;
      return;
    } catch (e) {
      if (e instanceof ProbeError) {
        console.log("PASS — harness threw as required:");
        console.log("  " + e.message);
        return;
      }
      throw e;
    }
  }

  console.log("Class-level store comparison (read-only, per playlist)\n");

  const playlists = await all("playlists", () =>
    db.from("playlists").select("id, title, class_levels").order("id"));
  const junction = await all("playlist_class_levels", () =>
    db.from("playlist_class_levels").select("playlist_id, class_level_id").order("playlist_id"));
  const levels = rows("class_levels", await db.from("class_levels").select("id, slug"));

  const slugById = new Map(levels.map((l) => [l.id, l.slug]));

  // junction -> playlist_id : sorted slugs
  const fromJunction = new Map();
  for (const j of junction) {
    const slug = slugById.get(j.class_level_id);
    if (!slug) throw new ProbeError("junction", {
      message: `playlist ${j.playlist_id} references class_level_id ${j.class_level_id}, which is not in class_levels`,
    });
    if (!fromJunction.has(j.playlist_id)) fromJunction.set(j.playlist_id, []);
    fromJunction.get(j.playlist_id).push(slug);
  }

  const mismatches = [];
  const unmappable = [];

  for (const p of playlists) {
    const labels = p.class_levels ?? [];
    const derived = [];
    for (const l of labels) {
      const slug = LABEL_TO_SLUG[l];
      // An unrecognised label is itself a defect: it can never match a filter.
      if (!slug) { unmappable.push({ id: p.id, label: l }); continue; }
      derived.push(slug);
    }
    const a = [...new Set(derived)].sort();
    const b = [...new Set(fromJunction.get(p.id) ?? [])].sort();
    if (!sameSet(a, b))
      mismatches.push({ id: p.id, title: (p.title ?? "").slice(0, 40), array: a, junction: b });
  }

  // Junction rows whose playlist no longer exists.
  const known = new Set(playlists.map((p) => p.id));
  const orphans = [...fromJunction.keys()].filter((id) => !known.has(id));

  console.log(`playlists compared : ${playlists.length}`);
  console.log(`junction rows      : ${junction.length}`);
  console.log(`MISMATCHES         : ${mismatches.length}`);
  console.log(`unmappable labels  : ${unmappable.length}`);
  console.log(`orphaned junction  : ${orphans.length}`);

  if (mismatches.length) {
    console.log("\nPer-playlist disagreements:");
    for (const m of mismatches)
      console.log(`  #${m.id} ${m.title}\n      array   : [${m.array.join(", ")}]\n      junction: [${m.junction.join(", ")}]`);
  }
  if (unmappable.length) {
    console.log("\nLabels that map to no class slug (unfilterable):");
    for (const u of unmappable) console.log(`  #${u.id} "${u.label}"`);
  }
  if (orphans.length) console.log(`\nJunction rows for missing playlists: ${orphans.join(", ")}`);

  const bad = mismatches.length + unmappable.length + orphans.length;
  console.log(bad === 0
    ? "\nStores agree per playlist."
    : `\n${bad} problem(s) found.`);
  process.exitCode = bad === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof ProbeError ? `PROBE FAILED — ${e.message}` : e);
  process.exitCode = 1;
});
