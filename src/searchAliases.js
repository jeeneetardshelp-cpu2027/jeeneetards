// searchAliases.js — what a student types, in the words they actually use.
//
// The catalogue is written in English, so universal_search only matches
// English. The audience is Indian students, and a good many of them type the
// Hindi name of the subject. Measured against production on 2026-09-02:
//
//     rasayan      0 rows      chemistry    27 rows
//     bhautiki     0 rows      physics      27 rows
//     jeev vigyan  0 rows      biology      21 rows
//     pw           0 rows      physics wallah 2 rows
//     ganit        6 rows, none of them mathematics — it matched "Gangue"
//                             inside lecture titles, which is worse than
//                             nothing because it looks like an answer
//
// So the word is rewritten to its English equivalent before the query is sent.
// This is NOT a second search surface: universal_search remains the only one,
// and it is asked a better question.
//
// TWO RULES keep this honest.
//
// 1. Only an EXACT match expands. "rasayan" becomes "chemistry"; "rasayan ka
//    question" is passed through untouched, because a partial rewrite would be
//    guessing at what the rest of the sentence meant. A query that is not in
//    this table reaches the RPC exactly as typed, so nothing that works today
//    can start behaving differently.
//
// 2. Every target names something that EXISTS in the catalogue — one of the
//    nine subjects, or an institute in institutes_channels. Mapping a word to
//    a subject the site does not carry would trade "no results" for "no
//    results, slower". Each target was checked against production; see
//    searchAliases.test.js, which pins the targets so a later edit cannot
//    quietly point one at nothing.

/** lowercase, trimmed, internal runs of whitespace collapsed. */
const normalise = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Latin transliterations and the Devanagari spellings, because a phone
// keyboard set to Hindi produces the latter. Only subjects the catalogue
// actually has: physics, chemistry, mathematics, biology, science, english,
// social science, and the two Hindi papers.
const SUBJECT_ALIASES = {
  chemistry: ["rasayan", "rasayan vigyan", "rasayan shastra", "रसायन", "रसायन विज्ञान"],
  physics: ["bhautiki", "bhautik vigyan", "bhautik shastra", "भौतिकी", "भौतिक विज्ञान"],
  biology: ["jeev vigyan", "jiv vigyan", "jeevvigyan", "जीव विज्ञान", "जीवविज्ञान"],
  mathematics: ["ganit", "गणित"],
  science: ["vigyan", "विज्ञान"],
  english: ["angreji", "angrezi", "अंग्रेजी"],
  "social science": ["samajik vigyan", "सामाजिक विज्ञान"],
};

// Institute short names students type instead of the registered name. Kept
// deliberately small: each one is a name in institutes_channels, and an
// invented abbreviation would send a student somewhere that does not exist.
const INSTITUTE_ALIASES = {
  "physics wallah": ["pw"],
};

const TABLE = new Map();
for (const [target, aliases] of Object.entries({ ...SUBJECT_ALIASES, ...INSTITUTE_ALIASES })) {
  for (const alias of aliases) TABLE.set(normalise(alias), target);
}

/** Every alias the table knows, for tests and for the record. */
export const SEARCH_ALIASES = TABLE;

/**
 * The query to send to universal_search.
 *
 * Returns the English equivalent when the whole query is a known alias, and
 * the original string — untouched, not normalised — otherwise.
 */
export function expandSearchQuery(query) {
  return TABLE.get(normalise(query)) ?? query;
}

/**
 * The alias that was expanded, or null. Separate from expandSearchQuery so a
 * caller can tell a student what was searched without re-deriving it, and so
 * the two can never disagree.
 */
export function expandedFrom(query) {
  const target = TABLE.get(normalise(query));
  return target && normalise(query) !== normalise(target) ? target : null;
}
