import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path =
  "docs/sql/add_cbse_class10_science_reference_2026-07-28.sql";
const source = readFileSync(path, "utf8");

const chapterNames = [
  "Chemical Reactions and Equations",
  "Acids, Bases and Salts",
  "Metals and Non-metals",
  "Carbon and its Compounds",
  "Life Processes",
  "Control and Coordination",
  "How do Organisms Reproduce?",
  "Heredity",
  "Light: Reflection and Refraction",
  "The Human Eye and the Colourful World",
  "Electricity",
  "Magnetic Effects of Electric Current",
  "Our Environment",
];

describe("CBSE Class 10 Science Gate 1 artifact", () => {
  it("contains the exact reviewed subject and 13 chapters once each", () => {
    expect(source).toContain("values ('Science', 'science', 6)");
    expect(chapterNames).toHaveLength(13);
    for (const name of chapterNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source.match(new RegExp(`'${escaped}'`, "g"))).toHaveLength(2);
    }
    expect(source).toContain("v_chapter_rows <> 13");
    expect(source).toContain("count(*) from public.chapters) <> 159");
  });

  it("fails closed on the exact production baseline", () => {
    expect(source).toContain(
      "(select count(*) from public.playlists) <> 147",
    );
    expect(source).toContain(
      "(select count(*) from public.videos) <> 1873",
    );
    expect(source).toContain(
      "(select count(*) from public.playlist_videos) <> 1877",
    );
    expect(source).toContain(
      "(select count(*) from public.chapters) <> 146",
    );
  });

  it("is create-only and protects the JEE catalogue", () => {
    expect(source).toMatch(/^begin;/m);
    expect(source).toMatch(/^commit;/m);
    expect(source).toContain(
      "v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc'",
    );
    expect(source).toContain(
      "from public.boards where id = 1 and slug = 'cbse'",
    );
    expect(source).toContain(
      "from public.learning_goals where slug = 'school'",
    );
    expect(source).not.toMatch(
      /^\s*(update|delete|alter|drop|truncate)\s/mi,
    );
  });
});
