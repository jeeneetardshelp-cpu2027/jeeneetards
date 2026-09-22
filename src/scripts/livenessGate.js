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
//   green = nothing new, red = go and look.
//
// Fail-safe direction matters here. A report that is missing, truncated or the
// wrong shape means we do NOT know whether the catalogue is healthy, and
// "unknown" must never be reported as "clean" — that is precisely the silent
// pass this file exists to remove. Unreadable therefore fails too.
//
// The opposite failure matters as well. A run where nothing was DUE for a check
// is healthy, and it has to go green, or a red run stops meaning anything. The
// runner writes a report on that path (buildNothingDueReport); this reads it
// like any other, and the summary says nothing was checked rather than implying
// a check found nothing.
//
// The same reasoning covers lessons that are ALREADY dead. The check runs every
// day over every video, so a lesson an earlier run marked 'unavailable' is
// re-checked daily (that is how a recovery gets noticed) and each re-check lists
// it in the report's `dead` again. Failing on those would turn the job red every
// morning for the same lessons until someone removes them, and a job that is
// always red is one nobody reads. So only a lesson that was NOT already
// unavailable is news; the known ones are listed, with their links, and do not
// fail the run. A dead entry that does not say what it was before (an older
// report shape) counts as news: not knowing must never pass.

/**
 * @param {unknown} report  parsed tmp/video-liveness-report.json
 * @returns {{ needsAttention: boolean, unreadable: boolean, reason: string|null,
 *            dead: object[], stillUnavailable: object[], newlyBlocked: object[],
 *            recovered: object[], dryRun: boolean, nothingDue: object|null }}
 *   `dead` holds only lessons that newly died this run; `stillUnavailable`
 *   holds the ones an earlier run had already marked.
 */
export function buildGateVerdict(report) {
  const unreadable = (reason) => ({
    needsAttention: true,
    unreadable: true,
    reason,
    dead: [],
    stillUnavailable: [],
    newlyBlocked: [],
    recovered: [],
    dryRun: false,
    nothingDue: null,
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

  const alreadyMarked = (d) => d?.was === "unavailable";
  const dead = report.dead.filter((d) => !alreadyMarked(d));
  const stillUnavailable = report.dead.filter(alreadyMarked);
  const newlyBlocked = report.newly_blocked;
  const note = report.nothing_due;
  return {
    // Both warrant a look. A new death needs a removal decision (which can
    // empty a chapter, so it is deliberately the owner's call). 'blocked' still
    // has an honest "YouTube only" fallback in the watch UI, but with zero
    // blocked videos in the catalogue today, the first one is news.
    needsAttention: dead.length + newlyBlocked.length > 0,
    unreadable: false,
    reason: null,
    dead,
    stillUnavailable,
    newlyBlocked,
    recovered: Array.isArray(report.recovered) ? report.recovered : [],
    // A dry run detects exactly what a real run detects; only the write is
    // skipped. So a finding in a dry run is still a finding and still fails.
    dryRun: report.dry_run === true,
    // Why nothing was checked, when that is what happened. It explains an empty
    // run for the summary; it never excuses a finding — needsAttention above is
    // decided by the lists alone.
    nothingDue: note && typeof note === "object" && !Array.isArray(note) ? note : null,
  };
}

// "1 lesson(s)" reads like a machine wrote it. The owner reads these.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const watchUrl = (d) => d.watch_url || `https://www.youtube.com/watch?v=${d.youtube_video_id}`;

/** The known-dead lessons, listed so they are never out of sight, never failing the run. */
function stillUnavailableLines(verdict) {
  if (!verdict.stillUnavailable.length) return [];
  const lines = [
    "",
    `### ${plural(verdict.stillUnavailable.length, "lesson is", "lessons are")} still unavailable from earlier runs`,
    "",
    "Already marked unavailable, so the lesson list labels them instead of",
    "showing a broken player. They stay listed until you decide to remove them,",
    "and they do not turn the run red again.",
    "",
  ];
  for (const d of verdict.stillUnavailable) lines.push(`- video ${d.id} — ${watchUrl(d)}`);
  return lines;
}

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
    if (verdict.nothingDue) {
      // "No dead lessons" would imply lessons were checked. None were, so say
      // that — and only quote numbers the report actually carried.
      const total = verdict.nothingDue.total_videos;
      const days = verdict.nothingDue.max_age_days;
      const scope = Number.isFinite(total) && Number.isFinite(days)
        ? `All ${plural(total, "video was", "videos were")} verified within the last ${plural(days, "day", "days")}`
        : "Every video was verified recently";
      lines.push("", `No lesson was due for a check. ${scope}, so nothing was sent to YouTube this run.`);
      return lines.join("\n");
    }
    // "No dead lessons" is only true when there are none at all. With known
    // dead ones still listed, say that nothing NEW died.
    lines.push("", verdict.stillUnavailable.length
      ? "No newly dead or newly-blocked lessons. Nothing new to do."
      : "No dead or newly-blocked lessons. Nothing to do.");
    if (verdict.recovered.length) {
      lines.push("", `${plural(verdict.recovered.length, "lesson", "lessons")} recovered and now embed again.`);
    }
    lines.push(...stillUnavailableLines(verdict));
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
    for (const d of verdict.dead) lines.push(`- video ${d.id} — ${watchUrl(d)}`);
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

  lines.push(...stillUnavailableLines(verdict));
  return lines.join("\n");
}
