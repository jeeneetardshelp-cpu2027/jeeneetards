import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path =
  "docs/sql/add_cbse_class10_hindi_a_reference_2026-07-29.sql";
const source = readFileSync(path, "utf8");

const chapterNames = [
  "सूरदास के पद",
  "राम-लक्ष्मण-परशुराम संवाद",
  "आत्मकथ्य",
  "उत्साह",
  "अट नहीं रही है",
  "यह दंतुरित मुसकान",
  "फसल",
  "संगतकार",
  "नेताजी का चश्मा",
  "बालगोबिन भगत",
  "लखनवी अंदाज़",
  "एक कहानी यह भी",
  "नौबतखाने में इबादत",
  "संस्कृति",
  "माता का आँचल",
  "साना-साना हाथ जोड़ि",
  "मैं क्यों लिखता हूँ",
];

describe("CBSE Class 10 Hindi A Gate 1 artifact", () => {
  it("contains the exact reviewed Unicode subject and chapters once each", () => {
    expect(source).toContain("values ('Hindi A', 'hindi-a', 9)");
    expect(chapterNames).toHaveLength(17);
    for (const name of chapterNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source.match(new RegExp(`'${escaped}'`, "gu"))).toHaveLength(2);
    }
    expect(source).toContain("v_chapter_rows <> 17");
    expect(source).toContain("count(*) from public.chapters) <> 218");
  });

  it("fails closed on the exact fresh production baseline", () => {
    expect(source).toContain(
      "(select count(*) from public.playlists) <> 153",
    );
    expect(source).toContain(
      "(select count(*) from public.videos) <> 1957",
    );
    expect(source).toContain(
      "(select count(*) from public.playlist_videos) <> 1961",
    );
    expect(source).toContain(
      "(select count(*) from public.chapters) <> 201",
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
