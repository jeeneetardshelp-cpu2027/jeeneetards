import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("legal release truth", () => {
  it("keeps every owner-only legal fact in one explicit input checklist", () => {
    const inputs = read("docs/legal_release_inputs.md");
    for (const label of [
      "Legal entity or individual operator name",
      "Contact email",
      "Postal address and jurisdiction",
      "Hosting provider",
      "Effective date",
    ]) {
      expect(inputs).toContain(label);
    }
  });

  it("describes every personal-data path implemented by the frontend", () => {
    const privacy = read("src/PrivacyPolicy.jsx");
    for (const fact of [
      "Supabase Auth",
      "email address and Supabase user identifier",
      "overall, clarity, and question ratings",
      "free-text review",
      "report reason, optional free-text note, and reporter account identifier",
      "ll_progress_v1",
      "returnTo:",
      "scroll:",
      "YouTube",
      "Vercel and Supabase",
      "request and security logs",
      "aggregate, cookieless page-view analytics",
      "Vercel Speed Insights",
      // Server-side watch history (video_progress). Added 31 July 2026 — the
      // policy previously said browser progress was "not attached to a
      // Supabase account", which the sync made false.
      "video_progress",
      "ll_player_prefs_v1",
    ]) {
      expect(privacy).toContain(fact);
    }
  });

  // The allow-list above can only catch a fact someone REMEMBERED to add. It
  // passed unchanged straight through the server-side watch-progress launch and
  // certified a policy containing two statements that were false in production.
  // These derive the fact from the CODE, so shipping the data path without the
  // disclosure fails the build. That is the property the allow-list lacks.
  describe("policy claims are derived from what the code actually does", () => {
    const privacy = () => read("src/PrivacyPolicy.jsx");

    it("discloses server-side watch progress whenever the sync is wired up", () => {
      const syncIsLive = read("src/CourseVideoPage.jsx").includes("queueProgressSync");
      if (!syncIsLive) return;
      expect(privacy()).toContain("video_progress");
      // The exact sentence that was false for days.
      expect(privacy()).not.toContain("not attached to a Supabase account");
      // Server-side data survives "clear site data" — students must be told.
      expect(privacy()).toMatch(/clearing site data does not delete it/i);
    });

    it("never describes a live feature as hidden behind a release control", async () => {
      const { RELEASE_FEATURES } = await import("./releaseCapabilities.js");
      if (!Object.values(RELEASE_FEATURES).some(Boolean)) return;
      for (const stale of [
        "hidden behind release controls",
        "when that capability is enabled",
        "may be enabled only through an explicit release decision",
      ]) {
        expect(privacy().toLowerCase()).not.toContain(stale.toLowerCase());
        expect(read("src/LegalPage.jsx").toLowerCase()).not.toContain(stale.toLowerCase());
      }
    });

    it("warns that reviews are public whenever review display is on", async () => {
      const { RELEASE_FEATURES } = await import("./releaseCapabilities.js");
      if (!RELEASE_FEATURES.reviewDisplay) return;
      expect(privacy()).toMatch(/published publicly/i);
    });

    it("does not claim that the forum is available while its release flag is off", async () => {
      const { RELEASE_FEATURES } = await import("./releaseCapabilities.js");
      if (RELEASE_FEATURES.forum) return;
      expect(privacy()).toMatch(/forum is not publicly available in this release/i);
      expect(privacy()).not.toMatch(/forum contributions,\s+and content reporting are enabled/i);
    });

    it("keeps both legal pages on the same effective date", () => {
      const dateOf = (src) => src.match(/Effective date:\s*([0-9]{1,2} \w+ [0-9]{4})/)?.[1];
      const privacyDate = dateOf(privacy());
      const termsDate = dateOf(read("src/LegalPage.jsx"));
      expect(privacyDate).toBeTruthy();
      expect(privacyDate).toBe(termsDate);
    });
  });
});
