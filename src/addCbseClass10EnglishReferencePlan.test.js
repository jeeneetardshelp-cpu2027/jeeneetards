import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path =
  "docs/sql/add_cbse_class10_english_reference_2026-07-29.sql";
const source = readFileSync(path, "utf8");

const chapterNames = [
  "A Letter to God",
  "Nelson Mandela: Long Walk to Freedom",
  "Two Stories about Flying",
  "From the Diary of Anne Frank",
  "Glimpses of India",
  "Mijbil the Otter",
  "Madam Rides the Bus",
  "The Sermon at Benares",
  "The Proposal",
  "A Triumph of Surgery",
  "The Thief''s Story",
  "The Midnight Visitor",
  "A Question of Trust",
  "Footprints Without Feet",
  "The Necklace",
  "Bholi",
];

describe("CBSE Class 10 English Gate 1 artifact", () => {
  it("contains the exact reviewed subject and 16 chapters once each", () => {
    expect(source).toContain("values ('English', 'english', 7)");
    expect(chapterNames).toHaveLength(16);
    for (const name of chapterNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source.match(new RegExp(`'${escaped}'`, "g"))).toHaveLength(2);
    }
    expect(source).toContain("v_chapter_rows <> 16");
    expect(source).toContain("count(*) from public.chapters) <> 185");
  });

  it("fails closed on the exact fresh production baseline", () => {
    expect(source).toContain(
      "(select count(*) from public.playlists) <> 151",
    );
    expect(source).toContain(
      "(select count(*) from public.videos) <> 1923",
    );
    expect(source).toContain(
      "(select count(*) from public.playlist_videos) <> 1927",
    );
    expect(source).toContain(
      "(select count(*) from public.chapters) <> 169",
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
