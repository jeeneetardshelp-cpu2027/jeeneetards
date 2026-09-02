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
      // Server-side study days (study_days). Added 31 August 2026 alongside
      // the streak sync — the dates behind the streak now reach the server
      // for signed-in students, and the policy must say so by name.
      "study_days",
      // Zero-result search text (search_gap_log). Added 2 September 2026.
      // Unlike every other server-side path here it carries no identity and is
      // kept for signed-out visitors too, which makes it the one record a
      // student cannot ask us to delete. The policy has to say both parts.
      "search_gap_log",
      "ll_player_prefs_v1",
      "ll_notes_v1",
      "ll_streak_v1",
      "ll_revision_v1",
      "ll_exam_lane_v1",
      "ll_goal_met_v1",
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

    it("discloses server-side study days whenever the streak sync is wired up", () => {
      // Same property as the video_progress check above: if recordStudyDay
      // pushes days to the server, shipping without the disclosure fails.
      const syncIsLive = read("src/streak.js").includes("queueStudyDaySync");
      if (!syncIsLive) return;
      expect(privacy()).toContain("study_days");
      // The dates leave the browser only for signed-in students, and the
      // policy must say exactly that rather than implying always-on sync.
      expect(privacy()).toMatch(/syncs only for signed-in students/i);
    });

    it("discloses the goal-moment date whenever the watch page persists it", () => {
      // ll_goal_met_v1 remembers the date the daily-goal line was last shown.
      // Derived from the code that writes the key, like the checks around it.
      const writesMoment = read("src/CourseVideoPage.jsx").includes("markGoalMetShown");
      if (!writesMoment) return;
      expect(privacy()).toContain("ll_goal_met_v1");
    });

    it("discloses the remembered exam lane whenever the homepage persists it", () => {
      // ll_exam_lane_v1 remembers which exam a student chose. Same reasoning
      // as the revision check: derive the disclosure from the code that
      // writes the key, so shipping the store without the policy line fails.
      const writesLane = read("src/examLane.js").includes("ll_exam_lane_v1");
      if (!writesLane) return;
      expect(privacy()).toContain("ll_exam_lane_v1");
    });

    it("discloses the revision queue whenever a chapter clear is recorded", () => {
      // ll_revision_v1 names the chapters a student has finished. The
      // allow-list above only catches a fact someone remembered to add; this
      // derives it from the code, so wiring the write without the disclosure
      // fails the build.
      const writesRevision = read("src/ChapterCleared.jsx").includes("recordChapterCleared");
      if (!writesRevision) return;
      expect(privacy()).toContain("ll_revision_v1");
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

    it("describes forum availability consistently with its release flag", async () => {
      const { RELEASE_FEATURES } = await import("./releaseCapabilities.js");
      if (RELEASE_FEATURES.forum) {
        expect(privacy()).toMatch(/forum is operating as a limited closed beta/i);
        expect(privacy()).toMatch(/beta invitation/i);
        expect(privacy()).toMatch(/forum posts, answers, and public usernames are visible/i);
        return;
      }
      expect(privacy()).toMatch(/forum is not publicly available in this release/i);
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
