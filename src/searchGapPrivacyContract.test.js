// searchGapPrivacyContract.test.js
//
// src/legalTruth.test.js exists because the Privacy Policy once shipped two
// statements that were false in production: an allow-list of facts can only
// catch a fact someone REMEMBERED to add, so the checks that matter derive the
// fact from the CODE. This file does the same job for the search gap log, a
// NEW server-side path carrying free text a student typed.
//
// The policy does not name search_gap_log yet, and that is not an oversight to
// be fixed by an engineer alone: "whether advertising or audience analytics
// will be added" is listed in docs/legal_release_inputs.md as an owner
// decision. So the rule enforced here is the honest one available today —
// while the disclosure is missing, the migration must still be held back from
// `npx supabase db push`, which applies every pending migration at once.
//
// When the owner approves the feature and the policy paragraph lands, this
// test goes quiet on its own and the banner can be deleted from the migration.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

// Drop block and line comments so a scan reads the code, not the prose.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, "$1");

// The file deliberately does NOT live in supabase/migrations/. `db push`
// applies every pending migration at once, so leaving it there meant an
// unrelated migration could not ship without also switching on a data
// collection the owner has not agreed to. It waits outside the chain
// instead, and the guard below still holds: the hold marker must stay
// while the policy is silent. Moving it back is step one of shipping it.
const MIGRATION = "supabase/migrations/20260902210000_search_gap_log.sql";
const HOLD_MARKER = "DO NOT APPLY YET";
const TABLE = "search_gap_log";

describe("search gap log privacy contract", () => {
  // The MIRROR of the test below, and the one that was missing. The pairing
  // was only ever guarded in one direction: collecting without disclosing.
  // On 2026-09-02 the policy gained a section stating in the present tense
  // that search words "are sent to the server and kept" while the table 404'd
  // on production, because the migration is parked. legalTruth passed
  // throughout — it checks that a claim of absence is honest, not that a claim
  // of collection is. Over-claiming is still a false privacy policy.
  it("does not claim to collect search text while the migration is parked", () => {
    const policy = read("src/PrivacyPolicy.jsx");
    if (!policy.includes(TABLE)) return;      // says nothing; nothing to check

    const parked = existsSync(MIGRATION) && read(MIGRATION).includes(HOLD_MARKER);
    if (!parked) return;                      // shipped or approved; present tense is fine

    // Parked, yet described. The section must say plainly that it is not on
    // yet, or a reader is told their searches are being kept when they are not.
    const section = policy.slice(policy.indexOf("Searches that find nothing"));
    expect(
      /not switched on|will be sent|is not being recorded|not being recorded/i.test(section),
      "PrivacyPolicy.jsx describes search_gap_log in the present tense while the migration is parked",
    ).toBe(true);
  });

  // The inverse of the test above, needed because unparking made that one
  // inert: it returns early once the banner is gone, and the banner came off
  // on 2026-09-02 when the file moved into supabase/migrations/. From here on,
  // a push creates the table, so the policy must keep naming it.
  it("keeps naming the table once the migration is in the chain", () => {
    if (!MIGRATION.startsWith("supabase/migrations/")) return;  // still parked
    expect(existsSync(MIGRATION), `${MIGRATION} is missing`).toBe(true);
    expect(
      read("src/PrivacyPolicy.jsx"),
      "the migration is in the chain, so the policy must name search_gap_log",
    ).toContain(TABLE);
  });

  // THE PAIRING THAT WAS A HUMAN STEP, AND THEN WAS MISSED.
  //
  // The note that stood here said no test could know whether the table exists
  // in production, so rewording the policy at push time had to be a human
  // step. Both halves were right, and the human step was missed the same
  // evening: the migration was applied, which switched the feature on — there
  // is no flag in searchGapLog.js, so the RPC existing IS the feature being
  // live — and section 6 went on saying, in bold, "This is not switched on
  // yet. Nothing described in this section is being recorded today."
  //
  // Under-claiming is the dangerous direction. Over-claiming tells students to
  // self-censor a box that records nothing; under-claiming tells an audience
  // largely under 18 that their words are not kept while they are.
  //
  // Production is still unreachable from a test. But the repository DOES
  // record the answer: supabase/README.md is this chain's authority on what
  // has been applied, and it is updated in the same change that pushes. That
  // makes the pairing checkable after all — not against the database, but
  // against the one file that is supposed to mirror it. If someone pushes and
  // updates neither, the older tests still catch nothing; if they push and
  // update the README, this fails until the policy follows.
  it("matches the policy's tense to what the README says was applied", () => {
    const readme = read("supabase/README.md");
    const row = readme.split("\n").find((line) => line.includes(MIGRATION.split("/").pop()));
    if (!row) return;                         // not recorded yet; nothing to mirror

    const applied = /\*\*Applied\*\*/.test(row);
    const policy = read("src/PrivacyPolicy.jsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
    const section = policy.slice(policy.indexOf("Searches that find nothing"));
    const saysOff = /not switched on|not being recorded/i.test(section);

    if (applied) {
      expect(
        saysOff,
        "supabase/README.md records the search-gap-log migration as APPLIED, so the log " +
          "is collecting search text — but PrivacyPolicy.jsx still tells students it is " +
          "not switched on. Move section 6 (and the section 4 cross-reference) to the " +
          "present tense in the same change that records the push.",
      ).toBe(false);
    } else {
      expect(
        saysOff,
        "the migration is not recorded as applied, so the policy must keep saying the " +
          "log is not switched on yet",
      ).toBe(true);
    }
  });

  //
  // WHAT THE TEST BELOW CAN CHECK, and why it is worth having anyway. Both
  // checks above are gated on a fact about the migration — one on the hold
  // marker, one on the directory — and the hold marker is now gone, so the
  // tense of the disclosure is currently enforced by nothing at all. That is
  // precisely when it broke.
  //
  // On 2026-09-02, within an hour, two sessions wrote about the same moment.
  // Section 6 was corrected to the future tense after production was checked.
  // Section 4 gained a cross-reference — so "this list is never sent to a
  // server", about the device-local remembered searches, would not read as a
  // claim about searching in general — and that cross-reference said a failed
  // search's words "are sent to the server instead". Present tense, four
  // sections earlier. Each paragraph was right about itself. The rebase was
  // clean, every test passed, and the document was false.
  //
  // So the invariant here is not about the migration at all. It is INTERNAL
  // CONSISTENCY: whatever tense section 6 chooses, the rest of the policy must
  // agree with it. That holds before the push and after it, needs to know
  // nothing about production, and is the failure that actually happened.
  it("says the same thing about failed searches in every section", () => {
    const prose = read("src/PrivacyPolicy.jsx")
      // A JSX comment is never shown to a student, and the ones around that
      // very paragraph quote the banned wording in order to explain it.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
      .replace(/\s+/g, " ");

    const at = prose.indexOf("Searches that find nothing");
    if (at < 0) return;                       // no such section; nothing to agree with

    // Section 6's own framing decides what the rest of the document may say.
    const notYet = /not switched on|will be sent|not being recorded/i.test(prose.slice(at));
    if (!notYet) return;                      // section 6 is present tense; so may the rest be

    // Section 6 says it is not on yet, so nothing anywhere may assert that a
    // search's words leave the browser today. "will be sent" is the honest
    // future and does not match. "is never sent" does not match either — the
    // negation sits between the verb and the word. Only a bare "is/are sent to
    // the server" does, and the captured preceding word lets section 5's
    // legitimate "nothing is sent to the server" through.
    const offenders = prose
      .split(/(?<=\.)\s+/)
      .filter((sentence) => /search/i.test(sentence))
      .filter((sentence) =>
        [...sentence.matchAll(/(\w+)\s+(?:are|is)\s+sent to (?:the|a) server/gi)]
          .some(([, before]) => !/^(nothing|never|not)$/i.test(before)));

    expect(
      offenders,
      "PrivacyPolicy.jsx says in the present tense that searches are sent to the server, " +
        "while its own \"Searches that find nothing\" section says that is not switched on " +
        "yet. Both cannot be true. If the log has been pushed, reword section 6 to the " +
        "present tense in the same change; if it has not, use the future tense here too.",
    ).toEqual([]);
  });

  it("does not collect student search text before the policy says so", () => {
    const wired = read("src/useUniversalSearch.js").includes("scheduleSearchGapLog");
    if (!wired) return;                       // nothing is collected; nothing to disclose

    if (read("src/PrivacyPolicy.jsx").includes(TABLE)) return;   // disclosed — hold can lift

    // Not disclosed. The migration must still be marked un-pushable, by name,
    // so nobody runs `db push` and quietly starts collecting.
    const migration = read(MIGRATION);
    expect(migration).toContain(HOLD_MARKER);
    expect(migration).toContain("Privacy Policy");
  });

  it("keeps the policy and the migration on the same table name", () => {
    // A disclosure that names a different table is worse than none: it reads
    // as coverage. If the policy mentions this feature at all, it must use
    // the identifier the database actually uses.
    const privacy = read("src/PrivacyPolicy.jsx");
    if (!/search gap|zero-result|searches that found nothing/i.test(privacy)) return;
    expect(privacy).toContain(TABLE);
  });

  it("sends the query and a count, and has nowhere to put an identity", () => {
    const client = read("src/searchGapLog.js");
    // The RPC argument list, verbatim. Adding a third argument here means
    // adding a column there, and both should be a deliberate act.
    expect(client).toContain("{ p_query: term, p_result_count: resultCount }");
    // Comments are stripped first: the file's own header discusses "session
    // id" and "fingerprint" precisely to say it stores neither, and a scan
    // that failed on the promise rather than the code would be useless.
    const code = stripComments(client);
    for (const forbidden of [
      "user_id", "userId", "session", "auth.getUser", "getSession",
      "navigator.userAgent", "document.referrer", "fingerprint", "localStorage",
    ]) {
      expect(code, `searchGapLog.js must not touch ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("keeps every identity column out of the table itself", () => {
    const migration = read(MIGRATION);
    const create = migration.slice(
      migration.indexOf(`create table if not exists public.${TABLE}`),
      migration.indexOf("comment on table"),
    );
    expect(create).toContain("query_text");
    for (const forbidden of [
      "user_id", "session_id", "ip_address", "device_id",
      "fingerprint", "client_id", "anon_id", "user_agent", "referrer",
    ]) {
      expect(create).not.toContain(forbidden);
    }
  });

  it("never lets anon read back what other people searched for", () => {
    const migration = read(MIGRATION);
    expect(migration).toContain(`revoke all on table public.${TABLE} from public, anon, authenticated`);
    expect(migration).toContain(`grant select on table public.${TABLE} to authenticated`);
    expect(migration).toMatch(/for select to authenticated using \(public\.is_admin\(\)\)/);
    // No grant of any kind to anon on the table. The RPC is the only door.
    expect(migration).not.toMatch(new RegExp(`grant [a-z, ]*on table public\\.${TABLE} to [^;]*anon`));
  });
});
