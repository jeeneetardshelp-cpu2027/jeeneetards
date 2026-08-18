import { describe, expect, it } from "vitest";
import { proposeTaxonomy } from "./proposeTaxonomy.js";

const taxonomy = {
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

describe("proposeTaxonomy teacher integration", () => {
  it("routes a verified teacher candidate to review instead of auto-accepting identity", () => {
    const result = proposeTaxonomy({
      playlistTitle: "JEE Class 11 Physics Complete Course",
      playlistDescription: "Faculty: Alakh Pandey",
      videoTitles: ["Kinematics lecture 1"],
    }, taxonomy);

    expect(result.decisions.teacher_id).toMatchObject({
      value: 34,
      status: "review",
      requiresReview: true,
    });
    expect(result.summary.reviewFields).toContain("teacher_id");
    expect(result.summary.autoFields).not.toContain("teacher_id");
  });

  it("keeps teacher identification in review when the registry has no match", () => {
    const result = proposeTaxonomy({
      playlistTitle: "JEE Class 11 Physics Complete Course",
      playlistDescription: "Faculty: Unknown Person",
    }, taxonomy);

    expect(result.decisions.teacher_id).toMatchObject({
      value: null,
      status: "review",
      candidates: [],
    });
    expect(result.summary.manualFields).toEqual(["chapter_id", "category_id", "board_ids"]);
  });
});
