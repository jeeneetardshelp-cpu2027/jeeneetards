import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2016-official-answer-key-exclusion-2026-09-04.md",
  "utf8",
);

describe("JEE Main 2016 official answer-key exclusion", () => {
  it("anchors the decision to preserved official challenge-window evidence", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20160422200645id_/http://jeemain.nic.in:80/webinfo/public/home.aspx",
    );
    expect(exclusion).toContain(
      "https://web.archive.org/web/20160421151220id_/http://jeemain.nic.in:80/jeemainapp/KeyChallange/LoginKeyChallange.aspx",
    );
    expect(exclusion).toContain("candidate login");
    expect(exclusion).toMatch(/rather than a stable public answer-key PDF/);
  });

  it("distinguishes the OMR notice from a reusable answer key", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20160501164100id_/http://jeemain.nic.in:80/WebInfo/Handler/FileHandler.ashx?i=File&ii=51&iii=Y",
    );
    expect(exclusion).toContain("paid photocopy");
    expect(exclusion).toContain("it is not an answer key");
    expect(exclusion).toContain("no 2016 Paper 1 answer-key PDF");
  });

  it("fails closed instead of substituting unofficial material", () => {
    expect(exclusion).toContain("No JEE Main 2016 Paper 1 answer key or worked solution");
    expect(exclusion).toMatch(/No coaching-site\s+key/);
    expect(exclusion).toContain("memory-based reconstruction");
    expect(exclusion).toContain("candidate response sheet");
    expect(exclusion).toContain("unofficial scan");
  });

  it("keeps the separately verified question papers intact", () => {
    expect(exclusion).toContain("six official 2016 Paper 1 question papers");
    expect(exclusion).toContain("none includes answers or worked solutions");
    expect(exclusion).toMatch(/complete official copy becomes available/);
  });
});
