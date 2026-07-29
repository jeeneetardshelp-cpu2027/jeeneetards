// mapChaptersLLM.js — Phase 2b: an LLM pass for the rows the rules pass could
// not confidently map.
//
// The rules mapper (mapChapters.js) handles the easy majority for free and
// flags the rest. This module takes ONLY those flagged rows and asks Claude to
// pick the right chapter — the semantic cases rules can't do:
//
//   "Cardiac Cycle"            -> Body Fluids and Circulation
//   "Area Related to Circles"  -> Areas Related to Circles   (not "Circles")
//   "The Thief's Story"        -> The Thief's Story          (not the book name)
//   "Pad Parichay" (grammar)   -> null                       (not a chapter)
//
// It CANNOT invent a chapter: the response schema constrains `chapter` to an
// enum of the exact chapter names passed in, or null. That is a hard guarantee
// from the API, not a prompt instruction — the same "never invent taxonomy"
// rule the rules pass follows.
//
// The prompt/schema/merge helpers are pure so they can be tested without an API
// key; only proposeWithLLM() performs network I/O.

const MODEL = "claude-opus-5";
const MAX_TOKENS = 8000;
// The rules pass already handled the easy rows; these are the hard ones, so
// don't skimp — but they're short, so "medium" is the balance point. Tunable.
const EFFORT = "medium";

/** Rows worth sending: flagged for review, or matched nothing at all. */
export function rowsNeedingLLM(rows = []) {
  return rows.filter((r) => r.review || !r.chapter);
}

/**
 * Response schema. `chapter` is an enum of the real chapter names (or null),
 * so a hallucinated chapter is impossible by construction.
 */
export function buildSchema(chapters = []) {
  return {
    type: "object",
    properties: {
      assignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            position: { type: "integer" },
            chapter: {
              anyOf: [{ type: "string", enum: [...chapters] }, { type: "null" }],
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
          },
          required: ["position", "chapter", "confidence", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["assignments"],
    additionalProperties: false,
  };
}

export function buildPrompt(rows = [], chapters = []) {
  const chapterList = chapters.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const videoList = rows
    .map((r) => `position ${r.position}: ${r.title}`)
    .join("\n");
  return `You are mapping lecture videos to chapters in a curriculum catalogue.

CHAPTERS (choose only from this list):
${chapterList}

VIDEOS:
${videoList}

For each video, pick the chapter it teaches, or null if it is not a chapter
lecture at all.

Rules:
- Choose the MOST SPECIFIC matching chapter. If a title matches both a short
  chapter name and a longer one that contains it, choose the longer one.
- A title naming a topic WITHIN a chapter maps to that chapter (e.g. a lecture
  on the cardiac cycle belongs to the chapter covering circulation).
- A title naming a book, series, or playlist rather than a single chapter is
  not a chapter lecture unless a chapter has that exact name.
- Return null for: question banks, PYQs, MCQ-only videos, syllabus overviews,
  strategy/motivation talks, full-syllabus marathons, grammar or writing
  topics that are not in the chapter list, and anything you are unsure of.
- Titles may mix languages or scripts, and may contain typos or singular/plural
  variations of the chapter name. Match on meaning.
- Use confidence "low" when you are guessing; a human reviews those.

Return one entry per video, using the position numbers given above.`;
}

/** Fold the model's proposals back into the drafted rows. Pure. */
export function mergeLlmProposals(rows = [], proposals = []) {
  const byPosition = new Map(proposals.map((p) => [p.position, p]));
  return rows.map((row) => {
    const p = byPosition.get(row.position);
    if (!p) return row;
    // Never let the model overwrite a row the rules pass was confident about.
    if (!row.review && row.chapter) return row;
    return {
      ...row,
      chapter: p.chapter ?? null,
      confidence: p.confidence,
      // A high-confidence LLM answer still gets a human look when it changed
      // an unmatched row into a mapped one — assisted, not unattended.
      review: p.confidence !== "high" || !p.chapter,
      reason: `llm: ${p.reason}`,
      source: "llm",
    };
  });
}

/**
 * Ask Claude to map the flagged rows. Returns the merged rows.
 * @param client an Anthropic SDK client
 */
export async function proposeWithLLM(client, rows, chapters, opts = {}) {
  const pending = rowsNeedingLLM(rows);
  if (!pending.length) return { rows, called: false, usage: null };

  const response = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: MAX_TOKENS,
    output_config: {
      effort: opts.effort ?? EFFORT,
      format: { type: "json_schema", schema: buildSchema(chapters) },
    },
    messages: [{ role: "user", content: buildPrompt(pending, chapters) }],
  });

  // Guard BEFORE reading content: a refusal returns 200 with empty/partial
  // content, so indexing content[0] would throw.
  if (response.stop_reason === "refusal") {
    return {
      rows,
      called: true,
      refused: true,
      usage: response.usage ?? null,
      // Every unmapped row simply stays flagged for the human review step that
      // already exists — a refusal degrades to the rules-only behaviour.
    };
  }

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows, called: true, parseError: true, usage: response.usage ?? null };
  }

  return {
    rows: mergeLlmProposals(rows, parsed.assignments ?? []),
    called: true,
    usage: response.usage ?? null,
  };
}
