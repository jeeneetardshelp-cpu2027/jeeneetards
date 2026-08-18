import { describe, expect, it } from "vitest";
import { normalizePersonName, proposeTeacher } from "./proposeTeacher.js";

const teacher = (overrides = {}) => ({
  id: 34,
  display_name: "Alakh Pandey",
  verified: true,
  aliases: [{ alias: "ALK", status: "verified" }],
  ...overrides,
});

describe("normalizePersonName", () => {
  it("strips Latin honorifics while preserving Unicode names", () => {
    expect(normalizePersonName("  Dr. श्वेता सिंह Ma'am ")).toBe("श्वेता सिंह");
  });

  it("returns null when only an honorific remains", () => {
    expect(normalizePersonName("Professor Sir")).toBeNull();
  });
});

describe("proposeTeacher", () => {
  it("prefills a live verified candidate from an explicit reviewed-alias hashtag", () => {
    const result = proposeTeacher(
      { videoTags: [["#alksir", "#physics"]] },
      [teacher()],
    );

    expect(result.value).toBe(34);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matches[0]).toMatchObject({
      kind: "hashtag",
      variant: "ALK",
      aliasStatus: "verified",
    });
    expect(result.requiresReview).toBe(true);
  });

  it("recognises an explicit full-name honorific without trusting it automatically", () => {
    const result = proposeTeacher(
      { playlistDescription: "Complete Physics course by Alakh Pandey Sir." },
      [teacher()],
    );

    expect(result.value).toBe(34);
    expect(result.requiresReview).toBe(true);
    expect(result.evidence).toContain("human identity confirmation required");
  });

  it("never breaks a tie when two teachers share the same verified alias", () => {
    const sharedAlias = [{ alias: "AB", status: "verified" }];
    const result = proposeTeacher(
      { videoTags: [["#absir"]] },
      [
        teacher({ id: 1, display_name: "Mahendra Singh", aliases: sharedAlias }),
        teacher({ id: 2, display_name: "Manish Sharma", aliases: sharedAlias }),
      ],
    );

    expect(result.value).toBeNull();
    expect(result.candidates.map((candidate) => candidate.teacher_id)).toEqual([1, 2]);
    expect(result.evidence).toContain("ambiguous");
    expect(result.requiresReview).toBe(true);
  });

  it("does not resolve a candidate reached only through an unverified alias", () => {
    const result = proposeTeacher(
      { playlistTitle: "Mechanics by Physics Guru Sir" },
      [teacher({ aliases: [{ alias: "Physics Guru", status: "proposed" }] })],
    );

    expect(result.value).toBeNull();
    expect(result.candidates).toHaveLength(1);
    expect(result.evidence).toContain("unverified");
  });

  it("does not treat a bare channel name as explicit teacher attribution", () => {
    const result = proposeTeacher(
      { channelTitle: "Alakh Pandey", playlistTitle: "Complete Physics" },
      [teacher()],
    );

    expect(result.value).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("can return only IDs supplied by the live registry", () => {
    const result = proposeTeacher(
      { playlistDescription: "Faculty: Invented Person" },
      [teacher()],
    );

    expect(result.value).toBeNull();
    expect(result.candidates).toEqual([]);
  });
});
