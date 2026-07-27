import { describe, expect, it } from "vitest";
import { buildJeeFingerprint } from "./verifyJeeIntegrityFingerprint.js";

describe("buildJeeFingerprint", () => {
  it("uses the historical field order and deterministic row ordering", () => {
    const playlists = [
      {
        difficulty: "intermediate",
        id: 2,
        title: "Second",
        teacher: "Teacher B",
        youtube_playlist_id: "PL2",
        category_id: 1,
        subject_id: 3,
        class_levels: ["12th"],
        audience_focus: "12th",
        content_type: "full-course",
        language: "hinglish",
        ignored: "not fingerprinted",
      },
      {
        id: 1,
        title: "First",
        teacher: "Teacher A",
        youtube_playlist_id: "PL1",
        category_id: 1,
        subject_id: 2,
        class_levels: ["11th"],
        audience_focus: "11th",
        content_type: "full-course",
        language: "hindi",
        difficulty: "beginner",
      },
    ];
    const memberships = [
      { id: 12, playlist_id: 2, video_id: 102, position: 2 },
      { video_id: 101, position: 1, playlist_id: 2, id: 11, ignored: true },
      { id: 10, playlist_id: 1, video_id: 100, position: 1 },
    ];

    expect(buildJeeFingerprint(playlists, memberships)).toBe(
      "662372675369ef53d01f50f0e5c4ac82",
    );
    expect(buildJeeFingerprint([...playlists].reverse(), [...memberships].reverse())).toBe(
      "662372675369ef53d01f50f0e5c4ac82",
    );
  });
});
