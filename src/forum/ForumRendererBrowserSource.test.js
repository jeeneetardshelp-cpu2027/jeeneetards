import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = readFileSync("src/forum/ForumRendererBrowserFixture.jsx", "utf8");
const verifier = readFileSync("src/scripts/verifyForumRendererBrowser.js", "utf8");

describe("forum renderer real-browser security gate", () => {
  it("exercises both required stored-XSS strings and 360px overflow", () => {
    expect(fixture).toContain("<script>alert(1)</script>");
    expect(fixture).toContain('<img src=x onerror="alert(2)">');
    expect(verifier).toContain('width: 360');
    expect(verifier).toContain("raw HTML creates no executable nodes");
    expect(verifier).toContain("page-level horizontal overflow");
  });
});
