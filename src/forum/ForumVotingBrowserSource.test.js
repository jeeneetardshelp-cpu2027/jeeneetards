import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = readFileSync("src/forum/ForumVotingBrowserFixture.jsx", "utf8");
const verifier = readFileSync("src/scripts/verifyForumVotingBrowser.js", "utf8");

describe("forum voting browser verifier source", () => {
  it("uses fixture auth and vote data without live Supabase credentials", () => {
    expect(fixture).toContain("castVote");
    expect(fixture).toContain("authState={authState}");
    expect(verifier).not.toContain("SUPABASE");
  });

  it("checks identity gates, pressed shape, mobile targets, overflow and both themes", () => {
    expect(verifier).toContain("width: 360");
    expect(verifier).toContain("Sign in to vote on discussions");
    expect(verifier).toContain("Choose your public forum username");
    expect(verifier).toContain('getAttribute("fill")');
    expect(verifier).toContain("undersized_targets");
    expect(verifier).toContain("page_scroll_width");
    expect(verifier).toContain("contrast_ratio");
    expect(verifier).toContain('lecture-library-theme", "light"');
    expect(verifier).toContain('lecture-library-theme", "dark"');
  });
});
