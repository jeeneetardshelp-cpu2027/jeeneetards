import { describe, expect, it } from "vitest";
import { proposeVideoScope } from "./proposeVideoScope.js";

describe("per-video scope signals", () => {
  it("flags DPP quizzes for review without excluding them", () => {
    expect(proposeVideoScope({ title: "Work Energy & Power | DPP-2 | Physics quiz" }))
      .toMatchObject({
        requiresReview: true,
        proposed_action: null,
        signals: [{ code: "dpp" }, { code: "quiz" }],
      });
  });

  it("flags Menti and paper-discussion supplements", () => {
    expect(proposeVideoScope({ title: "Solutions Menti" }).signals)
      .toEqual([{ code: "quiz", label: "quiz/assessment" }]);
    expect(proposeVideoScope({ title: "NEET paper discussion" }).signals)
      .toEqual([{ code: "paper-discussion", label: "paper discussion" }]);
  });

  it("leaves ordinary lectures unflagged", () => {
    expect(proposeVideoScope({ title: "Work Energy and Power - L11" })).toEqual({
      requiresReview: false,
      proposed_action: null,
      evidence: "no supplement or assessment scope signal",
      signals: [],
    });
  });
});
