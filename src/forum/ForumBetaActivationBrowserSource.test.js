import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = readFileSync("src/forum/ForumBetaActivationBrowserFixture.jsx", "utf8");
const starter = readFileSync("src/scripts/startForumBetaActivationPreview.js", "utf8");
const evidence = JSON.parse(readFileSync(
  "docs/forum/FORUM_BETA_ACTIVATION_BROWSER_EVIDENCE_2026-08-08.json",
  "utf8",
));

describe("forum beta activation browser fixture", () => {
  it("stays local, credential-free and covers admin, member and outsider states", () => {
    expect(fixture).toContain('!screen.startsWith("outsider")');
    expect(fixture).toContain('screen === "outsider-submit"');
    expect(fixture).toContain("ForumBetaAdminPanel");
    expect(fixture).toContain("getBetaMembership");
    expect(fixture).not.toMatch(/service[_-]?role|supabaseClient|VITE_SUPABASE/i);
    expect(starter).toContain('host: "127.0.0.1"');
    expect(starter).toContain("strictPort: true");
    expect(starter).toContain('width:360px;height:800px');
    expect(evidence.summary).toEqual({ passed: 11, failed: 0 });
    expect(JSON.stringify(evidence)).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}|@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
