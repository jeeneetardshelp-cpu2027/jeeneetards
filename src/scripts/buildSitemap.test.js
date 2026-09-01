import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSitemap } from "./buildSitemap.js";

const tempDirs = [];

function temporarySitemap() {
  const dir = mkdtempSync(join(tmpdir(), "jeeneetard-sitemap-"));
  tempDirs.push(dir);
  return join(dir, "sitemap.xml");
}

function clientWith({
  courses = [], faculty = [], goals = [], boards = [], curriculum = () => [],
  papers = [], courseError = null, facultyError = null, goalError = null,
  boardError = null, curriculumError = null, paperError = null,
}) {
  // study_materials is queried with a filter chain and awaited directly;
  // playlists/boards end in .order(). One builder covers both shapes.
  const paperQuery = {
    eq() { return this; },
    ilike() { return this; },
    limit: async () => ({ data: papers, error: paperError }),
  };
  return () => ({
    from: (table) => ({
      select: () => table === "study_materials"
        ? paperQuery
        : {
            order: async () => table === "boards"
              ? ({ data: boards, error: boardError })
              : ({ data: courses, error: courseError }),
          },
    }),
    rpc: async (name, args) => {
      if (name === "get_faculty_facets") return { data: faculty, error: facultyError };
      if (args.p_goal == null) return { data: goals, error: goalError };
      return { data: curriculum(args), error: curriculumError };
    },
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("sitemap generation", () => {
  // Chapter pages used to be excluded on purpose, because the edge redirected
  // them into a noindex /browse. They are real pages now — but only the ones
  // holding a real comparison are offered, so a two-course chapter does not
  // compete with its own subject page.
  it("escapes the query string so the document is valid XML", async () => {
    // A raw "&" in <loc> makes the whole sitemap unparseable and Google
    // rejects it — which would silently undo the point of listing chapters.
    const { urlEntry } = await import("./buildSitemap.js");
    const entry = urlEntry("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");
    expect(entry).toContain("chapter=kinematics");
    expect(entry).toContain("&amp;");
    expect(entry).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("lists chapters that hold a comparison, and withholds thin ones", async () => {
    const out = temporarySitemap();
    await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [], faculty: [],
        goals: [{ slug: "jee", course_count: 10 }],
        boards: [],
        curriculum: ({ p_class, p_subject }) => {
          if (p_subject === "physics") {
            return [
              { slug: "kinematics", course_count: 13 },
              { slug: "rotational-motion", course_count: 3 },
              { slug: "errors-in-measurement", course_count: 2 },
              { slug: "unnamed", course_count: 9, ...{ slug: undefined } },
            ];
          }
          if (p_class === "class-11") return [{ slug: "physics", course_count: 20 }];
          return [];
        },
      }),
    });

    const xml = readFileSync(out, "utf8");
    const base = "https://www.jeeneetard.com/browse?goal=jee&amp;class=11&amp;subject=physics&amp;chapter=";
    expect(xml).toContain(`<loc>${base}kinematics</loc>`);
    expect(xml).toContain(`<loc>${base}rotational-motion</loc>`);
    // Two courses is not a comparison worth indexing.
    expect(xml).not.toContain(`<loc>${base}errors-in-measurement</loc>`);
    // A chapter with no slug can produce no URL at all.
    expect(xml).not.toContain(`${base}undefined`);
    expect(xml).not.toContain("//</loc>");
  });

  it("includes canonical course, faculty and populated Explore URLs", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5, created_at: "2026-07-20T10:00:00Z" }],
        faculty: [{ slug: "mohit-tyagi" }, { slug: "amit-bijarnia" }, { slug: "mohit-tyagi" }],
        goals: [
          { slug: "jee", course_count: 10 },
          { slug: "school", course_count: 3 },
        ],
        boards: [
          { slug: "cbse", playlist_boards: [{ count: 3 }] },
          { slug: "icse", playlist_boards: [{ count: 0 }] },
        ],
        curriculum: ({ p_goal, p_class, p_subject }) => {
          if (p_subject) {
            return p_goal === "jee" && p_class === "class-11" && p_subject === "physics"
              ? [{ slug: "kinematics", course_count: 1 }]
              : p_goal === "school" && p_class === "class-10" && p_subject === "mathematics"
                ? [{ slug: "algebra", course_count: 1 }]
                : [];
          }
          if (p_goal === "jee" && p_class === "class-11") {
            return [{ slug: "physics", course_count: 2 }];
          }
          if (p_goal === "school" && p_class === "class-10") {
            return [{ slug: "mathematics", course_count: 2 }];
          }
          return [];
        },
      }),
    });

    const xml = readFileSync(out, "utf8");
    expect(result).toEqual({
      outcome: "written", courses: 1, faculty: 2, explore: 7, paperYears: 0,
    });
    expect(xml).toContain("<loc>https://www.jeeneetard.com/course/5</loc>");
    expect(xml).toContain("<lastmod>2026-07-20</lastmod>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/faculty/amit-bijarnia</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/faculty</loc>");
    expect(xml.match(/faculty\/mohit-tyagi/g)).toHaveLength(1);
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore/jee</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore/jee/class-11</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore/jee/class-11/physics</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore/school/cbse/class-10/mathematics</loc>");
    expect(xml).not.toContain("/explore/jee/class-12");
    expect(xml).not.toContain("/explore/school/icse");
    expect(xml).not.toContain("/kinematics</loc>");
  });

  it("preserves the last complete sitemap when either catalogue query fails", async () => {
    const out = temporarySitemap();
    const previous = '<?xml version="1.0"?><urlset><url><loc>https://www.jeeneetard.com/</loc></url><url><loc>https://www.jeeneetard.com/course/99</loc></url></urlset>';
    writeFileSync(out, previous, "utf8");

    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5 }],
        goals: [{ slug: "jee", course_count: 1 }],
        curriculumError: { message: "temporary timeout" },
      }),
    });

    expect(result.outcome).toBe("preserved");
    expect(readFileSync(out, "utf8")).toBe(previous);
  });

  // Only years the catalogue actually returned a paper for. A URL shape alone
  // is never evidence that a year exists — the edge 404s an empty year, and a
  // sitemap must not advertise a 404.
  it("advertises one page per exam year that has papers", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5 }],
        goals: [],
        papers: [
          { exam_year: 2024 },
          { exam_year: 2024 },
          { exam_year: 2022 },
          { exam_year: null },
        ],
      }),
    });

    const xml = readFileSync(out, "utf8");
    expect(result.paperYears).toBe(2);
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2024</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2022</loc>",
    );
    expect(xml).not.toContain("previous-year-papers/2023");
  });

  // The paper tier is a side branch. A failure there must not downgrade the
  // whole sitemap and hold back every course and chapter URL.
  it("keeps writing the catalogue when the paper-year query fails", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5 }],
        goals: [],
        paperError: { message: "temporary timeout" },
      }),
    });

    expect(result.outcome).toBe("written");
    expect(result.paperYears).toBe(0);
    expect(readFileSync(out, "utf8")).toContain("<loc>https://www.jeeneetard.com/course/5</loc>");
  });

  it("writes a static sitemap only when no prior sitemap exists", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({ env: {}, out });
    const xml = readFileSync(out, "utf8");

    expect(result.outcome).toBe("static");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore</loc>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/methodology</loc>");
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-main/previous-year-papers</loc>",
    );
    expect(xml).toContain("<loc>https://www.jeeneetard.com/forum</loc>");
    expect(xml).not.toContain("/course/");
  });
});
