// The popularity refresh schedule.
//
// The job's output has a shelf life: stats are fresh for 7 days and purged
// after 30. Run by hand and forgotten, the ranking silently stops meaning what
// it says, and after a month video_stats empties and "Recommended" falls back
// to alphabetical — the state the first run was fixing. So the schedule is
// load-bearing, and these pin the properties that make it safe to leave alone.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const workflow = readFileSync(resolve(ROOT, ".github/workflows/popularity-refresh.yml"), "utf8");
const liveness = readFileSync(resolve(ROOT, ".github/workflows/video-liveness.yml"), "utf8");
const script = readFileSync(resolve(HERE, "refreshVideoStats.js"), "utf8");

const cronOf = (yaml) => yaml.match(/cron:\s*"([^"]+)"/)?.[1];

describe("the popularity refresh schedule", () => {
  it("runs the real script, weekly", () => {
    expect(workflow).toContain("node src/scripts/refreshVideoStats.js");
    // Five fields, day-of-week set: once a week. Matches REFRESH_INTERVAL_DAYS
    // so nothing is ever more than a week stale.
    const cron = cronOf(workflow);
    expect(cron).toMatch(/^\d+ \d+ \* \* [0-6]$/);
    expect(script).toContain("const REFRESH_INTERVAL_DAYS = 7;");
  });

  it("does not contend with the liveness check for YouTube quota", () => {
    // Both jobs spend quota. Same cadence, different weekday.
    const day = (cron) => cron.split(" ")[4];
    expect(day(cronOf(workflow))).not.toBe(day(cronOf(liveness)));
  });

  it("only ever runs against the real repository", () => {
    // A fork that inherits the file must not start writing to production
    // the moment someone adds the secrets.
    expect(workflow).toContain("if: github.repository == 'jeeneetardshelp-cpu2027/jeeneetards'");
  });

  it("defaults a manual run to dry-run, so the plumbing can be tested safely", () => {
    expect(workflow).toMatch(/dry_run:[\s\S]*?default: true/);
    expect(workflow).toContain("inputs.dry_run && '--dry-run'");
  });

  it("fails fast, with a message, when a secret is missing", () => {
    // Otherwise the script would start with an empty .env and fail on a
    // less obvious error, or worse, a manual run would appear to succeed.
    for (const secret of [
      "LIVENESS_SUPABASE_URL",
      "LIVENESS_SUPABASE_SERVICE_KEY",
      "LIVENESS_YOUTUBE_API_KEY",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toMatch(/if \[ -z "\$SUPABASE_URL" \] \|\| \[ -z "\$SERVICE_KEY" \] \|\| \[ -z "\$YT_KEY" \]/);
    expect(workflow).toContain("exit 1");
  });

  it("materialises exactly the env names the script reads", () => {
    // The script reads .env, not process.env. These three names are what
    // loadEnv() looks for; a typo here is a silent "missing from .env" failure.
    for (const name of ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "YOUTUBE_API_KEY"]) {
      expect(workflow).toContain(`echo "${name}=`);
      expect(script).toContain(`env.${name}`);
    }
  });

  it("uses the server YouTube key, never the bundled one", () => {
    expect(workflow).not.toContain("VITE_YOUTUBE_API_KEY=");
  });
});
