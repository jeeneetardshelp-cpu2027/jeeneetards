import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertImportSelection,
  assertProductionWriteAllowed,
  assertExpectedRowCount,
  buildImportPayload,
  findDuplicateVideoIds,
  mappedSourceSnapshotEvidence,
  parseBulkConfirmation,
  parseImporterArgs,
  playlistFromOwner,
  promptCourseMetadata,
  validateChapterManifest,
  validateCourseAttribution,
  validateCourseMetadata,
  validateMappedVideoDetails,
  validateMappedSourcePositions,
  validateReviewedTeacherEvidence,
} from "./ingestionSafety.js";

describe("reviewed external teacher evidence", () => {
  const videos = [{ videoId: "one" }, { videoId: "two" }];
  const evidence = {
    version: 1,
    kind: "reviewed_external_source",
    decision_id: "c8cf544a-bd1f-4a2c-9a7e-d8490185a86c",
    youtube_playlist_id: "PL_source",
    teacher: "Samapti Ma'am",
    source_url: "https://t.me/s/SamaptiMamZoology?before=463",
    source_label: "Teacher-owned public channel",
    reviewed_by: "Codex",
    reviewed_on: "2026-07-28",
    youtube_video_ids: ["one", "two"],
  };

  it("accepts exact, complete, reviewed provenance", () => {
    expect(validateReviewedTeacherEvidence({
      evidence,
      playlistId: "PL_source",
      teacher: "Samapti Ma'am",
      videos,
    })).toMatchObject({
      decisionId: evidence.decision_id,
      teacher: "Samapti Ma'am",
      videoCount: 2,
      reviewedOn: "2026-07-28",
    });
  });

  it("fails closed on teacher, playlist, URL, or video drift", () => {
    const validate = (overrides = {}) => validateReviewedTeacherEvidence({
      evidence: { ...evidence, ...overrides },
      playlistId: "PL_source",
      teacher: "Samapti Ma'am",
      videos,
    });
    expect(() => validate({ teacher: "Someone Else" })).toThrow(/teacher/i);
    expect(() => validate({ youtube_playlist_id: "PL_other" })).toThrow(/playlist/i);
    expect(() => validate({ source_url: "http://example.com" })).toThrow(/HTTPS/i);
    expect(() => validate({ youtube_video_ids: ["one"] })).toThrow(/every source video/i);
    expect(() => validate({ youtube_video_ids: ["one", "one"] })).toThrow(/repeats/i);
  });
});

describe("reviewed external teacher evidence execution gate", () => {
  it("parses an exact decision confirmation separately from course mapping", () => {
    const args = parseImporterArgs([
      "UC_source",
      "--env=production",
      "--dry-run",
      "--expected-playlists=1",
      "--max-playlists=1",
      "--playlist-id=PL_source",
      "--category=NEET",
      "--goal=NEET",
      "--subject=Biology",
      "--classes=11th,12th",
      "--content-type=one-shot",
      "--language=hinglish",
      "--difficulty=intermediate",
      "--teacher=Samapti Ma'am",
      "--audience-focus=11th",
      "--chapter-manifest=docs/manifest.json",
      "--confirm-teacher-evidence=c8cf544a-bd1f-4a2c-9a7e-d8490185a86c",
    ]);
    expect(args.reviewedTeacherEvidenceDecision)
      .toBe("c8cf544a-bd1f-4a2c-9a7e-d8490185a86c");
  });

  it("keeps the write path bound to the validated decision ID", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toContain(
      "args.reviewedTeacherEvidenceDecision !== mapped.teacherEvidence.decisionId",
    );
    expect(source).toContain("--confirm-teacher-evidence=");
  });
});

describe("channel ingestion metadata", () => {
  it("wires the metadata payload builder into the importer RPC call", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    const payloadBuild = source.indexOf("importPayload = buildImportPayload({");
    const rpcCall = source.indexOf("payload: importPayload");
    expect(payloadBuild).toBeGreaterThan(-1);
    expect(rpcCall).toBeGreaterThan(payloadBuild);
  });

  it("keeps dry-run on the anonymous client and before the import RPC", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/args\.dryRun \? publicKey : serviceKey/);
    expect(source.indexOf("if (args.dryRun)"))
      .toBeLessThan(source.indexOf("db.rpc(rpc"));
  });

  it("lets ephemeral runtime credentials override ignored env files", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/return \{ \.\.\.env, \.\.\.process\.env \}/);
  });

  it("only loads board reference data for the School learning goal", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    const schoolBranch = source.indexOf('if (goalSlug === "school")');
    const boardsQuery = source.indexOf('.from("boards")');
    expect(schoolBranch).toBeGreaterThan(-1);
    expect(boardsQuery).toBeGreaterThan(schoolBranch);
  });

  it("uses a focused ownership lookup and existing production chapters", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/getPlaylistOwner\(ytKey, args\.playlistId\)/);
    expect(source).toMatch(
      /args\.environment === "production" && !existingChapter/,
    );
  });

  it("rejects duplicate YouTube video IDs before any chapter write", () => {
    expect(findDuplicateVideoIds([
      { videoId: "video-1" },
      { videoId: "video-2" },
      { videoId: "video-1" },
      { videoId: "video-1" },
    ])).toEqual(["video-1"]);

    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    const writeBranch = source.slice(source.indexOf("for (const plan of plans) {", source.indexOf("const summary =")));
    expect(writeBranch.indexOf("findDuplicateVideoIds(ytVideos)"))
      .toBeLessThan(writeBranch.indexOf("ensureChapter("));
  });

  it("requires an explicit content type, language and difficulty", async () => {
    const answers = ["invalid", "full-course", "hinglish", "advanced"];
    const ask = vi.fn(async () => answers.shift());
    const onInvalid = vi.fn();

    await expect(promptCourseMetadata(ask, onInvalid)).resolves.toEqual({
      contentType: "full-course",
      language: "hinglish",
      difficulty: "advanced",
    });
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it("puts all three metadata fields in the import_playlist payload", () => {
    const payload = buildImportPayload({
      plan: {
        categoryId: 1,
        learningGoalId: 2,
        boardIds: [],
        subjectId: 3,
        classLabels: ["11th"],
        contentType: "full-course",
        language: "hinglish",
        difficulty: "advanced",
        teacher: "ABJ Sir",
        audienceFocus: "11th",
        playlist: { id: "PL_real", title: "Real course" },
      },
      channel: { title: "Real channel" },
      channelId: "UC_real",
      chapterId: 4,
      videos: [{
        videoId: "video-1",
        title: "Lecture 1",
        durationSeconds: 600,
        captionStatus: "available",
        embeddingStatus: "allowed",
      }],
    });

    expect(payload).toMatchObject({
      content_type: "full-course",
      language: "hinglish",
      difficulty: "advanced",
      teacher: "ABJ Sir",
      audience_focus: "11th",
    });
  });

  it("builds a complete per-video chapter payload without a conflicting default", () => {
    const payload = buildImportPayload({
      plan: {
        categoryId: 1, learningGoalId: 2, boardIds: [], subjectId: 3,
        classLabels: ["12th"], contentType: "full-course", language: "hinglish",
        difficulty: "advanced", teacher: "Mohit Tyagi", audienceFocus: "12th",
        playlist: { id: "PL_real", title: "Mapped course" },
        requestId: "018f7e3b-39b0-7f3e-8ee4-7a8d4d5a6b7c",
        manifestSha256: "a".repeat(64),
        sourceSnapshotSha256: "b".repeat(64),
      },
      channel: { title: "Real channel" },
      channelId: "UC_real",
      chapterId: null,
      videos: [
        { videoId: "video-one01", title: "One", chapterId: 4 },
        { videoId: "video-two02", title: "Two", chapterId: 5 },
      ],
    });

    expect(payload.chapter_id).toBeNull();
    expect(payload.request_id).toBe("018f7e3b-39b0-7f3e-8ee4-7a8d4d5a6b7c");
    expect(payload.manifest_sha256).toBe("a".repeat(64));
    expect(payload.source_snapshot_sha256).toBe("b".repeat(64));
    expect(payload.manifest_assignment_count).toBe(2);
    expect(payload.videos.map((video) => video.chapter_id)).toEqual([4, 5]);
    expect(() => buildImportPayload({
      plan: {
        categoryId: 1, learningGoalId: 2, boardIds: [], subjectId: 3,
        classLabels: ["12th"], contentType: "full-course", language: "hinglish",
        difficulty: "advanced", teacher: "Mohit Tyagi", audienceFocus: "12th",
        playlist: { id: "PL_real", title: "Mapped course" },
        requestId: "018f7e3b-39b0-7f3e-8ee4-7a8d4d5a6b7c",
      },
      channel: { title: "Real channel" },
      channelId: "UC_real",
      chapterId: null,
      videos: [{ videoId: "video-one01", title: "One", chapterId: 4 }],
    })).toThrow(/manifest and source SHA-256 evidence/i);
    expect(() => buildImportPayload({
      plan: {
        categoryId: 1, learningGoalId: 2, boardIds: [], subjectId: 3,
        classLabels: ["12th"], contentType: "full-course", language: "hinglish",
        difficulty: "advanced", teacher: "Mohit Tyagi", audienceFocus: "12th",
        playlist: { id: "PL_real", title: "Mapped course" },
        requestId: "018f7e3b-39b0-7f3e-8ee4-7a8d4d5a6b7c",
        manifestSha256: "a".repeat(64),
        sourceSnapshotSha256: "b".repeat(64),
      },
      channel: { title: "Real channel" },
      channelId: "UC_real",
      chapterId: 4,
      videos: [{ videoId: "video-one01", title: "One", chapterId: 4 }],
    })).toThrow(/either a playlist chapterId or per-video chapterIds/i);
  });

  it("requires an exact, ordered, exhaustive chapter manifest", () => {
    const videos = [
      {
        videoId: "video-one01", title: "One", position: 0, sourcePosition: 0,
      },
      {
        videoId: "video-two02", title: "Two", position: 1, sourcePosition: 1,
      },
    ];
    const manifest = {
      version: 1,
      request_id: "018f7e3b-39b0-4f3e-8ee4-7a8d4d5a6b7c",
      youtube_playlist_id: "PL_real",
      assignments: [
        { position: 1, youtube_video_id: "video-one01", chapter: "Functions" },
        { position: 2, youtube_video_id: "video-two02", chapter: "Inverse Trigonometric Functions" },
      ],
    };
    expect(validateChapterManifest({
      manifest, playlistId: "PL_real", videos,
    })).toEqual({
      videos: [
        { ...videos[0], chapterName: "Functions" },
        { ...videos[1], chapterName: "Inverse Trigonometric Functions" },
      ],
      excludedVideos: [],
      chapterNames: ["Functions", "Inverse Trigonometric Functions"],
      requestId: "018f7e3b-39b0-4f3e-8ee4-7a8d4d5a6b7c",
    });
    expect(() => validateChapterManifest({
      manifest: { ...manifest, request_id: "not-a-uuid" },
      playlistId: "PL_real",
      videos,
    })).toThrow(/request_id.*UUID/i);
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        status: "superseded",
        superseded_by: "docs/manifests/reviewed-replacement.json",
      },
      playlistId: "PL_real",
      videos,
    })).toThrow(/superseded.*reviewed-replacement/i);
    expect(() => validateChapterManifest({
      manifest: { ...manifest, youtube_playlist_id: "PL_other" },
      playlistId: "PL_real",
      videos,
    })).toThrow(/playlist ID/i);
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        assignments: [manifest.assignments[1], manifest.assignments[0]],
      },
      playlistId: "PL_real",
      videos,
    })).toThrow(/position 1/i);
    expect(() => validateChapterManifest({
      manifest: { ...manifest, assignments: manifest.assignments.slice(0, 1) },
      playlistId: "PL_real",
      videos,
    })).toThrow(/map or exclude all 2 source videos/i);
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        assignments: manifest.assignments.map((row) => ({ ...row, chapter: "Functions" })),
      },
      playlistId: "PL_real",
      videos,
    })).toThrow(/at least two chapters/i);
  });

  it("supports reviewed exclusions while binding every source position", () => {
    const videos = [
      { videoId: "vid_a", sourcePosition: 0 },
      { videoId: "vid_live", sourcePosition: 1 },
      { videoId: "vid_b", sourcePosition: 2 },
      { videoId: "vid_marathon", sourcePosition: 3 },
    ];
    const manifest = {
      version: 1,
      request_id: "c8cf544a-bd1f-4a2c-9a7e-d8490185a86c",
      youtube_playlist_id: "PL_real",
      assignments: [
        { position: 1, youtube_video_id: "vid_a", chapter: "Chapter A" },
        { position: 3, youtube_video_id: "vid_b", chapter: "Chapter B" },
      ],
      exclusions: [
        {
          position: 2,
          youtube_video_id: "vid_live",
          reason: "Duplicate live session",
        },
        {
          position: 4,
          youtube_video_id: "vid_marathon",
          reason: "Full-syllabus marathon",
        },
      ],
    };

    const result = validateChapterManifest({
      manifest,
      playlistId: "PL_real",
      teacher: "Teacher",
      videos,
    });

    expect(result.videos.map(({ videoId }) => videoId)).toEqual(["vid_a", "vid_b"]);
    expect(result.excludedVideos).toEqual([
      expect.objectContaining({
        videoId: "vid_live",
        exclusionReason: "Duplicate live session",
      }),
      expect.objectContaining({
        videoId: "vid_marathon",
        exclusionReason: "Full-syllabus marathon",
      }),
    ]);
  });

  it("supports a reviewed natural lesson order without weakening source binding", () => {
    const videos = [
      { videoId: "lesson-two", sourcePosition: 0 },
      { videoId: "lesson-one", sourcePosition: 1 },
    ];
    const manifest = {
      version: 1,
      request_id: "018f7e3b-39b0-4f3e-8ee4-7a8d4d5a6b7c",
      youtube_playlist_id: "PL_reverse",
      assignments: [
        {
          position: 1,
          youtube_video_id: "lesson-two",
          chapter: "Statistics",
          lesson_number: 2,
        },
        {
          position: 2,
          youtube_video_id: "lesson-one",
          chapter: "Statistics",
          lesson_number: 1,
        },
      ],
    };

    const result = validateChapterManifest({
      manifest,
      playlistId: "PL_reverse",
      videos,
    });

    expect(result.videos.map(({ videoId, lessonNumber, position }) => ({
      videoId,
      lessonNumber,
      position,
    }))).toEqual([
      { videoId: "lesson-one", lessonNumber: 1, position: 0 },
      { videoId: "lesson-two", lessonNumber: 2, position: 1 },
    ]);
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        assignments: manifest.assignments.map((assignment) => ({
          ...assignment,
          lesson_number: 1,
        })),
      },
      playlistId: "PL_reverse",
      videos,
    })).toThrow(/complete sequence/i);
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        assignments: [
          { ...manifest.assignments[0], lesson_number: null },
          manifest.assignments[1],
        ],
      },
      playlistId: "PL_reverse",
      videos,
    })).toThrow(/every assignment/i);
  });

  it("fails closed when an exclusion is unreasoned or leaves a source undecided", () => {
    const videos = [
      { videoId: "vid_a", sourcePosition: 0 },
      { videoId: "vid_b", sourcePosition: 1 },
      { videoId: "vid_c", sourcePosition: 2 },
    ];
    const base = {
      version: 1,
      request_id: "c8cf544a-bd1f-4a2c-9a7e-d8490185a86c",
      youtube_playlist_id: "PL_real",
      assignments: [
        { position: 1, youtube_video_id: "vid_a", chapter: "Chapter A" },
        { position: 3, youtube_video_id: "vid_c", chapter: "Chapter B" },
      ],
    };

    expect(() => validateChapterManifest({
      manifest: {
        ...base,
        exclusions: [{ position: 2, youtube_video_id: "vid_b", reason: "" }],
      },
      playlistId: "PL_real",
      teacher: "Teacher",
      videos,
    })).toThrow(/requires a reason/i);

    expect(() => validateChapterManifest({
      manifest: { ...base, exclusions: [] },
      playlistId: "PL_real",
      teacher: "Teacher",
      videos,
    })).toThrow(/map or exclude all 3 source videos/i);
  });

  it("uses YouTube source positions and requires complete embeddable details", () => {
    const videos = [
      {
        videoId: "video-one01", title: "One", position: 0,
        sourcePosition: 0,
        durationSeconds: 600, embeddingStatus: "embeddable",
      },
      {
        videoId: "video-two02", title: "Two", position: 2,
        sourcePosition: 2,
        durationSeconds: null, embeddingStatus: "blocked",
      },
    ];
    const manifest = {
      version: 1,
      request_id: "018f7e3b-39b0-4f3e-8ee4-7a8d4d5a6b7c",
      youtube_playlist_id: "PL_real",
      assignments: [
        { position: 1, youtube_video_id: "video-one01", chapter: "Functions" },
        { position: 3, youtube_video_id: "video-two02", chapter: "ITF" },
      ],
    };
    expect(validateChapterManifest({
      manifest, playlistId: "PL_real", videos,
    }).videos.map((video) => video.chapterName)).toEqual(["Functions", "ITF"]);
    expect(validateMappedVideoDetails(videos)).toEqual({
      ok: false,
      missingDurationVideoIds: ["video-two02"],
      nonEmbeddableVideoIds: ["video-two02"],
    });
    expect(() => validateChapterManifest({
      manifest: {
        ...manifest,
        assignments: [
          manifest.assignments[0],
          { ...manifest.assignments[1], position: 2 },
        ],
      },
      playlistId: "PL_real",
      videos,
    })).toThrow(/position 3/i);
  });

  it("fails closed when mapped source positions are missing or ambiguous", () => {
    expect(() => validateMappedSourcePositions([
      { videoId: "video-one01", position: 0 },
    ])).toThrow(/no valid YouTube position/i);
    expect(() => validateMappedSourcePositions([
      { videoId: "video-one01", sourcePosition: 0 },
      { videoId: "video-two02", sourcePosition: null },
    ])).toThrow(/no valid YouTube position/i);
    expect(() => validateMappedSourcePositions([
      { videoId: "video-one01", sourcePosition: 0 },
      { videoId: "video-two02", sourcePosition: 0 },
    ])).toThrow(/unique and strictly increasing/i);
    expect(() => validateMappedSourcePositions([
      { videoId: "video-one01", sourcePosition: 2 },
      { videoId: "video-two02", sourcePosition: 1 },
    ])).toThrow(/unique and strictly increasing/i);
    expect(mappedSourceSnapshotEvidence([
      { videoId: "video-one01", sourcePosition: 0 },
      { videoId: "video-two02", sourcePosition: 2 },
    ])).toBe("1\tvideo-one01\n3\tvideo-two02\n");
  });

  it("keeps mapped empty-source handling fail-closed without changing legacy skip", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    const emptyBranch = source.slice(
      source.indexOf("if (ytVideos.length === 0)"),
      source.indexOf("let chapterId", source.indexOf("if (ytVideos.length === 0)")),
    );
    expect(emptyBranch).toMatch(/if \(plan\.chapterManifest\)/);
    expect(emptyBranch.indexOf("fail(")).toBeLessThan(emptyBranch.indexOf("continue;"));
    expect(emptyBranch).toMatch(/no usable videos, skipping/);
  });

  it("makes the database target explicit", () => {
    expect(parseImporterArgs([
      "--env=staging", "--expected-playlists=1", "--max-playlists=5", "UC_real",
    ])).toMatchObject({
      environment: "staging",
      dryRun: false,
      confirmProduction: false,
      expectedPlaylists: 1,
      maxPlaylists: 5,
      channelId: "UC_real",
      nonInteractive: false,
    });
    expect(parseImporterArgs([
      "UC_real", "--env=production", "--confirm-production",
      "--expected-playlists=1", "--max-playlists=5",
    ])).toMatchObject({
      environment: "production",
      confirmProduction: true,
      channelId: "UC_real",
      nonInteractive: false,
    });
    expect(parseImporterArgs([
      "UC_real", "--dry-run", "--expected-playlists=1", "--max-playlists=5",
    ])).toMatchObject({
      environment: "staging",
      dryRun: true,
    });
    expect(() => parseImporterArgs([
      "--env=preview", "--expected-playlists=1", "--max-playlists=5",
    ])).toThrow(/production or staging/);
  });

  it("requires a full, valid mapping for a non-interactive import", () => {
    expect(() => parseImporterArgs([
      "--playlist-id=PL_real", "--expected-playlists=1", "--max-playlists=5",
    ])).toThrow(/missing/);
    expect(() => validateCourseMetadata({
      contentType: "invalid",
      language: "hinglish",
      difficulty: "advanced",
    })).toThrow(/contentType/);
    expect(parseImporterArgs([
      "UC_real",
      "--env=staging",
      "--expected-playlists=1",
      "--max-playlists=5",
      "--playlist-id=PL_real",
      "--category=JEE",
      "--goal=JEE",
      "--subject=Physics",
      "--chapter=Kinematics",
      "--classes=11th",
      "--content-type=full-course",
      "--language=hinglish",
      "--difficulty=advanced",
      "--teacher=ABJ Sir",
      "--audience-focus=11th",
    ])).toMatchObject({
      nonInteractive: true,
      playlistId: "PL_real",
      contentType: "full-course",
      language: "hinglish",
      difficulty: "advanced",
      teacher: "ABJ Sir",
      audienceFocus: "11th",
    });
    expect(parseImporterArgs([
      "UC_real",
      "--env=staging",
      "--expected-playlists=1",
      "--max-playlists=5",
      "--playlist-id=PL_real",
      "--category=JEE",
      "--goal=JEE",
      "--subject=Mathematics",
      "--chapter-manifest=docs/manifests/functions.json",
      "--classes=12th",
      "--content-type=full-course",
      "--language=hinglish",
      "--difficulty=advanced",
      "--teacher=Mohit Tyagi",
      "--audience-focus=12th",
    ])).toMatchObject({
      nonInteractive: true,
      chapter: null,
      chapterManifest: "docs/manifests/functions.json",
    });
    expect(() => parseImporterArgs([
      "UC_real", "--expected-playlists=1", "--max-playlists=1",
      "--playlist-id=PL_real", "--category=JEE", "--goal=JEE",
      "--subject=Mathematics", "--chapter=Functions",
      "--chapter-manifest=manifest.json", "--classes=12th",
      "--content-type=full-course", "--language=hinglish",
      "--difficulty=advanced", "--teacher=Mohit Tyagi",
      "--audience-focus=12th",
    ])).toThrow(/either --chapter or --chapter-manifest/i);
  });

  it("requires teacher attribution and a valid primary audience", () => {
    expect(() => validateCourseAttribution({
      teacher: "",
      audienceFocus: "11th",
      classLabels: ["11th"],
    })).toThrow(/teacher/);
    expect(() => validateCourseAttribution({
      teacher: "ABJ Sir",
      audienceFocus: "12th",
      classLabels: ["11th"],
    })).toThrow(/applicable classes/);
  });

  it("requires an exact bounded playlist count", () => {
    expect(() => parseImporterArgs(["UC_real"])).toThrow(/expected-playlists/);
    expect(() => parseImporterArgs([
      "UC_real", "--expected-playlists=1",
    ])).toThrow(/max-playlists/);
    expect(() => parseImporterArgs([
      "UC_real", "--expected-playlists=26", "--max-playlists=26",
    ])).toThrow(/no greater than 25/);
    expect(() => parseImporterArgs([
      "UC_real", "--expected-playlists=6", "--max-playlists=5",
    ])).toThrow(/cannot exceed/);
    expect(() => assertImportSelection({
      selected: 6, expected: 6, max: 5,
    })).toThrow(/batch cap/);
    expect(() => assertImportSelection({
      selected: 4, expected: 5, max: 5,
    })).toThrow(/expected 5.*mapped 4/i);
  });

  it("requires explicit confirmation only for a production write", () => {
    expect(() => assertProductionWriteAllowed({
      environment: "production",
      dryRun: false,
      confirmProduction: false,
    })).toThrow(/confirm-production/);
    expect(() => assertProductionWriteAllowed({
      environment: "production",
      dryRun: true,
      confirmProduction: false,
    })).not.toThrow();
    expect(() => assertProductionWriteAllowed({
      environment: "staging",
      dryRun: false,
      confirmProduction: false,
    })).not.toThrow();
  });

  it("accepts only a playlist owned by the requested channel", () => {
    const owner = {
      channelId: "UC_owner",
      playlistId: "PL_real",
      playlistTitle: "Real course",
      videoCount: 12,
    };
    expect(playlistFromOwner(owner, "UC_owner")).toEqual({
      id: "PL_real",
      title: "Real course",
      videoCount: 12,
    });
    expect(() => playlistFromOwner(owner, "UC_other")).toThrow(/does not belong/);
  });
});

describe("blanket update confirmation", () => {
  it("requires both --confirm and an exact positive expected count", () => {
    expect(() => parseBulkConfirmation([])).toThrow(/--confirm/);
    expect(() => parseBulkConfirmation(["--confirm"])).toThrow(/--expected-count/);
    expect(() => parseBulkConfirmation(["--confirm", "--expected-count=0"])).toThrow(/positive integer/);
    expect(parseBulkConfirmation(["--confirm", "--expected-count=5"])).toBe(5);
  });

  it("stops when the selected row count differs from the approved count", () => {
    expect(() => assertExpectedRowCount(5, 4)).toThrow(/expected 5.*found 4/i);
    expect(() => assertExpectedRowCount(5, 5)).not.toThrow();
  });
});
