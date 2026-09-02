// hasReadableReview: is there anything to read in this review?
//
// On 2026-09-02 production held exactly one rating, and its review text was
// ",," — two commas. It rendered verbatim under "What students are saying" as
// the only thing any student had ever said about the site. The database check
// was `review is not null`, which is a different question from "did a human
// write something", and useVisibleReviews.js's own header already claimed it
// filtered to reviews that "has real text".
//
// The rating itself is untouched: three stars typed with no words is still
// three stars, and still counts towards the average. Only the quote goes.
import { describe, expect, it } from "vitest";
import { hasReadableReview } from "./useVisibleReviews.js";

describe("hasReadableReview", () => {
  it("rejects the exact string production was showing", () => {
    expect(hasReadableReview(",,")).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["a newline", "\n\n"],
    ["one full stop", "."],
    ["punctuation salad", "!!! ??? ,,, ---"],
    ["an ellipsis", "…"],
    ["emoji only", "🔥🔥"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 5],
  ])("rejects %s", (_label, value) => {
    expect(hasReadableReview(value)).toBe(false);
  });

  it.each([
    ["English", "Clear explanations."],
    ["one word", "Great"],
    ["a single letter", "a"],
    ["a digit", "10/10"],
    ["text with punctuation", ",,, actually useful ,,,"],
  ])("keeps %s", (_label, value) => {
    expect(hasReadableReview(value)).toBe(true);
  });

  // The audience writes in Hindi. A naive /[a-z0-9]/ test would have thrown
  // away every Devanagari review while keeping ",,", which is precisely
  // backwards — hence \p{L}, which covers any script.
  it.each([
    ["Devanagari", "बहुत अच्छा कोर्स है"],
    ["Hinglish in Latin script", "bahut accha hai"],
    ["a single Devanagari letter", "अ"],
  ])("keeps %s", (_label, value) => {
    expect(hasReadableReview(value)).toBe(true);
  });
});
