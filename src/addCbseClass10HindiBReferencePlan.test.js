import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path =
  "docs/sql/add_cbse_class10_hindi_b_reference_2026-07-29.sql";
const source = readFileSync(path, "utf8");

const chapterNames = [
  "कबीर की साखी",
  "मीरा के पद",
  "मनुष्यता",
  "पर्वत प्रदेश में पावस",
  "तोप",
  "कर चले हम फ़िदा",
  "आत्मत्राण",
  "बड़े भाई साहब",
  "डायरी का एक पन्ना",
  "तताँरा वामीरो कथा",
  "अब कहाँ दूसरे के दुख से दुखी होने वाले",
  "पतझर में टूटी पत्तियाँ",
  "कारतूस",
  "हरिहर काका",
  "सपनों के से दिन",
  "टोपी शुक्ला",
];

describe("CBSE Class 10 Hindi B Gate 1 artifact", () => {
  it("contains the exact reviewed Unicode subject and chapters once each", () => {
    expect(source).toContain("values ('Hindi B', 'hindi-b', 8)");
    expect(chapterNames).toHaveLength(16);
    for (const name of chapterNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source.match(new RegExp(`'${escaped}'`, "gu"))).toHaveLength(2);
    }
    expect(source).toContain("v_chapter_rows <> 16");
    expect(source).toContain("count(*) from public.chapters) <> 201");
  });

  it("fails closed on the exact fresh production baseline", () => {
    expect(source).toContain(
      "(select count(*) from public.playlists) <> 152",
    );
    expect(source).toContain(
      "(select count(*) from public.videos) <> 1941",
    );
    expect(source).toContain(
      "(select count(*) from public.playlist_videos) <> 1945",
    );
    expect(source).toContain(
      "(select count(*) from public.chapters) <> 185",
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
