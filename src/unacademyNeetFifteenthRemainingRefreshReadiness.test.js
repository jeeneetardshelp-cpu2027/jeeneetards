import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-fifteenth-remaining-refresh-readiness-2026-08-06.md",
  "utf8",
);
const refreshSource = readFileSync(
  "docs/reviews/unacademy-neet-fifteenth-remaining-refresh-2026-08-06.json",
  "utf8",
);
const refresh = JSON.parse(refreshSource);
const original = JSON.parse(readFileSync(
  "docs/reviews/unacademy-neet-fifteenth-candidate-batch-2026-08-06.json",
  "utf8",
));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

describe("Unacademy NEET fifteenth-batch remainder refresh", () => {
  it("keeps the continuation review-only with a new explicit decision", () => {
    expect(refresh).toMatchObject({
      review_status: "owner_approval_required",
      proposed_decision_id: "1412ca96-56dc-47ef-8bc0-18ce97f7dfb6",
      parent_decision_id: "5b4b1d41-b7dc-4f12-80cf-b490e72edd96",
      parent_execution_commit: "5c0254bb58090b00c81a847812d7c792c905c5f4",
    });
    expect(readiness).toContain("no production write");
    expect(readiness).toContain("No `release`\npush is authorized");
  });

  it("pins the exact post-course-423 catalogue and both JEE boundaries", () => {
    expect(refresh.preflight).toEqual(expect.objectContaining({
      playlists: 404,
      videos: 4666,
      memberships: 4672,
      chapters: 263,
      remaining_source_collision_count: 0,
      remaining_retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    }));
  });

  it("limits the source mutation to playlist-title whitespace", () => {
    expect(refresh.source_mutation_review).toEqual({
      classification: "playlist_title_whitespace_only",
      video_ids_changed: false,
      source_positions_changed: false,
      video_titles_changed: false,
      durations_changed: false,
      embedding_status_changed: false,
      exclusions_changed: false,
    });
    for (const candidate of refresh.candidates) {
      expect(candidate.source_title).toBe(candidate.previous_source_title.replace(" - Playlist", " -  Playlist"));
    }
  });

  it("recomputes both refreshed hashes from unchanged reviewed rows", () => {
    for (const candidate of refresh.candidates) {
      const source = original.candidates.find(
        (entry) => entry.youtube_playlist_id === candidate.youtube_playlist_id,
      );
      expect(source).toBeTruthy();
      expect(candidate.source_snapshot_sha256).toBe(sha256(JSON.stringify({
        youtube_playlist_id: source.youtube_playlist_id,
        source_title: candidate.source_title,
        videos: source.videos,
        exclusions: source.exclusions,
      })));
      expect(candidate.retained_video_ids)
        .toEqual(source.videos.map((video) => video.youtube_video_id));
      expect(candidate.excluded_video_ids)
        .toEqual(source.exclusions.map((video) => video.youtube_video_id));
    }
  });

  it("pins the continuation artifact and unchanged manifest hashes", () => {
    expect(sha256(refreshSource))
      .toBe("5b2b668ee827ab0fc4d36fcbaef1de5398e0554f51b5152fcf9ec3a98e51ddc0");
    for (const candidate of refresh.candidates) {
      expect(sha256(readFileSync(candidate.manifest, "utf8")))
        .toBe(candidate.manifest_sha256);
      expect(readiness).toContain(candidate.manifest_sha256);
      expect(readiness).toContain(candidate.source_snapshot_sha256);
    }
  });
});
