// searchAliases: the words a student types, in the language they type them.
//
// Measured against production 2026-09-02, before this existed:
//   rasayan 0 rows, bhautiki 0, jeev vigyan 0, pw 0 — while chemistry
//   returned 27, physics 27, biology 21 and physics wallah 2. And "ganit"
//   returned 6 rows, none of them mathematics: it matched "Gangue" inside
//   lecture titles, which is worse than nothing because it looks like an
//   answer.
//
// The risk in a rewrite like this is not that it fails to help — it is that it
// changes a query that already worked. So the tests below spend most of their
// effort on what must NOT be touched.
import { describe, expect, it } from "vitest";
import { SEARCH_ALIASES, expandSearchQuery, expandedFrom } from "./searchAliases.js";

// Every subject in the catalogue on 2026-09-02, plus the one institute alias.
// A target outside this set would send a student somewhere that does not
// exist, trading "no results" for "no results, slower".
const REAL_TARGETS = new Set([
  "physics", "chemistry", "mathematics", "biology", "science",
  "english", "social science", "physics wallah",
]);

describe("aliases point at things that exist", () => {
  it("every target is a real subject or institute", () => {
    const unknown = [...new Set(SEARCH_ALIASES.values())].filter((t) => !REAL_TARGETS.has(t));
    expect(unknown).toEqual([]);
  });

  it("covers the words that measured zero on production", () => {
    for (const typed of ["rasayan", "bhautiki", "jeev vigyan", "pw", "ganit"]) {
      expect(expandSearchQuery(typed), typed).not.toBe(typed);
    }
  });

  it("covers the Devanagari spellings a Hindi keyboard produces", () => {
    expect(expandSearchQuery("रसायन")).toBe("chemistry");
    expect(expandSearchQuery("भौतिकी")).toBe("physics");
    expect(expandSearchQuery("गणित")).toBe("mathematics");
  });
});

describe("a query that is not an alias is left exactly alone", () => {
  it.each([
    "kinematics",
    "organic chemistry one shot",
    "physics",           // already the target — nothing to do
    "Mohit Tyagi",
    "class 11 physics",
    "pyq jee main",
  ])("%s", (typed) => {
    expect(expandSearchQuery(typed)).toBe(typed);
  });

  it("does not expand an alias buried in a longer phrase", () => {
    // A partial rewrite would be guessing at what the rest of the sentence
    // meant. Only the whole query counts.
    expect(expandSearchQuery("rasayan ka question")).toBe("rasayan ka question");
    expect(expandSearchQuery("best rasayan course")).toBe("best rasayan course");
    expect(expandSearchQuery("pwd")).toBe("pwd");
  });

  it("returns the ORIGINAL string, not a normalised one", () => {
    // The caller shows the student what they typed; normalising here would
    // quietly change the casing of every non-alias query.
    expect(expandSearchQuery("  Kinematics  ")).toBe("  Kinematics  ");
    expect(expandSearchQuery("MOHIT TYAGI")).toBe("MOHIT TYAGI");
  });

  it.each([["empty", ""], ["spaces", "   "], ["null", null], ["undefined", undefined]])(
    "handles %s without inventing a query",
    (_label, value) => {
      expect(expandSearchQuery(value)).toBe(value);
    },
  );
});

describe("matching is forgiving about how it was typed", () => {
  it.each(["RASAYAN", "  rasayan  ", "Rasayan", "jeev   vigyan"])("%s", (typed) => {
    expect(["chemistry", "biology"]).toContain(expandSearchQuery(typed));
  });
});

describe("expandedFrom reports what actually happened", () => {
  it("names the target when a query was rewritten", () => {
    expect(expandedFrom("rasayan")).toBe("chemistry");
    expect(expandedFrom("pw")).toBe("physics wallah");
  });

  it("is null when nothing was rewritten", () => {
    expect(expandedFrom("kinematics")).toBeNull();
    expect(expandedFrom("")).toBeNull();
  });

  it("agrees with expandSearchQuery, always", () => {
    // Two functions reading one table; a drift between them would show a
    // student one thing and search for another.
    for (const typed of [...SEARCH_ALIASES.keys(), "kinematics", "physics", ""]) {
      const target = expandedFrom(typed);
      if (target === null) expect(expandSearchQuery(typed)).toBe(typed);
      else expect(expandSearchQuery(typed)).toBe(target);
    }
  });
});
