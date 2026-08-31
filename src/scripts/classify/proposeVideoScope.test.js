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

  it("ignores generic quiz promotions in lecture descriptions and tags", () => {
    expect(proposeVideoScope({
      title: "Plant Kingdom L-3 | Pteridophytes",
      description: "Play a quick quiz after this lecture.",
      tags: ["Vani Sood", "Menti Quiz"],
    })).toEqual({
      requiresReview: false,
      proposed_action: null,
      evidence: "no supplement or assessment scope signal",
      signals: [],
    });
  });

  it("ignores DPP homework references in ordinary lecture descriptions", () => {
    expect(proposeVideoScope({
      title: "Photosynthesis in One Shot | Class 11 NCERT Crash Course",
      description: "Watch the complete lecture, then solve the DPP provided after class.",
      tags: ["biology", "neet"],
    })).toEqual({
      requiresReview: false,
      proposed_action: null,
      evidence: "no supplement or assessment scope signal",
      signals: [],
    });
  });

  it("flags an appended one-shot revision for explicit scope review", () => {
    expect(proposeVideoScope({
      title: "Electrostatics One Shot Revision Part 1 | Coulomb's Law and Electric Field",
    }).signals).toEqual([
      { code: "one-shot-revision", label: "one-shot revision supplement" },
    ]);
  });

  it("flags a promotional giveaway for explicit scope review", () => {
    expect(proposeVideoScope({
      title: "Human Physiology Power Notes | Free Giveaway | NEET 2024",
    }).signals).toEqual([
      { code: "promotional-giveaway", label: "promotional giveaway" },
    ]);
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
