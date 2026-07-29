import { describe, expect, it } from "vitest";
import {
  rowsNeedingLLM,
  buildSchema,
  buildPrompt,
  mergeLlmProposals,
  proposeWithLLM,
} from "./mapChaptersLLM.js";

const CHAPTERS = ["Circles", "Areas Related to Circles", "Body Fluids and Circulation"];

const row = (over = {}) => ({
  position: 1, youtube_video_id: "v1", title: "T", chapter: null,
  confidence: 0, review: true, reason: "", alternatives: [], ...over,
});

describe("rowsNeedingLLM", () => {
  it("sends only flagged or unmatched rows", () => {
    const rows = [
      row({ position: 1, chapter: "Circles", review: false }), // confident — skip
      row({ position: 2, chapter: "Circles", review: true }),  // ambiguous — send
      row({ position: 3, chapter: null }),                     // unmatched — send
    ];
    expect(rowsNeedingLLM(rows).map((r) => r.position)).toEqual([2, 3]);
  });
});

describe("buildSchema", () => {
  it("constrains chapter to the real chapter names or null", () => {
    const schema = buildSchema(CHAPTERS);
    const chapter = schema.properties.assignments.items.properties.chapter;
    expect(chapter.anyOf[0].enum).toEqual(CHAPTERS);
    expect(chapter.anyOf[1]).toEqual({ type: "null" });
  });

  it("forbids extra properties (required by structured outputs)", () => {
    const schema = buildSchema(CHAPTERS);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.assignments.items.additionalProperties).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("lists every chapter and every video with its position", () => {
    const p = buildPrompt([row({ position: 7, title: "Cardiac Cycle in 1 Shot" })], CHAPTERS);
    for (const c of CHAPTERS) expect(p).toContain(c);
    expect(p).toContain("position 7: Cardiac Cycle in 1 Shot");
  });
});

describe("mergeLlmProposals", () => {
  it("applies a high-confidence mapping and clears the review flag", () => {
    const rows = [row({ position: 1, title: "Cardiac Cycle" })];
    const merged = mergeLlmProposals(rows, [
      { position: 1, chapter: "Body Fluids and Circulation", confidence: "high", reason: "cardiac cycle is circulation" },
    ]);
    expect(merged[0].chapter).toBe("Body Fluids and Circulation");
    expect(merged[0].review).toBe(false);
    expect(merged[0].source).toBe("llm");
  });

  it("keeps low/medium confidence flagged for a human", () => {
    const merged = mergeLlmProposals([row()], [
      { position: 1, chapter: "Circles", confidence: "low", reason: "guess" },
    ]);
    expect(merged[0].review).toBe(true);
  });

  it("keeps a null answer flagged rather than inventing a chapter", () => {
    const merged = mergeLlmProposals([row({ title: "Pad Parichay grammar" })], [
      { position: 1, chapter: null, confidence: "high", reason: "grammar topic, not a chapter" },
    ]);
    expect(merged[0].chapter).toBeNull();
    expect(merged[0].review).toBe(true);
  });

  it("never overwrites a row the rules pass mapped confidently", () => {
    const rows = [row({ position: 1, chapter: "Circles", review: false })];
    const merged = mergeLlmProposals(rows, [
      { position: 1, chapter: "Areas Related to Circles", confidence: "high", reason: "..." },
    ]);
    expect(merged[0].chapter).toBe("Circles");
    expect(merged[0].source).toBeUndefined();
  });

  it("leaves rows the model did not answer untouched", () => {
    const merged = mergeLlmProposals([row({ position: 9 })], []);
    expect(merged[0].chapter).toBeNull();
  });
});

describe("proposeWithLLM", () => {
  const fakeClient = (response) => ({ messages: { create: async () => response } });

  it("does not call the API when nothing needs review", async () => {
    let called = false;
    const client = { messages: { create: async () => { called = true; } } };
    const rows = [row({ chapter: "Circles", review: false })];
    const out = await proposeWithLLM(client, rows, CHAPTERS);
    expect(called).toBe(false);
    expect(out.called).toBe(false);
  });

  it("maps flagged rows from a well-formed response", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ assignments: [
        { position: 1, chapter: "Areas Related to Circles", confidence: "high", reason: "plural variant" },
      ] }) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const out = await proposeWithLLM(client, [row({ title: "Area Related to Circles" })], CHAPTERS);
    expect(out.rows[0].chapter).toBe("Areas Related to Circles");
    expect(out.rows[0].review).toBe(false);
  });

  it("degrades to rules-only on a refusal instead of throwing", async () => {
    // A refusal returns HTTP 200 with empty content — reading content[0] would throw.
    const client = fakeClient({ stop_reason: "refusal", content: [], usage: {} });
    const rows = [row()];
    const out = await proposeWithLLM(client, rows, CHAPTERS);
    expect(out.refused).toBe(true);
    expect(out.rows).toBe(rows);
  });

  it("degrades to rules-only on unparseable output", async () => {
    const client = fakeClient({
      stop_reason: "end_turn", content: [{ type: "text", text: "not json" }], usage: {},
    });
    const out = await proposeWithLLM(client, [row()], CHAPTERS);
    expect(out.parseError).toBe(true);
    expect(out.rows[0].chapter).toBeNull();
  });
});
