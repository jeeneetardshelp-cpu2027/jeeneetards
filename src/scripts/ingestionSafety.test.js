import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertImportSelection,
  assertProductionWriteAllowed,
  assertExpectedRowCount,
  buildImportPayload,
  parseBulkConfirmation,
  parseImporterArgs,
  playlistFromOwner,
  promptCourseMetadata,
  validateCourseMetadata,
} from "./ingestionSafety.js";

describe("channel ingestion metadata", () => {
  it("wires the metadata payload builder into the importer RPC call", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/payload:\s*buildImportPayload\(\{/);
  });

  it("keeps dry-run on the anonymous client and before the import RPC", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/args\.dryRun \? publicKey : serviceKey/);
    expect(source.indexOf("if (args.dryRun)"))
      .toBeLessThan(source.indexOf('db.rpc("import_playlist"'));
  });

  it("uses a focused ownership lookup and existing production chapters", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/getPlaylistOwner\(ytKey, args\.playlistId\)/);
    expect(source).toMatch(
      /args\.environment === "production" && !existingChapter/,
    );
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
    });
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
    ])).toMatchObject({
      nonInteractive: true,
      playlistId: "PL_real",
      contentType: "full-course",
      language: "hinglish",
      difficulty: "advanced",
    });
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
