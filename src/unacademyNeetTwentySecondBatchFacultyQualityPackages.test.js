import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const facultyPath =
  "docs/sql/unacademy_neet_twenty_second_batch_faculty_links_2026-08-16.sql";
const qualityPath =
  "docs/sql/unacademy_neet_twenty_second_batch_quality_review_2026-08-16.sql";
const facultyReadinessPath =
  "docs/unacademy-neet-twenty-second-batch-faculty-links-readiness-2026-08-16.md";
const qualityReadinessPath =
  "docs/unacademy-neet-twenty-second-batch-quality-readiness-2026-08-16.md";

const faculty = readFileSync(facultyPath, "utf8");
const quality = readFileSync(qualityPath, "utf8");
const facultyReadiness = readFileSync(facultyReadinessPath, "utf8");
const qualityReadiness = readFileSync(qualityReadinessPath, "utf8");

const facultyHash =
  "ab462555ee235f591abeac364811f835b35e3a87b31784366bd0b110569a4422";
const qualityHash =
  "ea8c707a5a1c7ae4899bb0bd1617a0d04369e1748582197afa05cd1bf22cf39d";

describe("Unacademy NEET twenty-second-batch faculty and quality packages", () => {
  it("pins both immutable artifacts and records only the faculty production gate", () => {
    expect(createHash("sha256").update(faculty).digest("hex")).toBe(facultyHash);
    expect(createHash("sha256").update(quality).digest("hex")).toBe(qualityHash);
    expect(facultyReadiness).toContain(`SHA-256: \`${facultyHash}\``);
    expect(qualityReadiness).toContain(`SHA-256: \`${qualityHash}\``);
    expect(facultyReadiness).toContain("APPLIED SUCCESSFULLY TO PRODUCTION");
    expect(facultyReadiness).toContain("176 -> 179");
    expect(facultyReadiness).toContain("2026-08-17T05:57:41.899Z");
    expect(facultyReadiness).not.toContain("OWNER APPROVAL REQUIRED FOR PRODUCTION");
    expect(qualityReadiness).toContain("OWNER APPROVAL REQUIRED FOR PRODUCTION");
    expect(qualityReadiness).not.toContain("APPLIED SUCCESSFULLY TO PRODUCTION");
    for (const readiness of [facultyReadiness, qualityReadiness])
      expect(readiness).toContain("`release` push");
  });

  it("pins the owner decision, exact courses, sources, and all 22 lessons", () => {
    const fragments = [
      "fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c",
      "PLsgHooHkqhhOHzoncmAMTU9UgJiN1gtcp",
      "PLsgHooHkqhhOkrbz6-7e8cnZ5bvtre4pk",
      "PLsgHooHkqhhO9QF6HRyQYvV20hrDtCdKL",
      "Work, Energy and Power",
      "Solutions",
      "Periodic Table",
      "nNfVSQK__qo", "tpTtsf8bUT0", "1YBTvWxbyFU", "A5qKIJCC_z4",
      "0Ffb8pVnssg", "4D3YA2WwMpY", "M6gBk4ItYXs", "IlVdc4mNfoE",
      "gSPbfLfBuu8", "h-lynBmTHN0", "eI8iO8Ljqrk",
      "2i9pWHtw_Uk", "N5BKG69t17I", "yJuRUNWok54", "mMCKg3YVBL0",
      "z3nnduK6K3w", "tySjtCF7YQI",
      "ZmBBuu4-rKU", "DjU7kQNy1lM", "ZVapFLksVjo", "l01Idjq4TeM",
      "u7LCnFAbQDw",
      "30eee4a4a6842e5beeb7c97083d7f812",
    ];
    for (const artifact of [faculty, quality]) {
      for (const fragment of fragments) expect(artifact).toContain(fragment);
    }
  });

  it("keeps the faculty artifact insert-only and reuses exact verified identities", () => {
    const executable = faculty.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable.match(/insert into public\./g)).toHaveLength(1);
    expect(executable.trimEnd().endsWith("commit;")).toBe(true);
    for (const fragment of [
      "(441,34,'instructor',1)",
      "(442,36,'instructor',1)",
      "(443,36,'instructor',1)",
      "'441:mahendra-singh:1'",
      "'442:anoop-vashishtha:1'",
      "'443:anoop-vashishtha:1'",
    ]) expect(faculty).toContain(fragment);
  });

  it("pins the exact faculty preflight and postflight totals", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 424",
      "count(*) from public.videos) <> 4768",
      "count(*) from public.playlist_videos) <> 4774",
      "count(*) from public.teachers) <> 37",
      "count(*) from public.teacher_aliases) <> 60",
      "count(*) from public.playlist_teachers) <> 176",
      "count(*) from public.playlist_teachers) <> 179",
      "count(*) from public.playlist_quality_reviews) <> 47",
    ]) expect(faculty).toContain(fragment);
    expect(faculty.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(faculty.match(/protected_memberships <> 1304/g)).toHaveLength(2);
  });

  it("requires the faculty post-state before exactly three quality transitions", () => {
    for (const fragment of [
      "public.catalog_manage_capability()->>'version' is distinct from '11'",
      "count(*) from public.playlist_teachers) <> 179",
      "count(*) from public.playlist_quality_reviews) <> 47",
      "count(*) from public.playlist_quality_reviews) <> 50",
      "review_playlist_quality(\n    441",
      "review_playlist_quality(\n    442",
      "review_playlist_quality(\n    443",
      "target already reviewed",
      "NEET: Work Energy & Power | Unacademy NEET | Mahendra Singh",
      "NEET: Solutions - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha",
      "NEET: Periodic Table | Class 11 | Unacademy NEET | Anoop V.",
    ]) expect(quality).toContain(fragment);
    expect(quality.match(/public\.review_playlist_quality\(/g)).toHaveLength(3);
    expect(quality.match(/protected_courses <> 82/g)).toHaveLength(2);
    expect(quality.match(/protected_memberships <> 1304/g)).toHaveLength(2);
    expect(quality.trimEnd().endsWith("commit;")).toBe(true);
  });
});
