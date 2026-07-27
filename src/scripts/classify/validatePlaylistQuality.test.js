import { describe, expect, it } from "vitest";
import {
  findDuplicateLessonNumbers,
  findOrderInversions,
  findOverlap,
  hasTeacherEvidence,
  lessonNumber,
  mappedImportBlockingFindings,
  validatePlaylistQuality,
} from "./validatePlaylistQuality.js";

// Build a playlist of videos with sequential positions from source titles.
const pl = (titles, extra = {}) => ({
  title: "CHEMISTRY-SAMPLE",
  videos: titles.map((title, i) => ({ videoId: `v${i}`, title, position: i })),
  ...extra,
});

describe("lessonNumber", () => {
  it("parses the real '#N' convention", () => {
    expect(lessonNumber("CHEMISTRY-PERIODIC TABLE #7")).toBe(7);
  });
  it("parses leading numbers and 'Lecture N'", () => {
    expect(lessonNumber("07. Mole Concept")).toBe(7);
    expect(lessonNumber("8 Example of evaluation of integral (Part 2)")).toBe(8);
    expect(lessonNumber("Lecture 12 | Kinematics")).toBe(12);
  });
  it("returns null when there is no number", () => {
    expect(lessonNumber("Introduction to Solutions")).toBeNull();
  });
});

describe("findDuplicateLessonNumbers (Codex blocked Ray Optics: 'duplicates lesson 36')", () => {
  it("flags a repeated lesson number", () => {
    expect(findDuplicateLessonNumbers(pl(["#35 A", "#36 B", "#36 C", "#37 D"]).videos)).toEqual([36]);
  });
  it("clean sequence has none", () => {
    expect(findDuplicateLessonNumbers(pl(["#1 A", "#2 B", "#3 C"]).videos)).toEqual([]);
  });
  it("keeps plain-space leading numbers authoritative over internal part labels", () => {
    const videos = pl([
      "5 Integration of standard function (Part 2)",
      "8 Example of evaluation of integral (Part 2)",
      "40 Standard Algebraic Integral Formula Integration (Part 2)",
    ]).videos;
    expect(findDuplicateLessonNumbers(videos)).toEqual([]);
  });
});

describe("findOrderInversions (Codex: 'first two reversed', 'lessons 6,7,8 out of order')", () => {
  it("detects a reversed opening pair", () => {
    const { assessable, inversions } = findOrderInversions(pl(["#2 B", "#1 A", "#3 C"]).videos);
    expect(assessable).toBe(true);
    expect(inversions).toHaveLength(1);
    expect(inversions[0].number).toBe(1);
  });
  it("a correctly ordered playlist has no inversions", () => {
    expect(findOrderInversions(pl(["#1 A", "#2 B", "#3 C"]).videos).inversions).toEqual([]);
  });
  it("is not assessable when most titles lack numbers", () => {
    expect(findOrderInversions(pl(["Intro", "Basics", "#3 C"]).videos).assessable).toBe(false);
  });
});

describe("findOverlap (Codex: 'includes an existing Wave Optics video')", () => {
  it("flags videos already in the catalogue", () => {
    const videos = [{ videoId: "a" }, { videoId: "sk0AndvKmfE" }, { videoId: "c" }];
    expect(findOverlap(videos, new Set(["sk0AndvKmfE"]))).toEqual(["sk0AndvKmfE"]);
  });
});

describe("mappedImportBlockingFindings", () => {
  it("resolves only overlap through the atomic chapter equality check", () => {
    const findings = [
      { code: "cross_chapter_overlap", severity: "warn" },
      { code: "no_teacher_evidence", severity: "warn" },
      { code: "duplicate_lesson_numbers", severity: "block" },
    ];
    expect(mappedImportBlockingFindings(findings).map(({ code }) => code))
      .toEqual(["no_teacher_evidence", "duplicate_lesson_numbers"]);
  });
});

describe("hasTeacherEvidence (Codex accepts once '#alksir' appears, defers otherwise)", () => {
  it("accepts the #alksir hashtag on any video", () => {
    expect(hasTeacherEvidence([{ title: "Solid State", description: "notes #alksir" }])).toBe(true);
  });
  it("accepts an 'X Sir' mention", () => {
    expect(hasTeacherEvidence([{ title: "Kinetics by ALK Sir" }])).toBe(true);
    expect(hasTeacherEvidence([{ title: "Biology with Yashika Ma'am" }])).toBe(true);
  });
  it("accepts official video-tag attribution", () => {
    expect(hasTeacherEvidence([{
      title: "Biological Classification",
      tags: ["NEET", "Tarun Sir", "Vardaan"],
    }])).toBe(true);
    expect(hasTeacherEvidence([{
      title: "Biological Classification",
      tags: ["NEET", "Biology", "Vardaan"],
    }])).toBe(false);
  });
  it("matches a known-teacher full name even without a hashtag or 'Sir'", () => {
    expect(hasTeacherEvidence([{ title: "Kinematics Full Course" }], "", ["Mohit Tyagi"])).toBe(false);
    expect(hasTeacherEvidence([{ title: "Lecture by Manish Raj" }], "", ["Manish Raj"])).toBe(true);
    expect(hasTeacherEvidence([{ title: "Lecture by Manish Raj" }])).toBe(false);
    expect(hasTeacherEvidence([{ title: "Kinematics — Mohit Tyagi Classes" }], "", ["Mohit Tyagi"])).toBe(true);
    expect(hasTeacherEvidence([{ title: "Kinematics | mohittyagi" }], "", ["Mohit Tyagi"])).toBe(true);
    // a partial first-token ("Alk") must NOT match "ALK Sir" — that would mis-attribute.
    expect(hasTeacherEvidence([{ title: "Periodic Table with Alk" }], "", ["ALK Sir"])).toBe(false);
    expect(hasTeacherEvidence([{ title: "Random Walks Irregular Motion" }], "", ["ALK Sir"])).toBe(false);
  });
  it("rejects publisher marketing links as faculty evidence", () => {
    const description = [
      "Commerce Wallah by PW https://www.youtube.com/@CommerceWallah",
      "CA Wallah by PW https://www.youtube.com/@CAWallahbyPW",
      "JEE Challengers by PW https://www.youtube.com/@JEEChallengers",
    ].join("\n");
    expect(hasTeacherEvidence([{ title: "The Living World", description }])).toBe(false);
  });
  it("defers when no evidence at all", () => {
    expect(hasTeacherEvidence([{ title: "General Inorganic Chemistry" }])).toBe(false);
  });
});

describe("validatePlaylistQuality — overall status", () => {
  it("a clean, attributed, in-order playlist passes", () => {
    const report = validatePlaylistQuality({
      playlist: pl(["#1 A #alksir", "#2 B", "#3 C"]),
      expectedVideoCount: 3,
    });
    expect(report.status).toBe("ok");
    expect(report.findings).toEqual([]);
  });

  it("duplicate video IDs BLOCK the whole playlist", () => {
    const playlist = {
      title: "X",
      videos: [
        { videoId: "dup", title: "#1 A #alksir", position: 0 },
        { videoId: "dup", title: "#2 B", position: 1 },
      ],
    };
    const report = validatePlaylistQuality({ playlist });
    expect(report.status).toBe("blocked");
    expect(report.blockers.map((b) => b.code)).toContain("duplicate_video_ids");
  });

  it("out-of-order + no teacher evidence downgrades to review, not block", () => {
    const report = validatePlaylistQuality({ playlist: pl(["#2 B", "#1 A", "#3 C"]) });
    expect(report.status).toBe("review");
    const codes = report.warnings.map((w) => w.code);
    expect(codes).toContain("lesson_order_inversions");
    expect(codes).toContain("no_teacher_evidence");
  });

  it("flags a usable-count shortfall from deleted/private videos", () => {
    const report = validatePlaylistQuality({
      playlist: pl(["#1 A #alksir", "#2 B"]),
      expectedVideoCount: 5,
    });
    expect(report.status).toBe("review");
    expect(report.warnings.map((w) => w.code)).toContain("usable_count_shortfall");
  });

  it("surfaces cross-chapter overlap as review", () => {
    const report = validatePlaylistQuality({
      playlist: pl(["#1 A #alksir", "#2 B"]),
      existingVideoIds: new Set(["v1"]),
    });
    expect(report.warnings.map((w) => w.code)).toContain("cross_chapter_overlap");
  });
});
