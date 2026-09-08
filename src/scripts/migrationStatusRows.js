// The status column of supabase/README.md's migration table, as data.
//
// WHY THIS EXISTS. That table is where anyone asks "what will `db push` run?",
// and CLAUDE.md points readers at it. On 7 Sep 2026 it carried FIVE false
// status claims in one day — including two inside commits written to correct
// earlier false claims, and one that said an applied migration was pending
// while another said a pending one was applied. Every one of them passed CI,
// because prose is not executable.
//
// So the status is no longer taken on trust. These functions turn the table
// into rows a machine can check, and src/scripts/verifyMigrationStatus.js
// compares them against what `supabase migration list` reports for the real
// database. The prose around each status stays hand-written — it carries the
// reasoning, which no generator can supply — but the CLAIM itself is now
// checkable.

/** A migration filename inside backticks, as the table's first cell writes it. */
const FILE_CELL = /^\|\s*`([0-9]{14}_[A-Za-z0-9_]+\.sql)`\s*\|/;

/**
 * The status a row CLAIMS, read from the first bolded span of its second cell.
 *
 * Deliberately keyed to that first span and nothing else. A row may say
 * "**Applied 7 Sep 2026**, NOT 4 Sep — ..." (an applied row correcting its own
 * date), and a looser search for "NOT applied" would read that as pending.
 */
export function claimedStatus(cell) {
  const bold = cell.match(/\*\*(.+?)\*\*/);
  if (!bold) return null;
  const token = bold[1].trim();
  if (/^applied\b/i.test(token)) return "applied";
  if (/\bnot applied\b/i.test(token) || /^staged\b/i.test(token) || /^pending\b/i.test(token)) return "pending";
  return null;
}

/** Every table row in the markdown that names a migration file. */
export function parseStatusRows(markdown) {
  const rows = [];
  for (const [index, line] of String(markdown ?? "").split("\n").entries()) {
    const file = line.match(FILE_CELL);
    if (!file) continue;
    const cell = line.slice(line.indexOf("|", line.indexOf("|") + 1) + 1);
    rows.push({
      file: file[1],
      version: file[1].slice(0, 14),
      claimed: claimedStatus(cell),
      line: index + 1,
    });
  }
  return rows;
}

/**
 * Compare claimed statuses against the real ones.
 *
 * `applied` is the set of versions the database reports as applied. A row with
 * no readable status is a problem too: an unreadable claim is not a passing
 * one, which is the mistake a checker in this repo already made once by
 * treating "no signal" as "green".
 */
export function compareStatus({ rows, appliedVersions, chainVersions }) {
  const applied = new Set(appliedVersions);
  const chain = new Set(chainVersions);
  const problems = [];

  for (const row of rows) {
    const truth = applied.has(row.version) ? "applied" : "pending";
    if (!chain.has(row.version)) {
      problems.push(`${row.file} (README line ${row.line}) is not in supabase/migrations/`);
      continue;
    }
    if (row.claimed === null) {
      problems.push(`${row.file} (README line ${row.line}) states no readable status; it is ${truth}`);
      continue;
    }
    if (row.claimed !== truth) {
      problems.push(`${row.file} (README line ${row.line}) says ${row.claimed}; it is ${truth}`);
    }
  }

  const documented = new Set(rows.map((r) => r.version));
  for (const version of chainVersions) {
    if (!documented.has(version)) problems.push(`${version} is in the chain but has no README row`);
  }

  // The direction that matters most and is easiest to miss: the database has
  // run a migration whose file is no longer in the repo. A checker that only
  // walks the chain cannot see it, because there is nothing there to walk.
  // This is the drift supabase/migrations/ exists to end — a fresh environment
  // rebuilt from the chain would NOT match production — and it happens
  // whenever a file is reverted after it has been pushed.
  for (const version of appliedVersions) {
    if (!chain.has(version)) {
      problems.push(
        `${version} is applied to the database but has NO file in supabase/migrations/ — ` +
        "the chain no longer reproduces production",
      );
    }
  }
  return problems;
}
