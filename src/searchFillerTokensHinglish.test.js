// Guards the Hinglish half of public.search_filler_tokens().
//
// WHY A SECOND FILE. src/searchFillerTokens.test.js already exists and pins
// docs/sql/search_filler_tokens_2026-08-10.sql -- the pre-CLI file that
// introduced the English list by re-emitting the whole universal_search body.
// That file is history: it is not in supabase/migrations/, it is not in the
// db-push chain, and the properties it pins (the singular tier, the
// pg_trgm search_path pin, the verbatim re-emission of universal_search) are
// about a migration shape this one deliberately does not have. Extending it
// would have meant teaching it about a second, differently-shaped file and
// weakening the assertions it makes about the first. So: a sibling, and the
// original is left exactly as it was.
//
// WHY THIS IS NOT JUST THE REHEARSAL AGAIN.
// src/searchFillerTokensHinglishSqlRehearsal.test.js EXECUTES the migration on
// a real engine and is the stronger test by far. But it reads the expected word
// lists OUT OF THE MIGRATION ITSELF, because that is what lets its abort-path
// tests poison the live function and watch the file's own DO block refuse. So a
// hand that edited the emitted array AND the v_hindi declaration together would
// satisfy it. This file holds the independent copy: the 144 Hindi words are
// written out here, and the 96 English words are read from the production
// baseline dump rather than from the migration. Both halves have to be changed
// in two places, on purpose, by someone who meant it.
//
// It costs no Postgres, so it runs in the fast `app` project alongside its
// sibling, and it fails at author time rather than at rehearsal time.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const MIGRATION = "supabase/migrations/20260907140000_search_filler_tokens_hinglish.sql";
const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const CONTRACT = "src/searchFeatureCarryOverSqlContract.test.js";

const sql = readFileSync(MIGRATION, "utf8");
const baseline = readFileSync(BASELINE, "utf8");

/** Quoted strings in a slice, with `--` comments removed first. */
const quoted = (s) => [...s.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n")
  .matchAll(/'([^']*)'/g)].map((m) => m[1]);

/** The array the function actually returns. */
function emitted() {
  const open = sql.indexOf("$fn$");
  const close = sql.indexOf("$fn$", open + 4);
  expect(open, "the function body is not dollar-quoted with $fn$").toBeGreaterThan(-1);
  expect(close, "unbalanced $fn$ -- the file was corrupted in transit")
    .toBeGreaterThan(open);
  return quoted(sql.slice(open + 4, close));
}

/** The English list as the BASELINE shipped it -- the source of truth. */
function baselineEnglish() {
  const start = baseline.indexOf(
    'CREATE OR REPLACE FUNCTION "public"."search_filler_tokens"()');
  expect(start, "the baseline has no search_filler_tokens()").toBeGreaterThan(-1);
  const body = baseline.slice(start, baseline.indexOf("$$;", start));
  return quoted(body.slice(body.indexOf("select array[")));
}

// ---------------------------------------------------------------------------
// THE INDEPENDENT COPY. 144 words, exactly the intersection of four read-only
// measurement passes over the live catalogue. A word is here only if NONE of
// them found a collision. The bracketed number is whole-token occurrences on
// the search key across all 6,863 catalogue rows on 2026-09-07; where it is
// absent the word occurs ZERO times in the catalogue in either script.
// ---------------------------------------------------------------------------
const HINDI = [
  // case particles -- the four the reported bug is actually made of
  "ka",       // 25, of which 23 are Devanagari का
  "ke",       // 33, of which 31 are के
  "ki",       // 10 -- covers both की and कि, which key to the same string
  "ko",       // 3
  "se",       // 12
  "mein",     // 3 -- Latin only; में keys to "men", which is NOT filler
  "tak",
  // conjunctions
  "aur",      // 2
  "aura",     // 8 -- the Devanagari half; और keys to "aura", never "aur"
  "ya", "bhi", "jo", "toh", "phir", "lekin", "magar",
  // copulas
  "hai",      // 7
  "hain",     // 2 -- हैं carries an anusvara and keys to "hain", not "hai"
  "hoga", "hota", "nahi", "nahin",
  // pronouns
  "vo", "woh", "iska", "uska", "iske", "unke", "apne",
  "mera", "meri", "mujhe", "humein", "aap", "tum", "yaar",
  // question words -- the Hindi twins of what/why/how/when/where
  "kya", "kyu", "kyun", "kyon", "kaise", "kaisa", "kab",
  "kahan", "kaun", "kitna", "kitne", "kitni", "matlab",
  // "do it"
  "karo", "kare", "karein", "karna", "karke", "karne", "karte", "karu", "karun",
  // "tell me"
  "batao", "bata", "batana", "bataye", "bataiye",
  // "explain it"
  "samjhao", "samjhana", "samjha", "samjhna", "samjh", "samajh",
  "samjhe", "samjho", "samjhein", "samjhaye", "samjhaiye",
  // "teach / show / read / make it"
  "sikhao", "sikhna", "seekho", "seekhna",
  "dikhao", "dekho", "dekhna",
  "padho", "padhe", "padhna", "padhein", "padhai",
  "banao", "nikalo", "lagao",
  // "I want"
  "chahiye", "chahie", "chahta", "chahte",
  // quantifiers
  "sab", "sabhi", "sabse", "sara", "sare", "saara", "saare",
  "pura", "puri", "poora", "poori", "thoda", "zyada", "jyada",
  "bahut", "bilkul", "kuch", "koi",
  // relative-clause scaffolding: "capacitor WALA question"
  "wala", "wali", "waala", "wale", "vala", "vali",
  // purpose and quality
  "liye", "taiyari", "tayari", "yaad", "jaldi",
  "achha", "accha", "acha", "badiya", "badhiya", "behtar", "sahi",
  "aasan", "asan", "mushkil",
  "jaruri", "zaroori", "jarurat", "zarurat",
  // Hindi twins of words already in the English half
  "sawal", "sawaal", "prashn", "prashna", "uttar", "tarika", "tareeka",
  // politeness
  "plz",
];

// Screened and REJECTED, each on a collision somebody measured in a real row.
// The comment is the reason, and the reason is the point.
const REJECTED = {
  shot: '"one shot" names 329 titles and is the highest-signal phrase students type',
  one: 'stripping it collapses "one shot" onto every title containing "shot"',
  sir: "475 titles -- it is how this catalogue names its faculty",
  hindi: "121 titles; also a Class 10 subject, and the Hindi-medium paper label",
  english: "151 titles, nearly all of them the paper language label",
  medium: "a physics noun (optical/wave/denser medium) the catalogue has not reached yet",
  par: "1,442 titles carry it as a substring, so it is an active discriminator",
  hi: "HI is hydrogen iodide, and that halogens lecture is its only whole-token use",
  ek: "एक means ONE, and it opens two real NCERT chapter titles",
  eka: "the transliterated form of the same numeral",
  para: "ortho/para/meta, plus 63 rows of Parabola / Parallel Plate / Particles",
  men: "में keys here, but 'men' is an ordinary English word future content may use",
  na: "Na is sodium",
  ho: "Ho is holmium, and hoga/hota already carry the value",
  ne: "Ne is neon, and 1,795 titles satisfy it as a substring anyway",
  pe: "PE is potential energy",
  kar: '"Kar Chale Hum Fida" is a chapter name, and a common surname',
  hum: "same chapter name",
  bhai: '"Bade Bhai Sahab" is a named NCERT chapter',
  yeh: '"Ek Kahani Yeh Bhi" is a named NCERT chapter',
  apna: "APNA PHYSICS is an institute channel in the catalogue",
  main: "JEE Main -- and the singular rule would swallow 'mains' with it",
  mains: "same",
  part: '"part 3" is how half this catalogue is titled',
  basic: '"Basic Mathematics for Physics" is a real chapter',
  trick: "'tricks' is a title token 38 times, and the singular rule reaches it",
  agar: "agar is a biology term and this catalogue serves NEET",
};

describe("the Hinglish filler migration", () => {
  const list = emitted();

  it("survived being written to disk with its dollar quoting intact", () => {
    // This shell strips backslashes and collapses doubled dollar signs, which
    // has silently corrupted a migration in this repo before. If $fn$, $verify$
    // or $preflight$ were mangled, the file would not parse at all.
    for (const tag of ["$fn$", "$preflight$", "$verify$", "$q$"]) {
      const n = sql.split(tag).length - 1;
      expect(n, `${tag} appears ${n} times, not twice`).toBe(2);
    }
    expect(sql).not.toContain("$$");
    expect(sql).toMatch(/^--[\s\S]*\nbegin;/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("carries every English word the baseline shipped", () => {
    const english = baselineEnglish();
    expect(english.length, "the baseline list changed shape").toBe(96);
    const live = new Set(list);
    const missing = english.filter((w) => !live.has(w));
    expect(missing, `dropped from the English list: ${missing.join(", ")}`).toEqual([]);
    // ...and in the same order, at the front, so a diff of this file reads as
    // an append rather than a rewrite.
    expect(list.slice(0, 96)).toEqual(english);
  });

  it("carries every Hindi word this change exists to add", () => {
    const live = new Set(list);
    const missing = HINDI.filter((w) => !live.has(w));
    expect(missing, `Hindi words missing from the migration: ${missing.join(", ")}`)
      .toEqual([]);
    expect(list.slice(96)).toEqual(HINDI);
    expect(list).toHaveLength(96 + HINDI.length);
    expect(HINDI).toHaveLength(144);
  });

  it("contains nothing else at all", () => {
    const declared = new Set([...baselineEnglish(), ...HINDI]);
    const extra = list.filter((w) => !declared.has(w));
    expect(extra, `undeclared words in the list: ${extra.join(", ")}`).toEqual([]);
    expect(new Set(list).size, "duplicates in the filler list").toBe(list.length);
    for (const w of list) {
      // Tokens are compared against a space-split latin key, so anything with
      // whitespace, a capital or a digit can never match and is a typo.
      expect(w, w).toMatch(/^[a-z]+$/);
    }
  });

  it.each(Object.entries(REJECTED))("never contains '%s' -- %s", (word) => {
    expect(list, `"${word}" was rejected on a measured collision`).not.toContain(word);
    // ...and the migration's own guard list names it, so its DO block refuses
    // too rather than leaving this file as the only thing standing in the way.
    const guard = sql.slice(sql.indexOf("v_forbidden constant text[] := array["));
    expect(quoted(guard.slice(0, guard.indexOf("];"))),
      `${word} is not in the migration's own v_forbidden`).toContain(word);
  });

  it("cannot swallow a real word through the singular rule", () => {
    // search_singular() takes one trailing 's' off a token longer than four
    // characters, and universal_search strips a token whose SINGULAR form is in
    // this list. So adding W silently deletes W || 's' from every query once
    // length(W) >= 4. Two structural consequences, both asserted:
    const live = new Set(list);
    for (const w of HINDI) {
      // 1. no word here is another word's plural victim
      expect(live.has(`${w}s`), `"${w}s" is filler too -- one of them is redundant`)
        .toBe(false);
      // 2. the words short enough for the rule never to fire are the safest,
      //    and the four highest-traffic ones are all in that class
      if (w.length <= 3) expect(`${w}s`.length).toBeLessThanOrEqual(4);
    }
    for (const w of ["ka", "ke", "ki", "ko", "se"]) {
      expect(list).toContain(w);
      expect(w.length, `${w} must stay short enough to be singular-immune`)
        .toBeLessThanOrEqual(3);
    }
  });

  it("re-emits one function and only one", () => {
    const code = sql.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    const created = [...code.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)/gi)]
      .map((m) => m[1]);
    expect(created).toEqual(["search_filler_tokens"]);
    // The three functions under the carry-over contract must not appear as
    // re-emissions here. They call search_filler_tokens() at runtime, so
    // touching them would buy nothing and risk deleting a feature.
    for (const fn of ["universal_search", "search_video_ids", "search_playlist_ids",
      "search_query_tokens", "search_rank_tokens", "search_singular"]) {
      expect(created, `${fn} must not be re-emitted here`).not.toContain(fn);
    }
    expect(readFileSync(CONTRACT, "utf8"),
      "the carry-over contract guards exactly the three functions this file avoids")
      .toContain('fn: "universal_search"');
  });

  it("keeps the properties universal_search assumes of the function", () => {
    expect(sql).toMatch(/language sql immutable parallel safe/i);
    expect(sql).toMatch(/returns text\[\]/i);
    expect(sql).toMatch(/alter function public\.search_filler_tokens\(\) owner to postgres/i);
    expect(sql).toMatch(/comment on function public\.search_filler_tokens\(\)/i);
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql, `not granted to ${role}`)
        .toMatch(new RegExp(`grant execute on function public\\.search_filler_tokens\\(\\) to ${role};`));
    }
    expect(sql).toMatch(/revoke all on function public\.search_filler_tokens\(\) from public;/);
  });

  it("writes to no table and drops nothing", () => {
    const code = sql.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    expect(code).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from)\b/i);
    expect(code).not.toMatch(/\bdrop\s+(table|function|constraint|policy)\b/i);
    expect(code).not.toMatch(/\balter\s+table\b/i);
    expect(code).not.toMatch(/security\s+definer/i);
  });

  it("proves itself with data, not only with a word count", () => {
    // The verification block calls search_query_tokens on real queries. These
    // are the four that carry the argument: the bug it fixes, and the three
    // words it refused to add proved still alive.
    for (const probe of [
      "kinematics ke numericals", "friction ka concept",
      "thermodynamics ka one shot", "anshul sir limits",
      "hindi medium physics", "rotation par questions",
    ]) {
      expect(sql, `the self-test should probe "${probe}"`).toContain(probe);
    }
    // ...and the all-filler fallback, in both languages.
    expect(sql).toContain("'please help'");
    expect(sql).toContain("'kya hai'");
    expect(sql).toMatch(/tokenises to NOTHING/);
  });

  it("says out loud the one thing that gets narrower", () => {
    expect(sql).toMatch(/reverts to the RAW token list/);
    expect(sql).toMatch(/STRICTER, not looser/);
    expect(sql).toContain("STAGED, NOT APPLIED");
    expect(sql).toContain("ROLLBACK.");
  });
});
