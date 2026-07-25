import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertExpectedRowCount,
  buildImportPayload,
  parseBulkConfirmation,
  parseImporterArgs,
  promptCourseMetadata,
  validateCourseMetadata,
} from "./ingestionSafety.js";

describe("channel ingestion metadata", () => {
  it("wires the metadata payload builder into the importer RPC call", () => {
    const source = readFileSync(resolve("src/scripts/importChannel.js"), "utf8");
    expect(source).toMatch(/payload:\s*buildImportPayload\(\{/);
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
    expect(parseImporterArgs(["--env=staging", "UC_real"])).toMatchObject({
      environment: "staging",
      confirmProduction: false,
      channelId: "UC_real",
      nonInteractive: false,
    });
    expect(parseImporterArgs(["UC_real", "--confirm-production"])).toMatchObject({
      environment: "production",
      confirmProduction: true,
      channelId: "UC_real",
      nonInteractive: false,
    });
    expect(() => parseImporterArgs(["--env=preview"])).toThrow(/production or staging/);
  });

  it("requires a full, valid mapping for a non-interactive import", () => {
    expect(() => parseImporterArgs(["--playlist-id=PL_real"])).toThrow(/missing/);
    expect(() => validateCourseMetadata({
      contentType: "invalid",
      language: "hinglish",
      difficulty: "advanced",
    })).toThrow(/contentType/);
    expect(parseImporterArgs([
      "UC_real",
      "--env=staging",
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
