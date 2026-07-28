import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = JSON.parse(
  readFileSync("docs/neet-content-readiness-registry-2026-07-28.json", "utf8"),
);

describe("NEET content readiness registry", () => {
  it("has unique sources and records every completed import", () => {
    const ids = registry.candidates.map((candidate) => candidate.youtube_playlist_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.status).toBe("all_17_imported");
    expect(registry.candidates).toHaveLength(17);
    expect(registry.candidates.reduce((sum, candidate) => sum + candidate.videos, 0))
      .toBe(185);
    expect(registry.expected_totals).toEqual({
      courses: 17,
      videos: 185,
      memberships: 185,
      chapters: 0,
    });
    const imported = registry.candidates.filter((candidate) =>
      candidate.status === "imported",
    );
    const pending = registry.candidates.filter((candidate) =>
      candidate.status !== "imported",
    );
    expect(imported).toHaveLength(17);
    expect(imported.reduce((sum, candidate) => sum + candidate.videos, 0)).toBe(185);
    expect(imported.map((candidate) => candidate.production_course_id))
      .toEqual([108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 105, 106, 107, 120, 121]);
    expect(imported.every((candidate) =>
      candidate.actual_delta.courses === 1
      && candidate.actual_delta.videos === candidate.videos
      && candidate.actual_delta.memberships === candidate.videos
      && candidate.actual_delta.chapters === 0,
    )).toBe(true);
    expect(pending).toHaveLength(0);
  });

  it("binds every mapped candidate to its exact checked-in manifest", () => {
    for (const candidate of registry.candidates) {
      if (candidate.import_mode === "single-existing-chapter") {
        expect(candidate.manifest).toBeUndefined();
        expect(candidate.chapter).toBeTruthy();
        continue;
      }

      expect(candidate.import_mode).toBe("mapped-v12");
      const manifest = JSON.parse(readFileSync(candidate.manifest, "utf8"));
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.assignments).toHaveLength(candidate.videos);
      expect(new Set(manifest.assignments.map((item) => item.youtube_video_id)).size)
        .toBe(candidate.videos);
      expect(new Set(manifest.assignments.map((item) => item.position)).size)
        .toBe(candidate.videos);
    }
  });

  it("keeps the special editorial approvals explicit", () => {
    const mission = registry.candidates.filter((candidate) =>
      candidate.manifest?.includes("neet-mission-30-"),
    );
    expect(mission).toHaveLength(5);
    expect(mission.every((candidate) =>
      candidate.approval_note === "accept-primary-chapter-only",
    )).toBe(true);

    const vardaan = registry.candidates.filter((candidate) =>
      candidate.group === "vardaan-multi-teacher",
    );
    expect(vardaan).toHaveLength(2);
    expect(vardaan.every((candidate) =>
      candidate.approval_note === "preserve-combined-faculty-label",
    )).toBe(true);
  });
});
