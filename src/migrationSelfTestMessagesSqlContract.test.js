// A migration self-test must be able to say WHAT failed.
//
// Several migrations in this chain collect their failures in a text[] and
// raise them together:
//
//     v_fail := v_fail || 'the alias pass was dropped';
//     ...
//     raise exception 'SELF-TEST FAILED: %', array_to_string(v_fail, ' | ');
//
// That append does not do what it reads like. With an UNTYPED literal Postgres
// resolves `||` as anyarray || anyarray and tries to parse the message AS an
// array, so the moment a check fails the block dies with
//
//     malformed array literal: "the alias pass was dropped"
//
// The migration still rolls back — it is fail-safe — but the operator is told
// nothing about which check failed, and every failure already collected is
// thrown away. That is precisely the moment the message was for.
//
// One character per line fixes it: '...'::text picks anyarray || anyelement.
//
// Found by another session while reviewing a competing q_long floor; the two
// affected files were both written by this one.
//
// The first test below PROVES the failure on a real engine rather than
// asserting it from memory, so this file cannot rot into folklore if a future
// Postgres changes the resolution rules.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";

describe("the operator resolution this contract exists for", () => {
  it("really does misparse an untyped message, and really is fixed by ::text", async () => {
    const pg = new PGlite();
    const append = (literal) => `
      do $$ declare v text[] := array[]::text[]; begin
        v := v || ${literal};
        raise notice 'collected %', array_to_string(v, ' | ');
      end $$;`;

    await expect(
      pg.exec(append("'the alias pass was dropped'")),
    ).rejects.toThrow(/malformed array literal/i);

    // The same message, one cast later.
    await expect(
      pg.exec(append("'the alias pass was dropped'::text")),
    ).resolves.toBeTruthy();
  }, 120_000);
});

/** Every DO-block variable a migration declares as text[]. */
function arrayVars(sql) {
  const names = new Set();
  const re = /^\s*([a-z_][a-z0-9_]*)\s+text\[\]/gim;
  let m;
  while ((m = re.exec(sql)) !== null) names.add(m[1]);
  return names;
}

/**
 * Appends of an untyped literal onto a text[] variable — the defect.
 * String concatenation onto a plain `text` variable is a different and correct
 * thing, so this only looks at variables the file itself declared as text[].
 */
function untypedAppends(sql) {
  const arrays = arrayVars(sql);
  if (arrays.size === 0) return [];
  const found = [];
  const re = /^\s*([a-z_][a-z0-9_]*)\s*:=\s*\1\s*\|\|\s*'((?:[^']|'')*)'\s*(::[a-z]+)?\s*;/gim;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (!arrays.has(m[1])) continue;   // a text variable being concatenated
    if (m[3]) continue;                // already cast
    found.push({ variable: m[1], message: m[2].slice(0, 60) });
  }
  return found;
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

describe("no migration collects a self-test message it cannot print", () => {
  it("finds the chain", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s casts every message it appends to a text[]", (file) => {
    const sql = readFileSync(join(DIR, file), "utf8");
    const bad = untypedAppends(sql);
    expect(
      bad,
      bad.length
        ? `${file} appends ${bad.length} untyped message(s) to a text[]. Postgres `
          + "resolves that as anyarray || anyarray and parses the message AS an array, "
          + "so the self-test dies with \"malformed array literal\" instead of naming "
          + `the check that failed. Add ::text. First: ${bad[0].variable} || '${bad[0].message}'`
        : "",
    ).toEqual([]);
  });

  it("would notice if the pattern came back", () => {
    // The detector has to actually detect. A guard that cannot fail is the
    // thing this repo has been bitten by twice.
    const sample = `
      do $$
      declare
        v_fail text[] := array[]::text[];
        v_note text := '';
      begin
        v_fail := v_fail || 'this one is wrong';
        v_note := v_note || 'this one is fine, v_note is text';
      end $$;`;
    const bad = untypedAppends(sample);
    expect(bad.map((b) => b.variable)).toEqual(["v_fail"]);
  });

  it("accepts the cast form", () => {
    const sample = `
      do $$ declare v_fail text[] := array[]::text[]; begin
        v_fail := v_fail || 'already cast'::text;
      end $$;`;
    expect(untypedAppends(sample)).toEqual([]);
  });
});
