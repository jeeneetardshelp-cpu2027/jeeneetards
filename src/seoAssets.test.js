import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("production metadata assets", () => {
  it("ships a truthful browse-only HTML fallback", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    expect(html).toContain(
      "Browse free educational YouTube courses by exam, class, subject and chapter.",
    );
    expect(html.toLowerCase()).not.toContain("find and compare");
    expect(html).toContain('rel="icon"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
  });

  it("ships a crawler policy that protects administration", () => {
    const robots = readFileSync(resolve(root, "public/robots.txt"), "utf8");
    expect(robots).toMatch(/User-agent:\s*\*/i);
    expect(robots).toMatch(/Disallow:\s*\/admin/i);
  });

  it("ships a correctly sized social preview image", () => {
    const png = readFileSync(resolve(root, "public/social-preview.png"));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
