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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

// Drop block and line comments so a scan reads the code, not the prose.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, "$1");

const MIGRATION = "supabase/migrations/20260902164500_search_gap_log.sql";
const HOLD_MARKER = "DO NOT APPLY YET";
const TABLE = "search_gap_log";

describe("search gap log privacy contract", () => {
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
