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
  // `papers` may be a function of the landing's ilike pattern, because the
  // sitemap now runs one query per registered landing (JEE Main, JEE
  // Advanced, NEET) and each must see only its own exam's rows.
  const paperQuery = {
    pattern: null,
    eq() { return this; },
    ilike(column, value) { this.pattern = value; return this; },
    limit: async function () {
      const data = typeof papers === "function" ? papers(this.pattern) : papers;
      return { data, error: paperError };
    },
  };
  // playlists is now read with an embedded lesson query — .order()/.limit()
  // scoped to the referenced table, then .order("id") — so the builder can ask
  // for the newest playlist_videos row per course in one request. The fake
  // records those options so a test can assert the shape, and stays awaitable
  // at every step because .order() is both chainable and thenable in
  // postgrest-js.
  const playlistQuery = {
    options: [],
    order(column, options) { this.options.push([column, options]); return this; },
    limit(count, options) { this.options.push(["limit", count, options]); return this; },
    then(resolve, reject) {
      return Promise.resolve({ data: courses, error: courseError }).then(resolve, reject);
    },
  };
  return () => ({
    from: (table) => ({
      select: () => table === "study_materials"
        ? paperQuery
        : table === "playlists"
          ? playlistQuery
          : {
              order: async () => ({ data: boards, error: boardError }),
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

  // A Dropper chapter page is a twin of its class page (171 of 177 identical
  // in production), so the sitemap offers each chapter once, under its class.
  // Explore's Dropper step pages are its own navigation and are still listed.
  it("lists a chapter under its class but never under Dropper", async () => {
    const out = temporarySitemap();
    await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [], faculty: [],
        goals: [{ slug: "jee", course_count: 10 }],
        boards: [],
        curriculum: ({ p_class, p_subject }) => {
          if (p_subject === "physics") return [{ slug: "kinematics", course_count: 13 }];
          if (p_class === "class-11" || p_class === "dropper") {
            return [{ slug: "physics", course_count: 20 }];
          }
          return [];
        },
      }),
    });

    const xml = readFileSync(out, "utf8");
    const chapter = (cls) =>
      `<loc>https://www.jeeneetard.com/browse?goal=jee&amp;class=${cls}&amp;subject=physics&amp;chapter=kinematics</loc>`;
    expect(xml).toContain(chapter("11"));
    expect(xml).not.toContain(chapter("dropper"));
    // Only the chapter results URL is withheld; the Dropper journey itself stays.
    expect(xml).toContain("<loc>https://www.jeeneetard.com/explore/jee/dropper/physics</loc>");
  });

  it("includes canonical course, faculty and populated Explore URLs", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{
          id: 5,
          title: "Rectilinear Motion (Kinematics)",
          created_at: "2026-07-20T10:00:00Z",
          lessons: [{ created_at: "2026-08-14T09:00:00Z" }],
        }],
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
    // The course URL carries the title as keywords, and the lastmod is the
    // later of "added" and "newest lesson added" — not the creation date that
    // used to claim nothing had changed since the course first appeared.
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/course/5/rectilinear-motion-kinematics</loc>",
    );
    expect(xml).toContain("<lastmod>2026-08-14</lastmod>");
    expect(xml).not.toContain("<lastmod>2026-07-20</lastmod>");
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
  it("advertises one page per exam year that has papers, per landing", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5 }],
        goals: [],
        papers: (pattern) => {
          if (pattern === "JEE Main%") {
            return [
              { exam_year: 2024 },
              { exam_year: 2024 },
              { exam_year: 2022 },
              { exam_year: null },
            ];
          }
          if (pattern === "JEE Advanced%") return [{ exam_year: 2013 }];
          if (pattern === "NEET%") return [{ exam_year: 2024 }, { exam_year: 2026 }];
          return [];
        },
      }),
    });

    const xml = readFileSync(out, "utf8");
    expect(result.paperYears).toBe(5);
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2024</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2022</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-advanced/previous-year-papers/2013</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/neet/previous-year-papers/2026</loc>",
    );
    expect(xml).not.toContain("previous-year-papers/2023");
    // Each landing lists only ITS years: JEE Main's 2022 must not leak into
    // the NEET tree, and Advanced's 2013 must not appear under JEE Main.
    expect(xml).not.toContain("/materials/neet/previous-year-papers/2022");
    expect(xml).not.toContain("/materials/jee-main/previous-year-papers/2013");
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

  // ------------------------------------------------------------------
  // Freshness. The sitemap used to say created_at, so a course whose lesson
  // list had grown since the day it was added told crawlers it had not
  // changed — wrong for exactly the pages that HAD changed.
  // ------------------------------------------------------------------
  it("dates a course by its newest lesson, not by the day it was added", async () => {
    const out = temporarySitemap();
    const capture = clientWith({
      courses: [
        {
          id: 5,
          title: "Kinematics",
          created_at: "2026-03-14T10:00:00Z",
          lessons: [{ created_at: "2026-08-30T06:00:00Z" }],
        },
        // No lesson yet: the course's own date is all there is, and that is
        // the honest answer rather than a stand-in for today.
        { id: 6, title: "Laws of Motion", created_at: "2026-04-01T10:00:00Z", lessons: [] },
        // No usable timestamp at all: emit the URL with no <lastmod> instead
        // of inventing one.
        { id: 7, title: "Work Energy Power" },
      ],
      goals: [],
    });
    await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: capture,
    });

    const xml = readFileSync(out, "utf8");
    const entry = (path) =>
      xml.slice(xml.indexOf(`<loc>https://www.jeeneetard.com${path}</loc>`));
    expect(entry("/course/5/kinematics")).toContain("<lastmod>2026-08-30</lastmod>");
    expect(entry("/course/6/laws-of-motion")).toContain("<lastmod>2026-04-01</lastmod>");
    expect(entry("/course/7/work-energy-power").split("</url>")[0])
      .not.toContain("<lastmod>");
  });

  it("asks the catalogue for one newest lesson per course, not every lesson", async () => {
    const out = temporarySitemap();
    const factory = clientWith({ courses: [{ id: 5, title: "Kinematics" }], goals: [] });
    const client = factory();
    await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: () => client,
    });

    // A per-course lesson query would be one request per course; this is one
    // request with an embedded newest-first limit of 1.
    const options = client.from("playlists").select().options;
    expect(options).toContainEqual([
      "created_at",
      { referencedTable: "lessons", ascending: false },
    ]);
    expect(options).toContainEqual(["limit", 1, { referencedTable: "lessons" }]);
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
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/jee-advanced/previous-year-papers</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.jeeneetard.com/materials/neet/previous-year-papers</loc>",
    );
    expect(xml).toContain("<loc>https://www.jeeneetard.com/forum</loc>");
    expect(xml).not.toContain("/course/");
  });
});
