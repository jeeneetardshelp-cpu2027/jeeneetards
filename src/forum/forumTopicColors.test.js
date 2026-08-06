import { describe, expect, it } from "vitest";
import { forumTopicTint } from "./forumTopicColors.js";

const LAUNCH_TOPIC_SLUGS = [
  "physics",
  "chemistry",
  "mathematics",
  "biology",
  "strategy",
  "exam-admissions",
];

describe("forum topic colours", () => {
  it("gives every launch topic a distinct accent", () => {
    const tints = LAUNCH_TOPIC_SLUGS.map(forumTopicTint);
    expect(new Set(tints).size).toBe(LAUNCH_TOPIC_SLUGS.length);
  });

  it("keeps the fallback deterministic for future topics", () => {
    expect(forumTopicTint("future-topic")).toBe(forumTopicTint("future-topic"));
  });
});
