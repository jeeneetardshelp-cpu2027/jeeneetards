import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path =
  "docs/sql/add_cbse_class10_social_science_reference_2026-07-28.sql";
const source = readFileSync(path, "utf8");

const chapterNames = [
  "The Rise of Nationalism in Europe",
  "Nationalism in India",
  "The Making of a Global World",
  "The Age of Industrialisation",
  "Print Culture and the Modern World",
  "Resources and Development",
  "Forest and Wildlife Resources",
  "Water Resources",
  "Agriculture",
  "Minerals and Energy Resources",
  "Manufacturing Industries",
  "Lifelines of National Economy",
  "Power Sharing",
  "Federalism",
  "Gender, Religion and Caste",
  "Political Parties",
  "Outcomes of Democracy",
  "Development",
  "Sectors of the Indian Economy",
  "Money and Credit",
  "Globalisation and the Indian Economy",
  "Consumer Rights",
];

describe("CBSE Class 10 Social Science Gate 1 artifact", () => {
  it("contains the exact reviewed subject and 22 chapters once each", () => {
    expect(source).toContain(
      "values ('Social Science', 'social-science', 5)",
    );
    expect(chapterNames).toHaveLength(22);
    for (const name of chapterNames) {
      expect(source.match(new RegExp(`'${name}'`, "g"))).toHaveLength(1);
    }
    expect(source).toContain("v_chapter_rows <> 22");
    expect(source).toContain("count(*) from public.chapters) <> 146");
  });

  it("is create-only and fails closed on the protected production baseline", () => {
    expect(source).toMatch(/^begin;/m);
    expect(source).toMatch(/^commit;/m);
    expect(source).toContain(
      "v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc'",
    );
    expect(source).toContain("from public.boards where id = 1 and slug = 'cbse'");
    expect(source).toContain(
      "from public.learning_goals where slug = 'school'",
    );
    expect(source).not.toMatch(
      /^\s*(update|delete|alter|drop|truncate)\s/mi,
    );
  });
});
