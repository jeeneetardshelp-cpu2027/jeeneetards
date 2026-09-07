import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2013-official-answer-key-exclusion-2026-09-04.md",
  "utf8",
);

describe("JEE Main 2013 official answer-key exclusion", () => {
  it("anchors the decision to the two preserved official notices", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20130512123528id_/http://jeemain.nic.in:80/jeemain2013/pdf/public_notice_jee_main_29_04_2013.pdf",
    );
    expect(exclusion).toContain(
      "https://web.archive.org/web/20130612054843id_/http://jeemain.nic.in:80/jeemain2013/pdf/publicNotice_1405.pdf",
    );
    expect(exclusion).toContain("30 April through 2 May");
    expect(exclusion).toContain("before 15 June");
  });

  it("records the candidate-only distribution restriction", () => {
    expect(exclusion).toContain("only to the candidate by speed post");
    expect(exclusion).toContain("institution or school");
    expect(exclusion).toContain("display, commercial purpose or print media");
    expect(exclusion).toMatch(/does not establish public\s+redistribution permission/);
  });

  it("fails closed instead of substituting unofficial material", () => {
    expect(exclusion).toContain("No JEE Main 2013 Paper 1 answer key or worked solution");
    expect(exclusion).toContain("no standalone public JEE Main 2013 Paper 1 answer-key PDF");
    expect(exclusion).toContain("Third-party coaching keys");
    expect(exclusion).toContain("candidate photocopies or scans were not substituted");
    expect(exclusion).toContain("official-only requirement");
  });

  it("keeps the answer-key decision aligned with the paper exclusion", () => {
    expect(exclusion).toContain("separate 2013 question-paper exclusion remains unchanged");
    expect(exclusion).toMatch(/complete\s+official five-date Paper 1 set could not be recovered/);
    expect(exclusion).toMatch(/no answer key is\s+attached/);
  });
});
