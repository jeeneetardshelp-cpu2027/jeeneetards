import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2020-official-answer-key-exclusion-2026-09-15.md",
  "utf8",
);

describe("JEE Main 2020 official answer-key exclusion", () => {
  it("distinguishes the surviving Paper 2 archive entry from missing Paper 1 material", () => {
    expect(exclusion).toContain("https://www.nta.ac.in/NoticeBoardArchive");
    expect(exclusion).toContain("https://jeemain.nta.nic.in/document-category/archive/page/11/");
    expect(exclusion).toContain("Paper 2 B.Arch/B.Planning");
    expect(exclusion).toContain("does not list an equivalent Paper 1 final");
    expect(exclusion).toContain("Paper 2 is excluded");
  });

  it("does not misrepresent an individual RTI reference as a public source", () => {
    expect(exclusion).toContain("https://nta.ac.in/Download/RTI/RTISM_20220303121530.pdf");
    expect(exclusion).toContain("individual request");
    expect(exclusion).toMatch(/does not publish\s+a complete official public Paper 1 key/);
    expect(exclusion).toContain("redistribution permission");
  });

  it("fails closed instead of substituting unofficial material", () => {
    expect(exclusion).toContain("No JEE Main 2020 Paper 1 answer key or worked solution");
    expect(exclusion).toContain("six January and ten September shifts");
    expect(exclusion).toMatch(/No coaching-site\s+key/);
    expect(exclusion).toContain("candidate response record");
    expect(exclusion).toContain("third-party worked solution");
  });

  it("sets a clear future acceptance condition", () => {
    expect(exclusion).toContain("complete official public Paper 1 key");
    expect(exclusion).toContain("permission that clearly covers redistribution on JEENEETARD");
  });
});
