import { describe, expect, it } from "vitest";
import { ratingDisplay, RATING_CONFIDENCE_MIN } from "./ratingConfidence.js";

describe("shared rating confidence", () => {
  it("shows no score when there are no ratings", () => {
    expect(ratingDisplay(0, 0)).toBeNull();
    expect(ratingDisplay(5, null)).toBeNull();
  });

  it("shows only the count below the confidence threshold", () => {
    expect(RATING_CONFIDENCE_MIN).toBe(5);
    expect(ratingDisplay(5, 1)).toEqual({
      kind: "low", count: 1, text: "1 student rating",
    });
    expect(ratingDisplay(4.8, 4)).toEqual({
      kind: "low", count: 4, text: "4 student ratings",
    });
  });

  it("shows a score only at or above the threshold", () => {
    expect(ratingDisplay(4.6, 5)).toEqual({ kind: "scored", score: 4.6, count: 5 });
  });

  it("does not print an invalid score even with enough ratings", () => {
    expect(ratingDisplay(null, 8)).toEqual({
      kind: "low", count: 8, text: "8 student ratings",
    });
  });
});
