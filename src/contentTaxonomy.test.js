import { describe, expect, it } from "vitest";
import {
  COMPLETION_STATUSES,
  CONTENT_FORMATS,
  CONTENT_SHELVES,
  COVERAGE_LEVELS,
  EXAM_SCOPES,
  LEARNING_PURPOSES,
  TARGET_COHORTS,
  TEACHING_DEPTHS,
  shelvesForReviewedTaxonomy,
} from "./contentTaxonomy.js";

const values = (options) => options.map((option) => option.value);

describe("orthogonal content taxonomy", () => {
  it("keeps format, purpose, scope, cohort, depth, coverage and completion separate", () => {
    expect(values(CONTENT_FORMATS)).toEqual(["series", "one-shot", "live-class", "short"]);
    expect(values(LEARNING_PURPOSES)).toEqual(["theory", "revision", "practice", "pyq", "strategy"]);
    expect(values(EXAM_SCOPES)).toEqual(["jee-main", "jee-advanced", "neet", "boards", "olympiad"]);
    expect(values(TARGET_COHORTS)).toEqual(["class-9", "class-10", "class-11", "class-12", "dropper"]);
    expect(values(TEACHING_DEPTHS)).toEqual(["foundation", "standard", "advanced"]);
    expect(values(COVERAGE_LEVELS)).toEqual(["topic", "chapter", "unit", "full-syllabus"]);
    expect(values(COMPLETION_STATUSES)).toEqual(["complete", "ongoing", "incomplete"]);
    expect(values(CONTENT_SHELVES)).toEqual(["learn", "revise", "practice", "quick-clips"]);
  });

  it("allows one reviewed item to serve revision and practice", () => {
    expect(shelvesForReviewedTaxonomy({
      review_status: "verified",
      content_format: "one-shot",
      learning_purposes: ["revision", "pyq"],
    })).toEqual(["revise", "practice"]);
  });

  it("never infers shelves from pending or legacy-only metadata", () => {
    expect(shelvesForReviewedTaxonomy({
      review_status: "pending",
      content_format: "series",
      learning_purposes: ["theory"],
    })).toEqual([]);
    expect(shelvesForReviewedTaxonomy({ content_type: "full-course" })).toEqual([]);
  });

  it("isolates confirmed Shorts from structured shelves", () => {
    expect(shelvesForReviewedTaxonomy({
      review_status: "verified",
      content_format: "short",
      learning_purposes: ["theory", "revision", "practice"],
    })).toEqual(["quick-clips"]);
  });
});
