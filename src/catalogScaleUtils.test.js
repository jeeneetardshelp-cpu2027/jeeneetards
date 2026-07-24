import { describe, expect, it } from "vitest";
import {
  boundedInteger, chunks, percentile, scaleVideoKey, timingSummary,
} from "./scripts/catalogScaleUtils.js";

describe("catalogue scale verifier utilities", () => {
  it("accepts bounded integer configuration and rejects unsafe sizes", () => {
    expect(boundedInteger(undefined, 1000, { name: "rows", min: 100, max: 5000 })).toBe(1000);
    expect(boundedInteger("250", 1000, { name: "rows", min: 100, max: 5000 })).toBe(250);
    expect(() => boundedInteger("99", 1000, { name: "rows", min: 100, max: 5000 })).toThrow(/100 to 5000/);
    expect(() => boundedInteger("2.5", 1000, { name: "rows", min: 100, max: 5000 })).toThrow(/integer/);
  });

  it("chunks without losing or repeating rows", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
    expect(() => chunks([1], 0)).toThrow(/positive integer/);
  });

  it("uses nearest-rank percentiles and emits stable summaries", () => {
    expect(percentile([50, 10, 40, 20, 30], 0.5)).toBe(30);
    expect(percentile([50, 10, 40, 20, 30], 0.95)).toBe(50);
    expect(timingSummary([10.2, 20.6, 30.1])).toEqual({
      samples: 3, min_ms: 10, median_ms: 21, p95_ms: 30, max_ms: 30,
    });
  });

  it("generates unique eleven-character YouTube-shaped fixture ids", () => {
    expect(scaleVideoKey("a1b2c3", 0)).toBe("Sa1b2c30000");
    expect(scaleVideoKey("a1b2c3", 35)).toBe("Sa1b2c3000z");
    expect(new Set(Array.from({ length: 500 }, (_, i) => scaleVideoKey("a1b2c3", i))).size).toBe(500);
    expect(() => scaleVideoKey("unsafe", 1)).toThrow(/run id/);
  });
});
