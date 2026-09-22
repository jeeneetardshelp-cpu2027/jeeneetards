// The video liveness schedule.
//
// Until 22 Sep 2026 the job ran weekly and skipped every video verified within
// 30 days. All rows had been stamped on 1 Sep, so nothing was due until
// October, and 20 of course 485's 21 lectures went private and played "Private
// video" to students for three weeks. Checking the whole catalogue costs about
// one YouTube quota unit per 50 videos, so it now runs daily over everything.
// These pin that, so the cadence cannot quietly drift back.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const workflow = readFileSync(resolve(ROOT, ".github/workflows/video-liveness.yml"), "utf8");
const cron = workflow.match(/cron:\s*"([^"]+)"/)?.[1];
const checkStep = workflow.match(/run: node src\/scripts\/checkVideoLiveness\.js[^\n]*/)?.[0];

describe("the video liveness schedule", () => {
  it("runs every day", () => {
    // Five fields; day-of-month, month and day-of-week all '*'.
    expect(cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it("checks every video on each run, not only ones older than a cutoff", () => {
    expect(checkStep).toBeTruthy();
    expect(checkStep).not.toContain("--max-age");
    expect(checkStep).not.toContain("--limit");
  });

  it("still ends with the verdict step, so a new finding turns the run red", () => {
    const check = workflow.indexOf("node src/scripts/checkVideoLiveness.js");
    const verdict = workflow.indexOf("node src/scripts/checkLivenessReport.js");
    expect(check).toBeGreaterThan(-1);
    expect(verdict).toBeGreaterThan(check);
  });

  it("defaults a manual run to dry-run, so the plumbing can be tested safely", () => {
    expect(workflow).toMatch(/dry_run:[\s\S]*?default: true/);
    expect(workflow).toContain("inputs.dry_run && '--dry-run'");
  });

  it("only ever runs against the real repository", () => {
    expect(workflow).toContain("if: github.repository == 'jeeneetardshelp-cpu2027/jeeneetards'");
  });
});
