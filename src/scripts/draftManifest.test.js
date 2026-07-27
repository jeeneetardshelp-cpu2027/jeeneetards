import { describe, expect, it, vi } from "vitest";
import {
  assertDraftOutputsAvailable,
  parseArgs,
  resolveDraftOutputPaths,
} from "./draftManifest.js";

describe("draftManifest CLI safety", () => {
  it("parses the explicit overwrite opt-in", () => {
    expect(parseArgs([
      "--playlist", "playlist-id",
      "--subject", "Physics",
      "--out", "draft.json",
      "--overwrite",
    ])).toEqual({
      playlist: "playlist-id",
      subject: "Physics",
      out: "draft.json",
      overwrite: true,
    });
  });

  it("derives a distinct review sidecar from a JSON output", () => {
    const paths = resolveDraftOutputPaths({
      out: "draft.json",
      playlist: "playlist-id",
      cwd: "C:\\workspace",
      baseDir: "C:\\workspace\\src\\scripts",
    });
    expect(paths.outPath).toMatch(/draft\.json$/);
    expect(paths.reviewPath).toMatch(/draft\.review\.json$/);
    expect(paths.reviewPath).not.toBe(paths.outPath);
  });

  it("rejects an output without a JSON extension", () => {
    expect(() => resolveDraftOutputPaths({
      out: "draft",
      playlist: "playlist-id",
      cwd: "C:\\workspace",
      baseDir: "C:\\workspace\\src\\scripts",
    })).toThrow("must use a .json filename");
  });

  it("refuses to overwrite either generated file by default", () => {
    const paths = { outPath: "draft.json", reviewPath: "draft.review.json" };
    const exists = vi.fn((path) => path === paths.reviewPath);
    expect(() => assertDraftOutputsAvailable(paths, false, exists))
      .toThrow("refusing to overwrite");
  });

  it("allows regeneration only with explicit overwrite opt-in", () => {
    const paths = { outPath: "draft.json", reviewPath: "draft.review.json" };
    const exists = vi.fn(() => true);
    expect(() => assertDraftOutputsAvailable(paths, true, exists)).not.toThrow();
    expect(exists).not.toHaveBeenCalled();
  });
});
