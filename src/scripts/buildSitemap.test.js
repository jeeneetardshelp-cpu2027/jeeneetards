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
  courseError = null, facultyError = null, goalError = null,
  boardError = null, curriculumError = null,
}) {
  return () => ({
    from: (table) => ({
      select: () => ({
        order: async () => table === "boards"
          ? ({ data: boards, error: boardError })
          : ({ data: courses, error: courseError }),
      }),
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
    expect(result).toEqual({ outcome: "written", courses: 1, faculty: 2, explore: 7 });
    expect(xml).toContain("<loc>https://www.jeeneetard.com/course/5</loc>");
    expect(xml).toContain("<lastmod>2026-07-20</lastmod>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/faculty/amit-bijarnia</loc>");
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
