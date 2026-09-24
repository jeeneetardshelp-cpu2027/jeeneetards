import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2019-january-official-final-answer-key-exclusion-2026-09-15.md",
  "utf8",
);

describe("JEE Main January 2019 official final-answer-key exclusion", () => {
  it("distinguishes the archived January notices from the available April final key", () => {
    expect(exclusion).toContain("https://www.nta.ac.in/NoticeBoardArchive");
    expect(exclusion).toContain("January 2019 Paper 1 result");
    expect(exclusion).toContain("January JEE key-challenge notice");
    expect(exclusion).toContain("April 2019 Paper 1 final answer key");
    expect(exclusion).toMatch(/does not expose an equivalent January 2019 Paper 1 final-key\s+document/);
  });

  it("fails closed instead of substituting historical third-party copies", () => {
    expect(exclusion).toContain("No JEE Main January 2019 Paper 1 final answer key");
    expect(exclusion).toMatch(/not official\s+current-source records/);
    expect(exclusion).toMatch(/No third-party\s+copy/);
    expect(exclusion).toContain("candidate response record");
    expect(exclusion).toContain("worked solution");
  });

  it("keeps the April package and acceptance boundary intact", () => {
    expect(exclusion).toContain("April 2019 final-answer-key package remains unchanged");
    expect(exclusion).toMatch(/complete official public Paper\s+1 key/);
    expect(exclusion).toMatch(/permission that\s+clearly covers redistribution on JEENEETARD/);
  });
});
