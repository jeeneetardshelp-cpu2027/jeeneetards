// The Hinglish filler list must not reach `supabase db push` until
// universal_search has a q_long floor.
//
// WHY THIS FILE EXISTS. The word list in
// docs/sql/search_filler_tokens_hinglish_2026-09-07.sql is measured, screened
// and correct — four lenses agreed on it, and an independent pass reproduced
// their counts. It is held back for a reason that has nothing to do with the
// words.
//
// universal_search picks `q_long` as the LONGEST SURVIVING token and uses it
// as the index prefilter. Removing tokens can only shorten q_long, and a
// two-character q_long yields too few trigrams for the GIN index, so the
// planner scans and the statement is cancelled. Measured on production on
// 7 Sep 2026 — and note that "the" and "of" are already English filler, which
// makes "ac the of" an exact stand-in for what "ac kya hai" becomes:
//
//   "ac kya hai"  q_long=hai  200, 1525 ms     "ac the of"  q_long=ac  500, 57014
//   "ph kya hai"  q_long=hai  200,  634 ms     "ph the of"  q_long=ph  500, 57014
//   "ac xyz"      q_long=xyz  200, 1033 ms  <- control: a 6-char needle is fine,
//                                              so the variable is q_long, not
//                                              what the student typed.
//
// So a student asking "what is AC" in Hinglish — exactly the person this list
// is for — would get "Search is unavailable" instead of a fast answer.
//
// WHY A TEST AND NOT JUST A BANNER. `supabase db push` has no per-file
// selection: it applies everything pending at once. On 2 Sep 2026 a migration
// in this repo went live that way, swept along by an unrelated push from
// another session. A comment inside the file would not have stopped that. Being
// outside supabase/migrations/ does, and this test is what stops it drifting
// back in before the floor exists.
//
// THIS TEST GOES QUIET ON ITS OWN once universal_search carries a q_long floor
// and the file is renamed back into the chain — at which point the assertions
// below stop applying rather than needing to be deleted.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PARKED = "docs/sql/search_filler_tokens_hinglish_2026-09-07.sql";
const HOLD_MARKER = "DO NOT APPLY YET";
const CHAIN = "supabase/migrations";

/** The token that only exists once the floor has been written. */
const floorLanded = () =>
  readdirSync(CHAIN)
    .filter((f) => f.endsWith(".sql"))
    .some((f) => /q_long_floor|qlong_floor/i.test(f));

describe("hinglish filler list stays out of the push chain until q_long has a floor", () => {
  it("is parked outside supabase/migrations/, not merely commented", () => {
    if (floorLanded()) return; // floor shipped — the hold no longer applies

    expect(
      existsSync(PARKED),
      `${PARKED} is missing. If it was renamed back into the chain, the q_long ` +
        "floor must have landed first — see this file's header.",
    ).toBe(true);

    // Detected by CONTENT, not by filename. An earlier version of this check
    // matched the name, and a rename walked straight past it — which is the
    // whole failure mode, since getting the file into the chain is exactly what
    // a rename does. A migration that re-emits search_filler_tokens() with the
    // Hindi words in it is the thing that must not be there, whatever it is
    // called.
    const inChain = readdirSync(CHAIN)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => {
        const body = readFileSync(join(CHAIN, f), "utf8");
        if (!/create\s+or\s+replace\s+function\s+"?public"?\."?search_filler_tokens/i.test(body)) {
          return false;
        }
        const emitted = body.match(/select array\[([\s\S]*?)\]::text\[\]/);
        if (!emitted) return false;
        const words = emitted[1]
          .split("\n")
          .map((line) => line.replace(/--.*$/, ""))
          .join("\n")
          .match(/'([^']+)'/g)
          ?.map((s) => s.slice(1, -1)) ?? [];
        // 'kya' and 'hai' are the two that collapse q_long in the measured
        // cases, so their presence is what makes a body dangerous today.
        return words.includes("kya") || words.includes("hai");
      });

    expect(
      inChain,
      "a migration in supabase/migrations/ re-emits search_filler_tokens() with the " +
        "Hindi words in it, where `db push` will apply it. Doing that before " +
        'universal_search has a q_long floor turns "ac kya hai" and "ph kya hai" from ' +
        "a fast answer into a 57014 timeout — see this file's header for the measurements.",
    ).toEqual([]);
  });

  it("says why it is held, in the file itself", () => {
    if (floorLanded()) return;
    const body = readFileSync(PARKED, "utf8");
    expect(body).toContain(HOLD_MARKER);
    // The reason has to travel with the file. A hold nobody can explain gets
    // lifted by the next person who finds it inconvenient.
    expect(body).toMatch(/q_long/);
    expect(body).toMatch(/57014|timeout|statement/i);
  });

  it("keeps the measured evidence that justifies the hold", () => {
    if (floorLanded()) return;
    const body = readFileSync(PARKED, "utf8");
    // The control matters more than the failing cases: without it, someone
    // reasonably concludes the problem is short queries and "fixes" it by
    // raising MIN_QUERY, which is already 3 and already does not help.
    //
    // The failing cases must be ones that CLEAR isServableQuery, or the
    // evidence is stale. An earlier draft cited "ac kya hai", which that gate
    // now refuses outright — so it proved nothing about this migration.
    for (const evidence of ["ac ka matlab", "ph kaise padhe", "ac xyz", "isServableQuery"]) {
      expect(body, `the hold's evidence must name ${evidence}`).toContain(evidence);
    }
  });

  it("still contains a real filler list, so the hold is protecting something", () => {
    if (floorLanded()) return;
    const body = readFileSync(PARKED, "utf8");
    const array = body.match(/select array\[([\s\S]*?)\]::text\[\]/);
    expect(array, "the parked file no longer emits a filler array").toBeTruthy();

    const words = array[1]
      .split("\n")
      .map((line) => line.replace(/--.*$/, "")) // strip SQL comments: they quote words too
      .join("\n")
      .match(/'([^']+)'/g)
      .map((s) => s.slice(1, -1));

    expect(words.length).toBeGreaterThan(200);
    expect(new Set(words).size, "the list contains duplicates").toBe(words.length);
    for (const hindi of ["ka", "ke", "ki", "kya", "hai", "kaise"]) {
      expect(words, `${hindi} should be in the held list`).toContain(hindi);
    }
    // The traps, still excluded. If a later hand widens the list while it sits
    // parked, this is the check that notices.
    for (const trap of ["shot", "one", "sir", "medium", "par", "hi", "ek"]) {
      expect(words, `"${trap}" must never be filler`).not.toContain(trap);
    }
  });
});
