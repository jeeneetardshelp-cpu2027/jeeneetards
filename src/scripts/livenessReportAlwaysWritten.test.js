// livenessReportAlwaysWritten: the runner must leave a report behind on every
// path that reaches a verdict.
//
// WHY. The workflow's last step (checkLivenessReport.js) fails the job when the
// report is missing, on purpose: it cannot tell a quiet week from a broken run,
// and "unknown" must never read as "clean". Until 15 Sep 2026 the runner's
// "nothing due" exit — the normal result on most weekly runs, because each video
// is checked about monthly — returned before writing one. So the 7 and 14 Sep
// scheduled runs went red for no reason, and a genuinely broken run would have
// looked exactly the same.
//
// The runner is I/O (Supabase, YouTube, the filesystem), so this reads its
// source rather than executing it. What the report CONTAINS is unit-tested in
// videoLiveness.test.js and livenessGate.test.js; this pins that it is written.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "checkVideoLiveness.js"), "utf8");

/** The source from `marker` up to the first process.exit after it. */
function branch(marker) {
  const start = src.indexOf(marker);
  expect(start, `checkVideoLiveness.js no longer contains ${marker}`).toBeGreaterThan(-1);
  const end = src.indexOf("process.exit(", start);
  expect(end, `no exit after ${marker}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("checkVideoLiveness.js leaves a report where the verdict step looks", () => {
  it("writes a nothing-due report before the nothing-due exit", () => {
    const b = branch("if (!due.length)");
    expect(b).toContain("writeReport(");
    expect(b).toContain("buildNothingDueReport(");
  });

  it("writes the full report through the same helper, which alone names the file", () => {
    // One place names the file, so two paths cannot write it to different ones.
    expect(src.split('"video-liveness-report.json"').length - 1).toBe(1);
    expect(src).toContain("writeReport(report)");
  });

  it("does NOT write a report when the catalogue read came back empty", () => {
    // Deliberate. An empty read on production means the read is broken, not
    // that the catalogue is clean, so leaving no report keeps that run red.
    expect(branch("if (!videos.length)")).not.toContain("writeReport(");
  });
});
