// The steering docs are the first thing every agent reads, so a stale claim in
// them costs a whole session before anyone notices. These are the few facts
// that were actually wrong before (theming, the screen list, the three-file SQL
// story) plus the two rules that keep the pair honest: they must agree with
// each other, and they must not link anywhere that does not exist.
//
// Deliberately semantic and few. A doc test that fails on rewording trains the
// owner to ignore it, which is worse than no test.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const claude = read("CLAUDE.md");
const agents = read("AGENTS.md");
const docs = { "CLAUDE.md": claude, "AGENTS.md": agents };

/** Everything from the first real section onwards — the shared body. */
const body = (text) => text.slice(text.indexOf("## What this project is"));

describe("steering docs", () => {
  it("keeps CLAUDE.md and AGENTS.md saying the same thing", () => {
    // Every agent reads one or the other. Two files that disagree are worse
    // than one file that is out of date, because neither reader can tell.
    expect(body(claude)).toBe(body(agents));
    expect(body(claude).length).toBeGreaterThan(1000);
  });

  it.each(Object.keys(docs))("%s records the migration-chain workflow", (name) => {
    const text = docs[name];
    expect(text).toContain("supabase/migrations/");
    expect(text).toContain("20260831140005_production_baseline.sql");
    expect(text).toContain("npx supabase db push");
    // db push has no per-file selection, so anything staged must be safe.
    expect(text).toMatch(/every.{0,40}pending migration/i);
    // The SQL Editor is for audits, not schema writes.
    expect(text).toMatch(/SQL Editor is read-only|SQL Editor\*{0,2} is read-only/i);
    // Point at supabase/README.md rather than duplicating it.
    expect(text).toContain("supabase/README.md");
  });

  it.each(Object.keys(docs))("%s records the decided architecture rules", (name) => {
    const text = docs[name];
    expect(text).toMatch(/ONE result system/i);
    expect(text).toMatch(/ONE search surface/i);
    expect(text).toContain("src/searchDestinations.js");
    // Chapter SEO pages are edge-rendered shells, never a second results UI.
    expect(text).toMatch(/edge-rendered shells/i);
  });

  it.each(Object.keys(docs))("%s does not repeat the corrected claims", (name) => {
    const text = docs[name];
    // Theming lives in theme.jsx, not MinimalUI.jsx.
    expect(text).not.toMatch(/useTheme` in MinimalUI\.jsx|Theme is handled by .{0,40}MinimalUI/);
    expect(text).toContain("theme.jsx");
    // The database is not three SQL files run in the SQL Editor.
    expect(text).not.toMatch(/community_schema\.sql|courses_data\.sql/);
    // The inaccessible legacy teal was replaced by #0F6F78 (see
    // releaseIntegrity.test.js, which enforces the same value in source).
    expect(text).not.toContain("#13919B");
    expect(text).toContain("#0F6F78");
    // Screens that no longer exist must not be described as current ones.
    expect(text).not.toMatch(/Chapter Notes.{0,5}\/.{0,5}.?Comments.? tabs?/i);
  });

  it.each(Object.keys(docs))("%s only names files that exist", (name) => {
    const text = docs[name];
    // Backticked paths that look like repository paths, not prose or commands.
    const paths = [...text.matchAll(/`((?:src|docs|supabase|api|public)\/[\w./-]+)`/g)]
      .map((match) => match[1])
      .filter((p) => !p.endsWith("/"));
    expect(paths.length).toBeGreaterThan(5);
    for (const path of new Set(paths)) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it("keeps the generated schema reference pointed at the baseline", () => {
    const reference = read("docs/schema_reference.md");
    expect(reference).toContain("20260831140005_production_baseline.sql");
    expect(reference).toMatch(/GENERATED, NOT HAND-MAINTAINED/);
    expect(reference).toContain("66 tables, 181 functions, 98 RLS policies");
    // The baseline resolved the old "rls_auto_enable has no source" finding;
    // what remains true is that a replay would not re-bind the event trigger.
    expect(reference).not.toMatch(/rls_auto_enable` has no source/);
    expect(reference).toMatch(/CREATE EVENT TRIGGER/);
    expect(existsSync(resolve(root, "supabase/migrations/20260831140005_production_baseline.sql")))
      .toBe(true);
  });

  // The UTF-8 rule in supabase/README.md tells every future non-ASCII migration
  // to copy a check out of a named file. It spent a day naming 20260902210000,
  // which contains no such check — so a reader following the rule found nothing
  // and, most likely, shipped without the guard. That guard exists because 32
  // Hindi note titles reached production as question marks and stayed that way
  // for four weeks.
  //
  // Asserted against the FILE rather than the prose, so rewording the rule is
  // free and pointing it somewhere untrue is not.
  it("points the UTF-8 rule at a migration that really carries the guard", () => {
    const readme = read("supabase/README.md");
    const rule = readme.slice(readme.indexOf("prove the encoding survived"));
    expect(rule, "supabase/README.md no longer states the UTF-8 rule").not.toBe("");

    const cited = rule.match(/`([0-9]{14}_[a-z0-9_]+[.]sql)`/);
    expect(cited, "the UTF-8 rule must name the migration file it points at").not.toBeNull();

    const path = `supabase/migrations/${cited[1]}`;
    expect(existsSync(resolve(root, path)), `${path} does not exist`).toBe(true);
    // Both halves the rule shows: refuse a bad connection, then prove the rows
    // that landed are not pure ASCII.
    expect(read(path), `${cited[1]} carries no octet_length guard`).toContain("octet_length");
  });
});
