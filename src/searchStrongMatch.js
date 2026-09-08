// searchStrongMatch.js — "does this title actually contain what was typed?"
//
// WHY THIS EXISTS. The search RPCs are deliberately fuzzy: search_video_ids and
// search_playlist_ids rank with trigram similarity so that "kinamatics" still
// finds Kinematics and "mechanic" still finds Mechanics. That tier is what
// makes typo tolerance work for every student on every query, and a
// three-way investigation (see docs) decided against narrowing it in SQL —
// every threshold that removed the loose matches also killed real typos, and a
// removed row produces no error and no complaint, only a smaller number.
//
// So the loose matches STAY in the result set. What changed is the ORDER they
// are shown in on a sort that is not relevance. Measured on production
// 2026-09-08, /browse lecture search:
//
//     query               rows   titles that literally match
//     kinematics           172        38
//     friction problems     47        18
//     trigonometry          91        91   (everything — a literal no-op)
//     kinamatics            38         0   (nothing  — a literal no-op)
//
// Under "Shortest first" the whole first page of "kinematics" was Kinetic
// Theory of Gases clips, because "shortest" was applied to everything that
// fuzzy-matched rather than to the rows that actually match. This module
// supplies the test that splits those 172 rows into 38 + 134 so the 38 can be
// shown first — WITHOUT removing anything.
//
// The two no-op rows above are the guard: when the strong block is everything
// or nothing, the concatenation below is provably the input array unchanged.

/**
 * A title reduced to the alphabet the tokens are written in.
 *
 * NFKD then strip: the catalogue carries em dashes, "#7", "|", Devanagari and
 * the occasional combining accent, none of which a token can contain.
 */
export function normalizeTitleForMatch(title) {
  return String(title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does `title` contain EVERY content token?
 *
 * Long tokens match on a 70% prefix (minimum 4 characters) rather than whole,
 * so that the morphology the ranker is right about survives: "kinematics"
 * matches "Kinematic", "integration" matches "Integrals". Short tokens have no
 * prefix to spare and must appear whole.
 *
 * FLOOR, NOT CEIL, and the difference is a whole word. ceil(11 * 0.7) = 8 makes
 * the prefix for "integration" be "integrat", and "integrals" diverges at
 * exactly character 8 — so the second example above was FALSE of the code that
 * first shipped it. Measured on production 8 Sep 2026, that cost real lessons
 * the demotion this file exists to prevent:
 *
 *     query               rows   strong (ceil)   strong (floor)
 *     integration          323        228            246   +18 "integral" titles
 *     capacitance           45          9             31   +22, incl. "Parallel
 *                                                          Plate Capacitor"
 *     atomic structure      49         41             49   +8 "Structure of Atom"
 *     kinematics           172         38             38   unchanged
 *     friction problems     47         18             18   unchanged
 *     trigonometry          91         91             91   unchanged (no-op)
 *     kinamatics            38          0              0   unchanged (no-op)
 *
 * Under "Shortest first" the ceil version pushed the shortest lesson in the
 * whole "integration" match set from position 1 to 229 — page 1 to page 10 —
 * which is precisely the harm this partition was written to stop. Ten further
 * queries in that sweep were byte-identical either way, so floor is strictly
 * the better cut here: it never shrinks a strong block, and the four acceptance
 * cases do not move.
 *
 * EMPTY TOKENS ARE NOT A MATCH. `[].every()` is true, which would silently
 * call every row strong the moment the tokens RPC failed; callers check
 * `tokens.length` and skip the whole partition instead, so an unavailable
 * tokeniser leaves the page exactly as it is today rather than inventing a
 * block that means nothing.
 */
export function isStrongTitleMatch(title, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  const haystack = normalizeTitleForMatch(title);
  return tokens.every((token) =>
    token.length < 4
      ? haystack.includes(token)
      : haystack.includes(token.slice(0, Math.max(4, Math.floor(token.length * 0.7)))));
}

/**
 * Split rows into the ones whose title literally matches and the ones the
 * fuzzy tier brought along, PRESERVING THE ORDER OF THE INPUT within each.
 *
 * That order preservation is the whole design. The rows arrive already sorted
 * by the database in the order the student asked for, so two order-preserving
 * passes give "shortest among the real matches, then shortest among the rest"
 * without this file knowing anything about durations, nulls or collations —
 * see the note in useBrowse.js on why re-deriving the comparator in JS would
 * be the wrong half of the wire to do it on.
 */
export function partitionByStrength(rows, tokens, titleOf = (row) => row?.title) {
  const strong = [];
  const weak = [];
  for (const row of rows) {
    (isStrongTitleMatch(titleOf(row), tokens) ? strong : weak).push(row);
  }
  return { strong, weak };
}

/**
 * The query's content tokens, AS THE SERVER TOKENISES THEM.
 *
 * search_query_tokens is the same helper universal_search and both browse RPCs
 * call, so the tokens tested against titles here are exactly the tokens the
 * ranking was computed from. Re-deriving them in JS is the two-sides-of-the-
 * wire drift this codebase has been bitten by before, and it is not a
 * hypothetical: measured against the production fixture in
 * src/__fixtures__/searchStrongMatch.production.json, "friction problems"
 * tokenises SERVER-SIDE to ["friction"] — "problem" is filler — and finds 18
 * strong titles. A JS `split(/\s+/)` yields ["friction","problems"] and finds
 * ZERO, because no title contains both words. The naive version does not
 * degrade the fix, it deletes it.
 *
 * A failure here is not an error for the student: it returns no tokens, the
 * caller skips the partition, and the page behaves exactly as it did before
 * this feature existed.
 */
export async function fetchSearchQueryTokens(client, term) {
  try {
    const { data, error } = await client.rpc("search_query_tokens", { p_query: term });
    if (error) return [];
    const row = Array.isArray(data) ? data[0] : data;
    const tokens = row?.q_tokens;
    if (!Array.isArray(tokens)) return [];
    return tokens.filter((token) => typeof token === "string" && token.length > 0);
  } catch {
    return [];
  }
}
