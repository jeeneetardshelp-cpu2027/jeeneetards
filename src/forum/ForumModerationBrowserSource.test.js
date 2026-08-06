import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = readFileSync("src/forum/ForumModerationBrowserFixture.jsx", "utf8");
const verifier = readFileSync("src/scripts/verifyForumModerationBrowser.js", "utf8");

describe("forum moderation browser verifier source", () => {
  it("covers distinct self-harm, generic reporting and actionable admin context", () => {
    expect(fixture).toContain("submittedReportReason");
    expect(fixture).toContain("ForumReportsPanel");
    expect(verifier).toContain("Self-harm or suicide concern");
    expect(verifier).toContain("Sent for urgent human review");
    expect(verifier).toContain("Report received");
    expect(verifier).toContain("Urgent human review");
    expect(verifier).toContain("page_scroll_width");
    expect(verifier).toContain("undersized_targets");
  });
});
