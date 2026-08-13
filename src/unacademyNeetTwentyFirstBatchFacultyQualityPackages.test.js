import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const facultyPath =
  "docs/sql/unacademy_neet_twenty_first_batch_faculty_links_2026-08-13.sql";
const qualityPath =
  "docs/sql/unacademy_neet_twenty_first_batch_quality_review_2026-08-13.sql";
const facultyReadinessPath =
  "docs/unacademy-neet-twenty-first-batch-faculty-links-readiness-2026-08-13.md";
const qualityReadinessPath =
  "docs/unacademy-neet-twenty-first-batch-quality-readiness-2026-08-13.md";

const faculty = readFileSync(facultyPath, "utf8");
const quality = readFileSync(qualityPath, "utf8");
const facultyReadiness = readFileSync(facultyReadinessPath, "utf8");
const qualityReadiness = readFileSync(qualityReadinessPath, "utf8");

const facultyHash =
  "51631e50339e5c687f6cf77bb359ec33f05ce839df78c5fa520f5ef6403e8a1e";
const qualityHash =
  "f2c594264c01e03c8828a430bb81f206053b915eac51b9b0f7417da0de755736";

describe("Unacademy NEET twenty-first-batch faculty and quality packages", () => {
  it("pins the immutable hashes and keeps both gates unapplied", () => {
    expect(createHash("sha256").update(faculty).digest("hex")).toBe(facultyHash);
    expect(createHash("sha256").update(quality).digest("hex")).toBe(qualityHash);
    expect(facultyReadiness).toContain(`SHA-256: \`${facultyHash}\``);
    expect(qualityReadiness).toContain(`SHA-256: \`${qualityHash}\``);
    expect(facultyReadiness).toContain("OWNER APPROVAL REQUIRED - NOT APPLIED");
    expect(qualityReadiness).toContain("OWNER APPROVAL REQUIRED - NOT APPLIED");
  });

  it("pins the exact owner decision, sources, courses, and lesson IDs", () => {
    for (const artifact of [faculty, quality]) {
      for (const fragment of [
        "9443dd70-a2c6-4747-9a5e-a9022f7012cf",
        "PLsgHooHkqhhMZ0ocHynO-84oB0VVcuyoG",
        "PLsgHooHkqhhPkYyUO_zMJpEQZ5MST56fK",
        "v9q8mDQdXbM",
        "NBwkv5Q-OK0",
        "hixsCud1ajA",
        "BumQy7Ni8Gg",
        "nwFN57p4x2o",
        "I3hOh2-0uHI",
        "Kinetic Theory of Gases",
        "Electromagnetic Waves",
        "30eee4a4a6842e5beeb7c97083d7f812",
      ]) expect(artifact).toContain(fragment);
    }
  });

  it("keeps the faculty gate insert-only and separate from quality review", () => {
    const executable = faculty.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/\b(?:update|delete|alter|drop|truncate)\b/i);
    expect(executable).not.toContain("review_playlist_quality");
    expect(executable.match(/insert into public\./g)).toHaveLength(6);
    expect(executable.trimEnd().endsWith("commit;")).toBe(true);
    expect(faculty).toContain("'439:shubham-kumar:1'");
    expect(faculty).toContain("'440:samip-velani:1'");
  });

  it("pins the faculty preflight and postflight totals", () => {
    for (const fragment of [
      "count(*) from public.playlists) <> 421",
      "count(*) from public.videos) <> 4746",
      "count(*) from public.playlist_videos) <> 4752",
      "count(*) from public.teachers) <> 35",
      "count(*) from public.teachers) <> 37",
      "count(*) from public.teacher_aliases) <> 56",
      "count(*) from public.teacher_aliases) <> 60",
      "count(*) from public.playlist_teachers) <> 174",
      "count(*) from public.playlist_teachers) <> 176",
      "count(*) from public.playlist_quality_reviews) <> 45",
    ]) expect(faculty).toContain(fragment);
    expect(faculty.match(/protected_courses\s*<>\s*82/g)).toHaveLength(2);
    expect(faculty.match(/protected_memberships\s*<>\s*1304/g)).toHaveLength(2);
  });

  it("requires the faculty post-state before the quality transition", () => {
    for (const fragment of [
      "count(*) from public.teachers) <> 37",
      "count(*) from public.teacher_aliases) <> 60",
      "count(*) from public.teacher_institutes) <> 38",
      "count(*) from public.teacher_subjects) <> 38",
      "count(*) from public.teacher_learning_goals) <> 37",
      "count(*) from public.playlist_teachers) <> 176",
      "count(*) from public.playlist_quality_reviews) <> 45",
      "count(*) from public.playlist_quality_reviews)<>47",
      "review_playlist_quality(439",
      "review_playlist_quality(440",
      "target already reviewed",
    ]) expect(quality).toContain(fragment);
    expect(quality.trimEnd().endsWith("commit;")).toBe(true);
    expect(quality.match(/protected_courses\s*<>\s*82/g)).toHaveLength(2);
    expect(quality.match(/protected_memberships\s*<>\s*1304/g)).toHaveLength(2);
  });
});
