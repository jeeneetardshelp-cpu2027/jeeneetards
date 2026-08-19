import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifestPaths = [
  "docs/manifests/unacademy-neet-rotational-motion-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-current-electricity-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-electrochemistry-class-12-reviewed.json",
];
const manifests = manifestPaths.map((path) => JSON.parse(readFileSync(path, "utf8")));

describe("Unacademy NEET second-batch reviewed manifests", () => {
  it("pins the approved playlists, teachers, and evidence decision", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhM1W_NWZnLgqMDysIuHrMXu",
      "PLsgHooHkqhhNmUjrOF64b49WSKp93PsKZ",
      "PLsgHooHkqhhPx8PUmYV2q6n6IbpGnCDlg",
    ]);
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher)).toEqual([
      "Mahendra Singh", "Anu Gupta", "Anoop Vashishtha",
    ]);
    expect(new Set(manifests.map((manifest) => (
      manifest.teacher_evidence.decision_id
    )))).toEqual(new Set(["4555712a-b4ea-446c-8f57-04d2257562f9"]));
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("maps the reviewed lecture-only counts and contiguous lesson order", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([14, 11, 9]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([9, 8, 7]);
    manifests.forEach((manifest) => {
      expect(manifest.assignments.map((row) => row.lesson_number)).toEqual(
        Array.from({ length: manifest.assignments.length }, (_, index) => index + 1),
      );
      expect(new Set(manifest.assignments.map((row) => row.chapter)).size).toBe(1);
      expect(manifest.teacher_evidence.youtube_video_ids).toEqual(
        manifest.assignments.map((row) => row.youtube_video_id),
      );
    });
  });

  it("covers every reviewed source position once and excludes practice modes", () => {
    manifests.forEach((manifest) => {
      const rows = [...manifest.assignments, ...manifest.exclusions];
      expect(new Set(rows.map((row) => row.position)).size).toBe(rows.length);
      expect(new Set(rows.map((row) => row.youtube_video_id)).size).toBe(rows.length);
      expect(manifest.exclusions.every((row) => row.reason.trim().length > 0)).toBe(true);
    });
    expect(manifests[0].exclusions.find((row) => row.position === 11).reason).toContain("PYQ");
    expect(manifests[1].exclusions.filter((row) => row.reason.includes("DPP"))).toHaveLength(8);
    expect(manifests[2].exclusions.filter((row) => row.reason.includes("quiz"))).toHaveLength(7);
  });
});
