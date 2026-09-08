// The exactly-one rule, tested as the rule rather than through a rendered
// card. Every case below is a shape production actually produces (or that
// PostgREST is allowed to produce), because the whole point of the helper is
// that a course either links to ONE real faculty page or to nothing at all.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FACULTY_SLUG_EMBED, courseTeacherSlug } from "./courseTeacherSlug.js";

// The junction row shape PostgREST returns for
// `faculty:playlist_teachers(teachers(slug))`.
const link = (slug) => ({ teachers: slug === null ? null : { slug } });

afterEach(() => {
  vi.doUnmock("./releaseCapabilities.js");
  vi.resetModules();
});

describe("courseTeacherSlug", () => {
  it("links a course with exactly one slugged teacher", () => {
    expect(courseTeacherSlug([link("amit-bijarnia")])).toBe("amit-bijarnia");
  });

  it("links nothing when the course has no faculty rows", () => {
    // 128 production courses (2026-09-08): free-text credit, no link to a
    // slugged teacher. They stay plain text.
    expect(courseTeacherSlug([])).toBeNull();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an absent embed", void 0],
  ])("links nothing for %s", (_label, value) => {
    // The capability gate can leave the embed off the query entirely, so the
    // field is simply not on the row. That is not an error, it is "no link".
    expect(courseTeacherSlug(value)).toBeNull();
  });

  it("links nothing when two DIFFERENT teachers are linked", () => {
    // Playlist 91, "Biology | NEET - Vardaan Series". Linking to whichever row
    // came back first would credit one of two people at random.
    expect(courseTeacherSlug([link("teacher-one"), link("teacher-two")])).toBeNull();
  });

  it("still links when the SAME teacher appears twice", () => {
    // Two junction rows, one identity (roles/position, or a re-import). One
    // destination means there is nothing to choose between.
    expect(courseTeacherSlug([link("amit-bijarnia"), link("amit-bijarnia")])).toBe("amit-bijarnia");
  });

  it("ignores a junction row whose teacher came back null", () => {
    expect(courseTeacherSlug([link(null), link("amit-bijarnia")])).toBe("amit-bijarnia");
    expect(courseTeacherSlug([link(null)])).toBeNull();
  });

  it.each([
    ["a missing slug key", { teachers: {} }],
    ["a null slug", { teachers: { slug: null } }],
    ["an empty slug", { teachers: { slug: "" } }],
    ["a whitespace slug", { teachers: { slug: "   " } }],
    ["a non-string slug", { teachers: { slug: 7 } }],
  ])("does not count a teacher with %s toward the tally", (_label, row) => {
    // The unlinkable row must not suppress the one real link beside it: it is
    // not a second destination, it is no destination.
    expect(courseTeacherSlug([row])).toBeNull();
    expect(courseTeacherSlug([row, link("amit-bijarnia")])).toBe("amit-bijarnia");
  });

  it("tolerates a bare object instead of an array at either level", () => {
    // PostgREST hands back an object, not an array, for a to-one embed.
    expect(courseTeacherSlug(link("amit-bijarnia"))).toBe("amit-bijarnia");
    expect(courseTeacherSlug([{ teachers: [{ slug: "amit-bijarnia" }] }])).toBe("amit-bijarnia");
  });

  it("never invents or derives a slug", () => {
    // A free-text credit is not a slug. The only source is the teachers row.
    expect(courseTeacherSlug([{ teacher: "ABJ Sir" }])).toBeNull();
    expect(courseTeacherSlug(["amit-bijarnia"])).toBeNull();
  });

  it("returns the slug trimmed, so the /faculty URL is the profile's own", () => {
    expect(courseTeacherSlug([link(" amit-bijarnia ")])).toBe("amit-bijarnia");
    // ...and the trim is what makes the duplicate above one identity.
    expect(courseTeacherSlug([link(" amit-bijarnia"), link("amit-bijarnia ")])).toBe("amit-bijarnia");
  });
});

describe("FACULTY_SLUG_EMBED", () => {
  it("is a left join under an alias of its own", () => {
    // !inner here would drop the 206 courses with no faculty link from every
    // listing; the `faculty:` alias keeps it clear of usePlaylistBrowse's
    // separate, conditional `pt:` inner join used by the faculty FILTER.
    expect(FACULTY_SLUG_EMBED).toBe(", faculty:playlist_teachers(teachers(slug))");
    expect(FACULTY_SLUG_EMBED).not.toContain("!inner");
  });

  it("is empty where the faculty registry is not released", async () => {
    // An environment without the teachers_v7 tables would 400 the WHOLE course
    // query on this embed, so the gate has to remove it, not blank the field.
    vi.resetModules();
    vi.doMock("./releaseCapabilities.js", () => ({
      RELEASE_CAPABILITIES: { facultyRegistry: false },
      hasReleaseCapability: () => false,
    }));
    const gated = await import("./courseTeacherSlug.js");
    expect(gated.FACULTY_SLUG_EMBED).toBe("");
    // The rule itself is unchanged; with no embed there are simply no rows.
    expect(gated.courseTeacherSlug(undefined)).toBeNull();
  });

  // The header's whole job is to tell the next reader WHICH surfaces break if
  // this rule changes. It shipped saying "BOTH read paths" while the same
  // branch added a third (the edge-rendered crawler body), which is exactly how
  // someone comes to edit this file believing the edge is not affected. So the
  // enumeration is checked against the imports rather than trusted.
  it("names every file that imports it, so the header cannot undercount its callers", () => {
    // Repo-root-relative, the way every other source-reading test here works.
    const header = readFileSync("src/courseTeacherSlug.js", "utf8")
      .split("\nimport ")[0];

    const callers = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name)) continue;
        if (entry.name.startsWith("courseTeacherSlug")) continue;
        if (entry.name.includes(".test.")) continue; // tests are not read paths
        if (readFileSync(full, "utf8").includes("courseTeacherSlug.js")) callers.push(entry.name);
      }
    };
    walk(".");

    // Sanity: if this ever finds nothing, the walk broke, not the header.
    expect(callers.length).toBeGreaterThanOrEqual(3);
    for (const caller of callers) expect(header).toContain(caller);
    // And no count word that a fourth caller would silently falsify.
    expect(header.toLowerCase()).not.toMatch(/\bboth read paths\b/);
  });
});
