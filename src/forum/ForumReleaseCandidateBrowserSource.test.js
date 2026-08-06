import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELEASE_FEATURES } from "../releaseCapabilities.js";

const fixture = readFileSync("src/forum/ForumReleaseCandidateBrowserFixture.jsx", "utf8");
const verifier = readFileSync("src/scripts/verifyForumReleaseCandidateBrowser.js", "utf8");

describe("forum release-candidate browser gate source", () => {
  it("keeps the public flag off while covering both themes and all four surfaces", () => {
    expect(RELEASE_FEATURES.forum).toBe(false);
    expect(verifier).toContain('const screenNames = ["feed", "thread", "submit", "admin"]');
    expect(verifier).toContain('await visit(screen, "light")');
    expect(verifier).toContain('await visit(screen, "dark")');
    expect(verifier).toContain("RC verifier refuses to run after the forum release flag is enabled");
  });

  it("checks keyboard flow, screen-reader snapshots, XSS, formulas, and dismissal", () => {
    expect(verifier).toContain("ariaSnapshot");
    expect(verifier).toContain("tabTo");
    expect(verifier).toContain("outline_width");
    expect(verifier).toContain("Self-harm or suicide concern");
    expect(verifier).toContain("Dismiss report without changing content");
    expect(verifier).toContain("hostile Markdown remains visible text and never executes");
    expect(verifier).toContain("long formulas scroll inside their own block");
    expect(fixture).not.toContain("forum_admin_dismiss_report");
    expect(fixture).toContain("dismissReport");
    expect(fixture).toContain("<script>window.__forumRcXss = true</script>");
  });
});
