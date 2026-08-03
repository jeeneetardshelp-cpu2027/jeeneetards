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

function clientWith({ courses = [], faculty = [], courseError = null, facultyError = null }) {
  return () => ({
    from: () => ({
      select: () => ({
        order: async () => ({ data: courses, error: courseError }),
      }),
    }),
    rpc: async () => ({ data: faculty, error: facultyError }),
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("sitemap generation", () => {
  it("includes canonical public course and faculty URLs without duplicate faculty", async () => {
    const out = temporarySitemap();
    const result = await buildSitemap({
      env: { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" },
      out,
      clientFactory: clientWith({
        courses: [{ id: 5, created_at: "2026-07-20T10:00:00Z" }],
        faculty: [{ slug: "mohit-tyagi" }, { slug: "amit-bijarnia" }, { slug: "mohit-tyagi" }],
      }),
    });

    const xml = readFileSync(out, "utf8");
    expect(result).toEqual({ outcome: "written", courses: 1, faculty: 2 });
    expect(xml).toContain("<loc>https://www.jeeneetard.com/course/5</loc>");
    expect(xml).toContain("<lastmod>2026-07-20</lastmod>");
    expect(xml).toContain("<loc>https://www.jeeneetard.com/faculty/amit-bijarnia</loc>");
    expect(xml.match(/faculty\/mohit-tyagi/g)).toHaveLength(1);
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
        facultyError: { message: "temporary timeout" },
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
    expect(xml).not.toContain("/course/");
  });
});
