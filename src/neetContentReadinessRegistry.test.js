import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = JSON.parse(
  readFileSync("docs/neet-content-readiness-registry-2026-07-28.json", "utf8"),
);

describe("NEET content readiness registry", () => {
  it("has unique sources and the reviewed aggregate delta", () => {
    const ids = registry.candidates.map((candidate) => candidate.youtube_playlist_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.status).toBe("readiness_only_no_write_authorization");
    expect(registry.candidates).toHaveLength(15);
    expect(registry.candidates.reduce((sum, candidate) => sum + candidate.videos, 0))
      .toBe(160);
    expect(registry.expected_totals).toEqual({
      courses: 15,
      videos: 160,
      memberships: 160,
      chapters: 0,
    });
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
    expect(mission).toHaveLength(4);
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
