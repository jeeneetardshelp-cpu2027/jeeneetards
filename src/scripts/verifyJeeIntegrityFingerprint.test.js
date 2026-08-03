import { describe, expect, it } from "vitest";
import {
  buildJeeFingerprint,
  EXPECTED_JEE_FINGERPRINT,
  PROTECTED_JEE_PLAYLIST_ID_MAX_EXCLUSIVE,
  selectJeePlaylistIds,
} from "./verifyJeeIntegrityFingerprint.js";

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

  it("defaults to the current protected original-83 boundary and fingerprint", () => {
    expect(PROTECTED_JEE_PLAYLIST_ID_MAX_EXCLUSIVE).toBe(167);
    expect(EXPECTED_JEE_FINGERPRINT).toBe("c742fabf93ff8dd33d6ecd5eb4793db0");
    expect(
      selectJeePlaylistIds(
        [{ playlist_id: 166 }, { playlist_id: 13 }, { playlist_id: 167 }, { playlist_id: 298 }],
        PROTECTED_JEE_PLAYLIST_ID_MAX_EXCLUSIVE,
      ),
    ).toEqual([166, 13]);
  });

  it("can retain the complete rolling JEE set for an unpinned audit", () => {
    expect(
      selectJeePlaylistIds([{ playlist_id: 13 }, { playlist_id: 167 }, { playlist_id: 298 }]),
    ).toEqual([13, 167, 298]);
  });
});
