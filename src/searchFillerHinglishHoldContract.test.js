// The Hinglish filler list: what is still true now that the hold is over.
//
// THIS FILE USED TO BE A HOLD. The word list was measured and correct, but
// applying it before universal_search had a q_long floor would have turned
// working queries into errors: filler removal can only shorten q_long, and a
// two-character q_long yields too few trigrams for the GIN index, so the
// planner scans and the statement is cancelled (57014). The file therefore sat
// in docs/sql/, and these tests existed to stop it drifting into the chain,
// because `supabase db push` has no per-file selection.
//
// THE HOLD ENDED ON 7 SEP 2026. 20260907093000_universal_search_q_long_floor
// landed, the list was unparked as 20260907140000_search_filler_tokens_hinglish
// and both are applied — migration list records local and remote for each.
// Verified live afterwards, because the list's own banner named the regression
// it feared: "ac ka matlab" answers 200 in 906 ms with 11 rows. It did not
// happen, because the floor's rescue keeps "matlab" as q_long.
//
// WHY THE FILE SURVIVED THE HOLD IT ENFORCED. Two reasons.
//
// First, the list assertions below were never about the hold. Over 200 words,
// no duplicates, the Hindi words present, and — the one that matters most —
// "one", "shot", "sir", "medium", "par", "hi" and "ek" never filler. Those are
// permanent properties of a filler list on this catalogue, and they now guard
// a body that production actually runs.
//
// Second, and the reason this file was rewritten rather than deleted: the gate
// that used to disarm it was
//
//     const floorLanded = () => ...some(f => /q_long_floor/i.test(f));
//
// with an `if (floorLanded()) return;` at the top of all four tests. It lifted
// on the floor's EXISTENCE — a filename match — not on the floor WORKING. So
// from the moment that migration was written, this suite reported 4 passed
// while asserting nothing at all.
//
// An earlier version of THIS header then justified the rewrite by saying the
// floor "does not fully work: its own header sets three acceptance queries and
// the third, 'p and c', still answers 500 57014". That was wrong, and wrong in
// the same direction as the gate it was complaining about. The floor's three
// acceptance queries are "a and b", "ac the of" and "ph the of"; all three
// answer 200 on production, 3 of 3 runs. "p and c" does still answer 500 57014,
// but it was never one of them -- the floor's own header says "ONE CASE THIS
// DOES NOT FIX, and an earlier draft of this header wrongly claimed it did",
// and "was never one of that file's conditions". So the correction re-made the
// error the file being described had already corrected in itself.
//
// The real reason to rewrite rather than delete stands on its own: a gate keyed
// to a FILENAME cannot report on BEHAVIOUR, whether or not the behaviour is
// sound. Nothing below is conditional. Each test below has been mutation-tested
// -- break the thing it names, and that test is the one that goes red.
//
// ("p and c" reaches no student either way: isServableQuery refuses it, tokens
// 1/3/1, on all three surfaces before any RPC call.)

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const APPLIED = "supabase/migrations/20260907140000_search_filler_tokens_hinglish.sql";
const HOLD_MARKER = "DO NOT APPLY YET";

describe("hinglish filler list, now that it is in the chain and applied", () => {
  it("is in the push chain, which is where the hold was holding out to get it", () => {
    expect(
      existsSync(APPLIED),
      APPLIED + " is gone. It was unparked into the chain on 7 Sep 2026 and " +
        "applied; if it has been moved back out, the migration history and the " +
        "files no longer agree.",
    ).toBe(true);
  });

  it("no longer tells the reader not to apply it, because it is applied", () => {
    // The hold marker travelled with the file while it sat in docs/sql/. A file
    // inside supabase/migrations/ that still says DO NOT APPLY YET is the same
    // class of defect as a README row claiming an applied migration is pending:
    // the next person reads it, believes it, and works around a block that is
    // not there.
    const body = readFileSync(APPLIED, "utf8");
    expect(body, "an applied migration still carries the hold banner").not.toContain(HOLD_MARKER);
  });

  it("emits a real filler list: over 200 words, no duplicates, and no trap words", () => {
    const body = readFileSync(APPLIED, "utf8");
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
