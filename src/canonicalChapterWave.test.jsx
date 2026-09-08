// The hazards of collapsing the chapter waterfall into one request.
//
// useCanonicalFilters used to spend three DEPENDENT round trips on a chapter
// URL: goal+subject, then the chapter narrowed by the subject ID it had just
// learned, then that chapter's class levels. It now spends one, by scoping the
// chapter on the subject SLUG (already in the URL) and embedding the class
// levels on the same row.
//
// Collapsing waves is only worth it if nothing correctness-shaped is traded
// away, and each test below pins one thing that could have been. The file is
// deliberately module-isolated: `chapterScopeTableAvailable` is a module-level
// cache by design — a database without the optional junction should discover
// that once, not on every navigation — so each test imports the hook fresh
// rather than inheriting the previous test's discovery.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ---------------------------------------------------------------- the double
const calls = [];
const cfg = {};

// Production's real ambiguity, reproduced: "thermodynamics" is a chapter in
// BOTH Physics and Chemistry. Measured today —
//   chapters?select=…&slug=eq.thermodynamics                  -> 2 rows
//   chapters?select=…&slug=eq.thermodynamics&subjects.slug=eq.physics -> id 23
//   chapters?select=…&slug=eq.thermodynamics&subjects.slug=eq.chemistry -> id 36
const CHAPTERS = [
  { id: 1, slug: "kinematics", name: "Kinematics", subject: "physics", subject_id: 1, classes: ["class-11"] },
  { id: 23, slug: "thermodynamics", name: "Thermodynamics", subject: "physics", subject_id: 1, classes: ["class-11"] },
  { id: 36, slug: "thermodynamics", name: "Thermodynamics", subject: "chemistry", subject_id: 2, classes: ["class-11"] },
  // Reviewed by nobody: the LEFT-join embed must keep it, with an empty scope.
  { id: 283, slug: "introduction-to-chemistry", name: "Introduction to Chemistry", subject: "chemistry", subject_id: 2, classes: [] },
];
const SUBJECTS = { physics: 1, chemistry: 2 };

// PostgREST's real answers, copied from production responses today.
const MISSING_EMBED = {
  code: "PGRST200",
  message: "Could not find a relationship between 'chapters' and 'chapter_class_levels' in the schema cache",
  details: "Searched for a foreign key relationship between 'chapters' and 'chapter_class_levels' in the schema 'public', but no matches were found.",
};
const MISSING_TABLE = {
  code: "PGRST205",
  message: "Could not find the table 'public.chapter_class_levels' in the schema cache",
  details: null,
};

function makeBuilder(table) {
  const rec = { table, cols: null, eq: {}, limit: null };
  calls.push(rec);
  const b = {
    select(c) { rec.cols = c; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    order() { return b; }, range() { return b; }, ilike() { return b; }, in() { return b; },
    limit(n) { rec.limit = n; return b; },
    maybeSingle() {
      if (table === "subjects") {
        const id = SUBJECTS[rec.eq.slug] ?? null;
        return Promise.resolve({ data: id ? { id, slug: rec.eq.slug, name: rec.eq.slug } : null, error: null });
      }
      if (table === "learning_goals" && cfg.goalError) {
        return Promise.resolve({ data: null, error: { message: "boom", code: "500" } });
      }
      return Promise.resolve({ data: { id: 7, slug: rec.eq.slug, name: "Goal" }, error: null });
    },
    then(resolve) {
      if (table === "chapters") {
        const embedded = String(rec.cols).includes("chapter_class_levels");
        if (embedded && cfg.scopeMissing) {
          return Promise.resolve({ data: null, error: MISSING_EMBED }).then(resolve);
        }
        if (cfg.chapterError) {
          return Promise.resolve({ data: null, error: { message: "boom", code: "500" } }).then(resolve);
        }
        let rows = CHAPTERS.filter((r) => r.slug === rec.eq.slug);
        // The scope lives INSIDE the query, exactly as PostgREST applies it.
        if (rec.eq["subjects.slug"] != null) rows = rows.filter((r) => r.subject === rec.eq["subjects.slug"]);
        if (rec.eq.subject_id != null) rows = rows.filter((r) => r.subject_id === rec.eq.subject_id);
        const shaped = rows.slice(0, rec.limit ?? rows.length).map((r) => ({
          id: r.id, slug: r.slug, name: r.name,
          ...(String(rec.cols).includes("subjects!inner") ? { subjects: { slug: r.subject } } : {}),
          ...(embedded ? { chapter_class_levels: r.classes.map((slug) => ({ class_levels: { slug } })) } : {}),
        }));
        return Promise.resolve({ data: shaped, error: null }).then(resolve);
      }
      if (table === "chapter_class_levels") {
        if (cfg.scopeMissing) return Promise.resolve({ data: null, error: MISSING_TABLE }).then(resolve);
        const row = CHAPTERS.find((r) => r.id === rec.eq.chapter_id);
        return Promise.resolve({
          data: (row?.classes ?? []).map((slug) => ({ class_levels: { slug } })), error: null,
        }).then(resolve);
      }
      return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
    },
  };
  return b;
}
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t) => makeBuilder(t) },
}));

// A fresh module registry per test, so the session-level junction cache never
// leaks from the missing-table cases into the ordinary ones.
async function resolveUrl(qs) {
  vi.resetModules();
  const { useCanonicalFilters } = await import("./useCanonicalFilters.js");
  let seen;
  function Probe() { seen = useCanonicalFilters(new URLSearchParams(qs)); return null; }
  render(<MemoryRouter><Probe /></MemoryRouter>);
  await waitFor(() => expect(seen.loading).toBe(false));
  return () => seen;
}

const chapterCalls = () => calls.filter((c) => c.table === "chapters");
const scopeCalls = () => calls.filter((c) => c.table === "chapter_class_levels");

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(cfg)) delete cfg[k];
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

// ============================================================ the happy path
describe("one request resolves the chapter and its class scope", () => {
  it("scopes on the subject slug and embeds the junction", async () => {
    const s = await resolveUrl("goal=jee&class=11&subject=physics&chapter=kinematics");
    expect(s().ready).toBe(true);
    expect(s().chapterId).toBe(1);
    expect(s().chapterClassSlugs).toEqual(["class-11"]);

    expect(chapterCalls()).toHaveLength(1);
    expect(chapterCalls()[0].eq).toEqual({ slug: "kinematics", "subjects.slug": "physics" });
    expect(chapterCalls()[0].cols).toContain("chapter_class_levels(class_levels(slug))");
    expect(scopeCalls()).toHaveLength(0);           // wave 3 is gone
  });

  it("picks the right one of two chapters sharing a slug", async () => {
    const physics = await resolveUrl("subject=physics&chapter=thermodynamics");
    expect(physics().chapterId).toBe(23);
    calls.length = 0;
    const chemistry = await resolveUrl("subject=chemistry&chapter=thermodynamics");
    expect(chemistry().chapterId).toBe(36);
    expect(chemistry().ready).toBe(true);
  });

  it("keeps a legacy id link scoping on subject_id, still in one wave", async () => {
    const s = await resolveUrl("sub=2&chapter=thermodynamics");
    expect(s().chapterId).toBe(36);
    expect(chapterCalls()[0].eq).toEqual({ slug: "thermodynamics", subject_id: 2 });
    expect(chapterCalls()[0].cols).not.toContain("subjects!inner");
    expect(scopeCalls()).toHaveLength(0);
  });

  it("keeps an unreviewed chapter, with an EMPTY scope rather than dropping it", async () => {
    // The embed must be a LEFT join. `chapter_class_levels!inner` returns no
    // row at all for this chapter (measured), which would report a real
    // chapter as an unknown slug.
    const s = await resolveUrl("subject=chemistry&chapter=introduction-to-chemistry");
    expect(s().ready).toBe(true);
    expect(s().chapterId).toBe(283);
    expect(s().chapterClassSlugs).toEqual([]);      // "unreviewed", not "missing"
    expect(chapterCalls()[0].cols).not.toContain("!inner(class_levels");
  });

  it("still asks separately for a legacy chapter-ID URL, which has no slug to embed on", async () => {
    const s = await resolveUrl("ch=1");
    expect(s().ready).toBe(true);
    expect(s().chapterClassSlugs).toEqual(["class-11"]);
    expect(chapterCalls()).toHaveLength(0);
    expect(scopeCalls()).toHaveLength(1);           // the only request it makes
  });
});

// ============================================================ hazard 1
describe("HAZARD 1 — the optional junction must not become a hard failure", () => {
  // Embedding an OPTIONAL table makes the WHOLE query fail when the table is
  // absent. Left unhandled that converts a graceful degradation ("no reviewed
  // scope, carry on") into a broken chapter lookup — strictly worse than the
  // waterfall it replaced. No test covered the embedded form before this one.
  it("falls back to the unembedded query and still resolves the chapter", async () => {
    cfg.scopeMissing = true;
    const s = await resolveUrl("subject=physics&chapter=kinematics");

    expect(s().ready).toBe(true);                   // the crux: not broken
    expect(s().chapterId).toBe(1);
    expect(s().error).toBeNull();
    expect(s().unresolved).toEqual([]);
    // null is "we could not find out", which is what the class filter treats
    // as fallback. [] would mean "reviewed, and scoped to nothing".
    expect(s().chapterClassSlugs).toBeNull();

    expect(chapterCalls()).toHaveLength(2);
    expect(chapterCalls()[0].cols).toContain("chapter_class_levels");
    expect(chapterCalls()[1].cols).not.toContain("chapter_class_levels");
    // and the retry keeps the disambiguator — falling back must never widen
    expect(chapterCalls()[1].eq).toEqual({ slug: "kinematics", "subjects.slug": "physics" });
  });

  it("recognises the standalone 404 as well as the embedded 400", async () => {
    cfg.scopeMissing = true;
    const s = await resolveUrl("ch=1");             // takes the standalone path
    expect(s().ready).toBe(true);
    expect(s().chapterClassSlugs).toBeNull();
    expect(s().error).toBeNull();
  });

  it("learns once: the second navigation skips the embed entirely", async () => {
    cfg.scopeMissing = true;
    vi.resetModules();
    const { useCanonicalFilters } = await import("./useCanonicalFilters.js");
    let seen;
    function Probe({ qs }) { seen = useCanonicalFilters(new URLSearchParams(qs)); return null; }

    const { rerender } = render(<MemoryRouter><Probe qs="subject=physics&chapter=kinematics" /></MemoryRouter>);
    await waitFor(() => expect(seen.ready).toBe(true));
    expect(chapterCalls()).toHaveLength(2);         // discovery costs one retry

    calls.length = 0;
    rerender(<MemoryRouter><Probe qs="subject=chemistry&chapter=thermodynamics" /></MemoryRouter>);
    await waitFor(() => expect(seen.chapterId).toBe(36));
    expect(chapterCalls()).toHaveLength(1);         // never worse than one wave
    expect(chapterCalls()[0].cols).not.toContain("chapter_class_levels");
  });

  it("does NOT read a broken subject embed as a missing junction", async () => {
    // PGRST200 is the generic "no such relationship" code. If the fallback
    // trusted the code alone, a failure of subjects!inner would be retried
    // WITHOUT the subject constraint — silently widening the very lookup this
    // hook exists to keep narrow. So the table's own name must appear.
    vi.resetModules();
    const { useCanonicalFilters } = await import("./useCanonicalFilters.js");
    const mod = await import("./supabaseClient");
    const spy = vi.spyOn(mod.supabase, "from");
    spy.mockImplementation((t) => {
      const b = makeBuilder(t);
      if (t !== "chapters") return b;
      // Same code, different relationship named. Nothing here mentions the
      // junction, so nothing here justifies dropping the subject scope.
      b.then = (resolve) => Promise.resolve({
        data: null,
        error: {
          code: "PGRST200",
          message: "Could not find a relationship between 'chapters' and 'subjects' in the schema cache",
          details: "Searched for a foreign key relationship between 'chapters' and 'subjects' in the schema 'public', but no matches were found.",
        },
      }).then(resolve);
      return b;
    });

    let seen;
    function Probe() { seen = useCanonicalFilters(new URLSearchParams("subject=physics&chapter=kinematics")); return null; }
    render(<MemoryRouter><Probe /></MemoryRouter>);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(chapterCalls()).toHaveLength(1);         // no widening retry
    expect(seen.ready).toBe(false);
    expect(seen.error).toBe("Couldn’t load this selection.");
    spy.mockRestore();
  });
});

// ============================================================ hazard 2
describe("HAZARD 2 — an unresolved subject never broadens the chapter lookup", () => {
  it("cannot match a chapter in another subject, because the scope is in the query", async () => {
    const s = await resolveUrl("subject=not-a-subject&chapter=thermodynamics");

    expect(s().ready).toBe(false);
    expect(s().chapterId).toBeNull();
    // The old guard skipped the query to get this; the constraint now travels
    // with it, so the unscoped shape is unreachable rather than merely unused.
    expect(chapterCalls()[0].eq["subjects.slug"]).toBe("not-a-subject");
    expect(chapterCalls()[0].eq.slug).toBe("thermodynamics");
  });

  it("names only the subject, the one filter the student can actually fix", async () => {
    const s = await resolveUrl("subject=not-a-subject&chapter=thermodynamics");
    // Listing the chapter too would accuse a chapter that does exist — under a
    // subject reachable by correcting the subject alone.
    expect(s().unresolved).toEqual([{ key: "subject", slug: "not-a-subject" }]);
  });

  it("reports a chapter missing from a REAL subject as the unresolved one", async () => {
    const s = await resolveUrl("subject=chemistry&chapter=kinematics");
    expect(s().ready).toBe(false);
    expect(s().unresolved).toEqual([{ key: "chapter", slug: "kinematics" }]);
    expect(s().subjectId).toBe(2);
  });
});

// ============================================================ hazard 3
describe("HAZARD 3 — a failed lookup is not an empty result", () => {
  it("a chapter query that errors stays an ERROR, not 'no such chapter'", async () => {
    cfg.chapterError = true;
    const s = await resolveUrl("subject=physics&chapter=kinematics");

    expect(s().error).toBe("Couldn’t load this selection.");
    expect(s().ready).toBe(false);
    expect(s().unresolved).toEqual([]);             // NOT reported as unknown
    expect(s().chapterId).toBeNull();
  });

  it("a sibling lookup that errors takes the whole resolution down with it", async () => {
    cfg.goalError = true;
    const s = await resolveUrl("goal=jee&subject=physics&chapter=kinematics");
    expect(s().error).toBe("Couldn’t load this selection.");
    expect(s().ready).toBe(false);
    expect(s().unresolved).toEqual([]);
  });
});

// ============================================================ hazard 4
describe("HAZARD 4 — a chapter slug with no subject may be ambiguous", () => {
  it("resolves an unambiguous one without a subject", async () => {
    const s = await resolveUrl("chapter=kinematics");
    expect(s().ready).toBe(true);
    expect(s().chapterId).toBe(1);
    expect(chapterCalls()[0].eq).toEqual({ slug: "kinematics" });
    expect(chapterCalls()[0].cols).not.toContain("subjects!inner");
  });

  it("asks for two rows, so ambiguity is an ANSWER rather than a database error", async () => {
    // maybeSingle() turned this into PGRST116, which the caller could only
    // report as "Couldn't load this selection" behind a Retry that can never
    // succeed. limit(2) is enough to know there is more than one.
    const s = await resolveUrl("chapter=thermodynamics");
    expect(chapterCalls()[0].limit).toBe(2);
    expect(s().error).toBeNull();
  });

  it("refuses to guess: un-ready, named, and explained", async () => {
    const s = await resolveUrl("chapter=thermodynamics");
    expect(s().ready).toBe(false);
    expect(s().chapterId).toBeNull();
    expect(s().unresolved).toEqual([
      { key: "chapter", slug: "thermodynamics", reason: "ambiguous" },
    ]);
  });

  it("and adding the subject resolves the same URL", async () => {
    const s = await resolveUrl("subject=physics&chapter=thermodynamics");
    expect(s().ready).toBe(true);
    expect(s().chapterId).toBe(23);
  });
});
