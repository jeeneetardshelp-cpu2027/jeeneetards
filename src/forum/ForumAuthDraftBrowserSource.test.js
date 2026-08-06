import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = readFileSync("src/forum/ForumAuthDraftBrowserFixture.jsx", "utf8");
const verifier = readFileSync("src/scripts/verifyForumAuthDraftBrowser.js", "utf8");

describe("forum auth and draft browser verifier source", () => {
  it("uses fixture auth and API data rather than a live account or database", () => {
    expect(fixture).toContain("authState={authState}");
    expect(fixture).toContain("getMyIdentity: async");
    expect(fixture).toContain("createPost: async () => 42");
    expect(verifier).not.toContain("SUPABASE");
  });

  it("checks real reload persistence, both themes, mobile targets and overflow", () => {
    expect(verifier).toContain("width: 360");
    expect(verifier).toContain("page.reload");
    expect(verifier).toContain('lecture-library-theme", "light"');
    expect(verifier).toContain("undersized_targets");
    expect(verifier).toContain("page_scroll_width");
    expect(verifier).toContain("reveal_nodes");
  });
});
