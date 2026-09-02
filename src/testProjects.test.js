// The suite is split into two vitest projects: `app` (components, hooks, pure
// logic, jsdom) and `sql` (the one-off ingestion, seed, package and
// SQL-rehearsal checks, plain Node).
//
// The split is worth guarding because the failure mode is silent. If the two
// projects stop covering every test file, or stop being disjoint, the everyday
// `npm test` still goes green while some files simply never run again — and
// nothing else in the repo would notice.
//
// Run: npx vitest run src/testProjects.test.js

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const config = readFileSync(resolve(root, "vite.config.js"), "utf8");
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const workflow = readFileSync(
  resolve(root, ".github/workflows/ci.yml"),
  "utf8",
);

// The globs as the config actually declares them, not a second copy that could
// drift away from it.
function declaredSqlGlobs() {
  const block = config.slice(
    config.indexOf("const SQL_VERIFICATION_TESTS = ["),
    config.indexOf("];", config.indexOf("const SQL_VERIFICATION_TESTS = [")),
  );
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, "[^/]*")}$`);
}

const sqlGlobs = declaredSqlGlobs();
const topLevelTests = readdirSync(resolve(root, "src"))
  .filter((name) => name.endsWith(".test.js") || name.endsWith(".test.jsx"))
  .map((name) => `src/${name}`);
const sqlProjectFiles = topLevelTests.filter((file) =>
  sqlGlobs.some((glob) => globToRegExp(glob).test(file)),
);

describe("vitest project split", () => {
  it("declares an app project in jsdom and a sql project in node", () => {
    expect(config).toMatch(/name: "app",\s*\n\s*environment: "jsdom"/);
    expect(config).toMatch(/name: "sql",\s*\n\s*environment: "node"/);
  });

  it("drives both projects from one glob list, so neither can drop a file", () => {
    // This is the whole safety property: the sql project INCLUDES exactly what
    // the app project EXCLUDES. Written as two separate literal lists, the two
    // would eventually disagree and files would fall through the gap.
    expect(config).toMatch(
      /exclude: \[\s*\.\.\.defaultExclude,\s*\.\.\.WORKTREE_COPIES,\s*\.\.\.SQL_VERIFICATION_TESTS,?\s*\]/,
    );
    expect(config).toContain("include: SQL_VERIFICATION_TESTS");
    expect(sqlGlobs.length).toBeGreaterThan(0);
    for (const glob of sqlGlobs) {
      expect(glob, glob).toMatch(/^src\/[^/]*\.test\.js$/);
    }
  });

  it("never collects a worktree copy parked inside the checkout", () => {
    // Codex (`.codex-worktrees/`) and Claude Code (`.claude/worktrees/`) both
    // park whole, untracked copies of the project inside the checkout. Vitest
    // only excludes node_modules and .git by default, so without this it
    // collected every copy's tests as if they were ours — 3,368 files where
    // the real tree has 400 — and path arguments did not scope it out, because
    // vitest treats them as substring filters.
    expect(config).toContain('"**/.codex-worktrees/**"');
    expect(config).toContain('"**/.claude/worktrees/**"');
    // Both projects. The sql includes are root-anchored, so they never reached
    // a copy; the explicit exclude is what keeps that true if one ever grows
    // a `**`.
    expect(config.match(/\.\.\.WORKTREE_COPIES/g)).toHaveLength(2);
    // And the Codex directory is ignored, so it never shows up as untracked
    // work either.
    const gitignore = readFileSync(resolve(root, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.codex-worktrees\/\r?$/m);
    expect(gitignore).toMatch(/^\.claude\/\r?$/m);
  });

  it("keeps the sql project free of anything that needs a DOM", () => {
    // The sql project runs without jsdom. A test that touches the DOM would
    // fail there, so the globs must never reach one.
    expect(sqlProjectFiles.length).toBeGreaterThan(100);
    for (const file of sqlProjectFiles) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, file).not.toMatch(
        /@testing-library|react-dom|document\.|window\.|localStorage|\.jsx"/,
      );
    }
  });

  it("leaves the config-level timeout budget as the app project's budget", () => {
    // src/testTimeoutBudget.test.js reads the FIRST testTimeout in the file.
    // Keep the shared one first so that guard keeps measuring the everyday
    // suite rather than the slower SQL rehearsals.
    const first = config.indexOf("testTimeout: 15000");
    const sqlBudget = config.indexOf("testTimeout: 120000");
    expect(first).toBeGreaterThan(-1);
    expect(sqlBudget).toBeGreaterThan(first);
  });
});

describe("test scripts", () => {
  it("runs only the fast app project by default", () => {
    expect(packageJson.scripts.test).toBe("vitest run --project app");
  });

  it("offers the sql project on its own", () => {
    expect(packageJson.scripts["test:sql"]).toBe("vitest run --project sql");
  });

  it("still has one command that runs everything", () => {
    // Bare `vitest run` runs every project, so test:all stays honest about its
    // name. If someone ever narrows it to a single project, this fails.
    expect(packageJson.scripts["test:all"]).toContain("vitest run &&");
    expect(packageJson.scripts["test:all"]).not.toContain("--project");
  });
});

describe("continuous integration", () => {
  it("runs the fast project on every push and pull request", () => {
    expect(workflow).toMatch(/name: Run tests\n\s+run: npm test/);
  });

  it("keeps the build and release safeguards it already had", () => {
    expect(workflow).toContain("run: npm run build");
    expect(workflow).toContain("run: npm run verify:frontend-release");
    expect(workflow).toContain("run: npm run lint");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("timeout-minutes: 15");
  });

  it("has a separate job for the SQL and migration project", () => {
    expect(workflow).toContain("sql-tests:");
    expect(workflow).toContain("run: npm run test:sql");
  });

  it("never lets a pull request skip the SQL project", () => {
    // The skip is a push-only optimisation. Every merge goes through a pull
    // request, so this is what stops a schema change reaching main unchecked.
    expect(workflow).toMatch(/if \[ "\$EVENT_NAME" != "push" \]/);
    const guard = workflow.slice(workflow.indexOf('if [ "$EVENT_NAME" != "push" ]'));
    expect(guard.slice(0, 400)).toContain('echo "run=true" >> "$GITHUB_OUTPUT"');
  });

  it("runs the SQL project whenever a schema-affecting path changed", () => {
    for (const path of [
      "docs/",
      "supabase/",
      "src/migrations/",
      "src/scripts/",
    ]) {
      expect(workflow).toContain(path);
    }
  });
});
