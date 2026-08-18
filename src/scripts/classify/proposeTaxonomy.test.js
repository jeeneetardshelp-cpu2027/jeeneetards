import { describe, expect, it } from "vitest";
import { proposeBoards, proposeCategory, proposeTaxonomy } from "./proposeTaxonomy.js";

const taxonomy = {
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  categories: [{ id: 20, name: "JEE", slug: "jee" }],
  categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
  boards: [{ id: 30, name: "CBSE", slug: "cbse" }],
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
    expect(result.decisions.category_id).toMatchObject({ value: 20, status: "auto" });
    expect(result.decisions.board_ids).toMatchObject({ value: [], status: "auto" });
    expect(result.summary.manualFields).toEqual([]);
    expect(result.decisions).not.toHaveProperty("chapter_id");
  });
});

describe("live category and board taxonomy", () => {
  it("requires review when a goal has more than one legal category", () => {
    const proposal = proposeCategory(
      { value: 10, slug: "jee" },
      [{ id: 20, name: "JEE", slug: "jee" }, { id: 21, name: "Advanced", slug: "advanced" }],
      [
        { category_id: 20, learning_goal_id: 10 },
        { category_id: 21, learning_goal_id: 10 },
      ],
    );
    expect(proposal).toMatchObject({ value: null, requiresReview: true });
    expect(proposal.candidates).toHaveLength(2);
  });

  it("keeps School boards under review but auto-confirms an empty non-School list", () => {
    const boards = [{ id: 30, name: "CBSE", slug: "cbse" }];
    expect(proposeBoards({ value: 10, slug: "jee" }, boards)).toMatchObject({
      value: [],
      confidence: 0.9,
    });
    expect(proposeBoards({ value: 11, slug: "school" }, boards)).toMatchObject({
      value: [],
      requiresReview: true,
      candidates: boards,
    });
  });
});
