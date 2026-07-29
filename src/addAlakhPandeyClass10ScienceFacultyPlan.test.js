import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "docs/sql/add_alakh_pandey_class10_science_faculty_2026-07-29.sql",
  "utf8",
);

describe("Alakh Pandey Class 10 Science faculty artifact", () => {
  it("is guarded by the exact post-import catalogue and faculty baseline", () => {
    for (const expected of [
      "public.playlists) <> 155",
      "public.videos) <> 1986",
      "public.playlist_videos) <> 1990",
      "public.chapters) <> 218",
      "public.teachers) <> 26",
      "public.playlist_teachers) <> 129",
    ]) {
      expect(source).toContain(expected);
    }
    expect(source).toContain(
      "v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc'",
    );
  });

  it("creates one verified named teacher and all reviewed additive links", () => {
    expect(source).toContain("public.create_teacher(");
    expect(source).toContain("'Alakh Pandey'");
    expect(source).toContain("public.teacher_institutes");
    expect(source).toContain("public.teacher_subjects");
    expect(source).toContain("public.teacher_learning_goals");
    expect(source).toContain("public.playlist_teachers");
    expect(source).toContain("t.slug = 'alakh-pandey'");
    expect(source).toContain("and t.verified");
  });

  it("contains no destructive or in-place statement", () => {
    expect(source).toMatch(/^begin;/m);
    expect(source).toMatch(/^commit;/m);
    expect(source).not.toMatch(
      /^\s*(update|delete|alter|drop|truncate)\s/mi,
    );
  });
});
