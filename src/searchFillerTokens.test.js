// Guards the search filler-token migration.
//
// WHY. universal_search's tier 4 requires EVERY query token to be a substring of
// the title, and tier 5 requires every token to clear a 0.5 word-similarity
// threshold. One token no title contains kills the whole query. Measured against
// production on 2026-08-10 with a 43-query corpus of realistic student queries,
// 19 returned zero rows (44%) — including "how to solve pulley problems" while
// "Pulley Problem - Newton's Laws of Motion" was sitting in the catalogue.
//
// docs/sql/search_filler_tokens_2026-08-10.sql strips study-intent words from the
// token list. These tests pin the properties that make that safe, because the
// migration re-emits the whole 232-line universal_search body and a future
// regeneration could silently drop any of them.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const MIGRATION = "docs/sql/search_filler_tokens_2026-08-10.sql";
const sql = readFileSync(MIGRATION, "utf8");
const source = readFileSync("src/migrations/universal_search_v11.sql", "utf8");

const fillerList = () => {
  const block = sql.match(/create or replace function public\.search_filler_tokens\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/);
  expect(block, "could not find the filler array").toBeTruthy();
  return block[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
};

describe("the filler list contains intent words, never topics", () => {
  const filler = fillerList();

  it("is a non-trivial list of lower-case single words", () => {
    expect(filler.length).toBeGreaterThan(40);
    for (const w of filler) {
      expect(w, w).toBe(w.toLowerCase());
      expect(w, w).not.toMatch(/\s/);
    }
    expect(new Set(filler).size, "duplicates in the filler list").toBe(filler.length);
  });

  it("never contains a word that appears in real lesson titles", () => {
    // A word belongs in the list only if it says what the student wants DONE.
    // Any of these would silently delete the meaningful half of a query.
    const TOPICS = [
      "friction", "motion", "physics", "chemistry", "maths", "mathematics",
      "biology", "integration", "differentiation", "derivation", "application",
      "thermodynamics", "kinematics", "gravitation", "pulley", "maxima", "minima",
      "vector", "entropy", "doppler", "lens", "limits", "derivatives", "rotational",
      "projectile", "electrostatics", "capacitor", "titration", "pedigree",
    ];
    for (const t of TOPICS) {
      expect(filler, `"${t}" is a topic and must not be filler`).not.toContain(t);
    }
  });

  it("does contain the words that were actually breaking queries", () => {
    // Each of these appeared in a measured zero-result query.
    for (const w of ["how", "to", "solve", "find", "what", "is", "best", "lecture",
      "class", "ncert", "problem", "numerical", "example"]) {
      expect(filler, `"${w}" should be filler`).toContain(w);
    }
  });
});

describe("the migration keeps the parts that make it safe", () => {
  it("tests the filler list against BOTH the typed and the singular form", () => {
    // Got this wrong twice while writing the migration, in both directions:
    //   typed-form only  -> "problems" survives (the list holds "problem"), so
    //                       "friction problems" demanded a title with both words
    //   singular only    -> "class" is 5 chars ending in s, singularises to
    //                       "clas", which is in no list, so it survived and
    //                       broke "gravitation class 11"
    // Both checks are required. Removing either reintroduces a measured failure.
    expect(sql).toMatch(/not \(tok\s+= any \(public\.search_filler_tokens\(\)\)\)/);
    expect(sql).toMatch(/not \(tok_s = any \(public\.search_filler_tokens\(\)\)\)/);
  });

  it("keeps the empty-token fallback", () => {
    // THE dangerous case. With every token filtered away, tier 5's
    // "not exists (select from unnest(<empty>))" is vacuously true, so every row
    // over the length floor would match. The fallback keeps the original tokens.
    expect(sql).toMatch(/if cardinality\(q_content\) > 0 then\s*\n\s*q_tokens := q_content;\s*\n\s*end if;/);
  });

  it("leaves the needle q untouched, so exact and prefix tiers still work", () => {
    // Tiers 1 and 3 match on the whole normalised query. If the migration had
    // rewritten q as well, "Rotational Motion" would stop being an exact match.
    const fn = sql.slice(sql.indexOf("create or replace function public.universal_search"));
    expect(fn).toMatch(/q\s+text\s*:=\s*public\.search_latin_key\(p_query\)/);
    expect(fn).not.toMatch(/q\s*:=\s*array_to_string/);
  });

  it("reproduces the pg_trgm search_path pin after the create", () => {
    // create-or-replace RESETS a function's search_path, and plpgsql resolves
    // body SQL at first EXECUTION — so without this the CREATE succeeds and the
    // first real search dies with "operator does not exist: text %> text".
    // Anchored to the statement at the start of a line, not the string — the
    // header comment names the pin block in prose, and matching that gave a
    // position BEFORE the create and a confusingly failing assertion.
    const lines = sql.split("\n");
    const pinAt = lines.findIndex((l) => l.trimEnd() === "do $pin_search_path$");
    const createAt = lines.findIndex((l) =>
      l.startsWith("create or replace function public.universal_search"));
    expect(pinAt, "no do $pin_search_path$ statement").toBeGreaterThan(-1);
    expect(createAt, "no universal_search create").toBeGreaterThan(-1);
    expect(pinAt, "the pin must run AFTER the create-or-replace").toBeGreaterThan(createAt);
    // ...and before the commit, so a failed pin cannot leave the function live
    // with a reset search_path.
    const commitAt = lines.findIndex((l) => l.trimEnd() === "commit;");
    expect(pinAt).toBeLessThan(commitAt);
  });

  it("grants the new helper to anon, because universal_search is SECURITY INVOKER", () => {
    // A logged-out student's call runs the body AS anon and resolves
    // search_filler_tokens() by name. Miss this grant and EVERY public search
    // fails with "permission denied for function search_filler_tokens".
    expect(sql).toMatch(/grant execute on function public\.search_filler_tokens\(\)[\s\S]{0,80}anon/);
    expect(source).toContain("permission denied for function search_rank_tokens");
  });

  it("re-emits universal_search verbatim apart from the tokenisation change", () => {
    // The body cannot be patched in place, so the migration reproduces it. Prove
    // the reproduction did not quietly drop or reword anything else: every
    // non-comment line of the original function must still be present.
    const origFn = source
      .slice(source.indexOf("create or replace function public.universal_search"))
      .split("\nend; $$;")[0];
    const migFn = sql
      .slice(sql.indexOf("create or replace function public.universal_search"))
      .split("\nend; $$;")[0];
    const meaningful = (s) => s.split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--"));
    const migLines = new Set(meaningful(migFn));
    const missing = meaningful(origFn).filter((l) => !migLines.has(l));
    expect(missing, `lines lost from the original function: ${missing.slice(0, 5).join(" | ")}`)
      .toHaveLength(0);
  });

  it("self-verifies the queries it exists to fix, and the regression cases", () => {
    for (const q of ["how to solve pulley problems", "friction problems", "how to find maxima"]) {
      expect(sql, `self-test should assert on "${q}"`).toContain(q);
    }
    expect(sql).toMatch(/Rotational Motion/);
    expect(sql).toMatch(/rotatinal motion/);          // typo tolerance guard
    expect(sql).toMatch(/pure-filler query returned/); // the vacuous-match guard
    expect(sql).toMatch(/2-character floor/);          // the "a" floor
  });
});
