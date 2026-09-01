// livenessGate.js — turn a liveness report into a pass/fail verdict.
//
// The scheduled liveness check exits 0 whether or not it found rot: it prints a
// warning and uploads tmp/video-liveness-report.json as an artifact. That means
// a run which discovers dead lessons shows a GREEN tick, and nobody is told
// unless they remember to download the artifact. A link-rot checker nobody
// hears from is the same as no link-rot checker.
//
// So the workflow ends by reading the report back and failing the job when
// something needs a human. GitHub already emails the owner when a scheduled
// workflow fails, so that costs no new configuration and no new permissions:
//   green = catalogue clean, red = go and look.
//
// Fail-safe direction matters here. A report that is missing, truncated or the
// wrong shape means we do NOT know whether the catalogue is healthy, and
// "unknown" must never be reported as "clean" — that is precisely the silent
// pass this file exists to remove. Unreadable therefore fails too.

/**
 * @param {unknown} report  parsed tmp/video-liveness-report.json
 * @returns {{ needsAttention: boolean, unreadable: boolean, reason: string|null,
 *            dead: object[], newlyBlocked: object[], recovered: object[],
 *            dryRun: boolean }}
 */
export function buildGateVerdict(report) {
  const unreadable = (reason) => ({
    needsAttention: true,
    unreadable: true,
    reason,
    dead: [],
    newlyBlocked: [],
    recovered: [],
    dryRun: false,
  });

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return unreadable("the report is missing or is not a JSON object");
  }
  // dead / newly_blocked are the two lists the verdict is built from, so a
  // non-array in either one is a corrupt report, not an empty result.
  if (!Array.isArray(report.dead)) return unreadable("the report has no 'dead' array");
  if (!Array.isArray(report.newly_blocked)) {
    return unreadable("the report has no 'newly_blocked' array");
  }

  const dead = report.dead;
  const newlyBlocked = report.newly_blocked;
  return {
    // Both warrant a look. 'dead' needs a removal decision (which can empty a
    // chapter, so it is deliberately the owner's call). 'blocked' still has an
    // honest "YouTube only" fallback in the watch UI, but with zero blocked
    // videos in the catalogue today, the first one is news.
    needsAttention: dead.length + newlyBlocked.length > 0,
    unreadable: false,
    reason: null,
    dead,
    newlyBlocked,
    recovered: Array.isArray(report.recovered) ? report.recovered : [],
    // A dry run detects exactly what a real run detects; only the write is
    // skipped. So a finding in a dry run is still a finding and still fails.
    dryRun: report.dry_run === true,
  };
}

// "1 lesson(s)" reads like a machine wrote it. The owner reads these.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Markdown for the job summary and the console. Reports only what the report
 * actually contains — no invented counts, and no "0 dead" claim when the
 * report could not be read.
 */
export function renderGateSummary(verdict) {
  const lines = ["## Video liveness"];
  if (verdict.dryRun) lines.push("", "_Dry run — the database was not written to._");

  if (verdict.unreadable) {
    lines.push(
      "",
      `**Could not read the liveness report** — ${verdict.reason}.`,
      "",
      "Failing on purpose: an unreadable report means the catalogue's health is",
      "unknown, and unknown must not be reported as clean.",
    );
    return lines.join("\n");
  }

  if (!verdict.needsAttention) {
    lines.push("", "No dead or newly-blocked lessons. Nothing to do.");
    if (verdict.recovered.length) {
      lines.push("", `${plural(verdict.recovered.length, "lesson", "lessons")} recovered and now embed again.`);
    }
    return lines.join("\n");
  }

  if (verdict.dead.length) {
    lines.push(
      "",
      `### ${plural(verdict.dead.length, "lesson is", "lessons are")} gone from YouTube`,
      "",
      "Deleted or made private. Removing one from the catalogue can leave a",
      "chapter with no coverage, so that decision is left to you rather than",
      "made by the cron.",
      "",
    );
    for (const d of verdict.dead) {
      const url = d.watch_url || `https://www.youtube.com/watch?v=${d.youtube_video_id}`;
      lines.push(`- video ${d.id} — ${url}`);
    }
  }

  if (verdict.newlyBlocked.length) {
    lines.push(
      "",
      `### ${plural(verdict.newlyBlocked.length, "lesson", "lessons")} stopped allowing embedding`,
      "",
      'These still exist, and the watch page now offers an honest "YouTube only"',
      "link instead of a dead player. No action is required unless the count is",
      "large enough to be worth replacing the course.",
      "",
    );
    for (const b of verdict.newlyBlocked) {
      lines.push(`- video ${b.id} — https://www.youtube.com/watch?v=${b.youtube_video_id}`);
    }
  }

  if (verdict.recovered.length) {
    lines.push("", `### ${plural(verdict.recovered.length, "lesson", "lessons")} recovered`, "");
    for (const r of verdict.recovered) lines.push(`- video ${r.id} (was ${r.was})`);
  }

  return lines.join("\n");
}
