// The Devanagari script test behind lang="hi".
//
// The catalogue really does carry Devanagari titles — "कबीर की साखी",
// "हिंदी दसवीं" — while index.html declares lang="en". Marking those strings
// is what stops a screen reader reading them with English phonetics.
import { describe, expect, it } from "vitest";
import { hasDevanagari, langAttrs } from "./lang.js";

describe("Devanagari detection", () => {
  it("recognises real catalogue titles", () => {
    expect(hasDevanagari("कबीर की साखी")).toBe(true);
    expect(hasDevanagari("हिंदी दसवीं")).toBe(true);
    // A single Devanagari character anywhere is enough.
    expect(hasDevanagari("Class 10 हिंदी")).toBe(true);
    // Devanagari Extended (vedic marks), used by Sanskrit material.
    expect(hasDevanagari("꣠")).toBe(true);
  });

  it("leaves Latin and other scripts alone", () => {
    expect(hasDevanagari("Complete Kinematics")).toBe(false);
    expect(hasDevanagari("JEE Advanced 2015 Paper 1")).toBe(false);
    expect(hasDevanagari("")).toBe(false);
    // Bengali sits next to Devanagari in Unicode; it must not be caught.
    expect(hasDevanagari("বাংলা")).toBe(false);
  });

  it("never throws on the values a card can actually be handed", () => {
    expect(hasDevanagari(null)).toBe(false);
    expect(hasDevanagari(undefined)).toBe(false);
    expect(hasDevanagari(42)).toBe(false);
    expect(hasDevanagari({})).toBe(false);
  });
});

describe("langAttrs", () => {
  it("tags Devanagari as Hindi and stays silent otherwise", () => {
    expect(langAttrs("कबीर की साखी")).toEqual({ lang: "hi" });
    // Empty, so the document's own lang keeps applying — nothing is guessed.
    expect(langAttrs("Complete Kinematics")).toEqual({});
    expect(langAttrs(null)).toEqual({});
  });

  it("is spreadable onto an element without adding anything else", () => {
    expect(Object.keys(langAttrs("हिंदी"))).toEqual(["lang"]);
    expect(Object.keys(langAttrs("Physics"))).toEqual([]);
  });

  // Documented limit, asserted so nobody later believes it does more than it
  // does: transliterated Hindi is invisible to a Unicode-range test.
  it("does not pretend to detect Hindi written in Latin letters", () => {
    expect(langAttrs("Hindi Dasvin")).toEqual({});
  });
});
