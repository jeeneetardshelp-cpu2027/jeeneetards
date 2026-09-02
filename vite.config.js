import { defineConfig } from "vite";
import { defaultExclude } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The one-off ingestion, seed, SQL-package and SQL-rehearsal verification
// tests. Each of these re-checks a SQL file, manifest or readiness document
// that was reviewed once and then applied; more than fifty of them boot an
// in-memory Postgres (@electric-sql/pglite) to rehearse that SQL. They are
// real coverage, but they only change meaning when the artifacts under
// `docs/`, `src/migrations/` or `supabase/migrations/` change — not when a
// component or hook changes.
//
// They are matched by glob rather than by editing every file, and the SAME
// list is used to build both projects (included in `sql`, excluded from
// `app`), so the two are exhaustive and disjoint by construction: no test can
// be dropped by editing one list and forgetting the other. `vitest run` with
// no arguments still runs both.
//
// Nothing in this list touches the DOM — that is what lets the `sql` project
// run in the plain Node environment and skip a jsdom boot per file.
const SQL_VERIFICATION_TESTS = [
  "src/*Seed.test.js",
  "src/*Package.test.js",
  "src/*Packages.test.js",
  "src/*Sql.test.js",
  "src/*SqlRehearsal.test.js",
  "src/*SqlContract.test.js",
  "src/unacademyNeet*.test.js",
  "src/competishun*.test.js",
  "src/chapterClassScope*.test.js",
  "src/chapterClassScopes*Draft.test.js",
  "src/add*Plan.test.js",
  "src/link*Plan.test.js",
  "src/facultyRegistry*Source.test.js",
  "src/jeeAdvanced*.test.js",
  "src/jeeMain2*.test.js",
  "src/neetUg*.test.js",
  "src/nsep*.test.js",
];

// Untracked worktree copies parked inside the checkout (Codex under
// `.codex-worktrees/`, Claude Code under `.claude/worktrees/`). Vitest only
// excludes node_modules and .git by default, so it collected every copy's
// tests as if they were the project's own — 3,368 files where the real tree
// has 400 — and path arguments don't scope it out, because vitest treats them
// as substring filters. Excluded from both projects so no copy is collected.
const WORKTREE_COPIES = ["**/.codex-worktrees/**", "**/.claude/worktrees/**"];

// Tailwind v4 is wired in as a Vite plugin — no PostCSS config, no
// tailwind.config.js. The only other half of the setup is the single
// `@import "tailwindcss";` line at the top of src/index.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Keep the database SDK cacheable and out of the application entry.
        // Importing faculty hooks into Browse otherwise pulled the whole SDK
        // back into index.js and regressed the Phase 2 bundle from ~260 KB to
        // ~474 KB. Vite 8/Rolldown's supported replacement for manualChunks.
        codeSplitting: {
          groups: [
            { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    // Raises Testing Library's own async timeout, which testTimeout below does
    // not govern. See the comment in src/setupTests.js.
    setupFiles: ["./src/setupTests.js"],
    // Vitest defaults to a 5s per-test timeout (verified by probe, not assumed).
    // The heaviest component tests — CourseSequence's full-course paging,
    // BrowsePage.goal's mobile search, shellSafety's statistics band — normally
    // take 2.1–2.4s, so only a ~2x slowdown is enough to blow that budget. With
    // 130+ files sharing 12 cores that happens intermittently: one run failed
    // four of them, the next run failed a different one, and every one passed in
    // isolation. A suite that fails somewhere different each run trains people
    // to re-run rather than read the failure, which is how a real break gets
    // waved through.
    //
    // 15s keeps roughly a 6x margin over the slowest of them. It does not mask
    // real breakage: a genuinely broken test fails its assertion immediately,
    // and only a hang waits out the timeout.
    testTimeout: 15000,
    hookTimeout: 15000,
    // Two projects, not two config files. `extends: true` means each one
    // inherits the plugins and the timeouts above; only the environment and
    // the file list differ.
    projects: [
      {
        extends: true,
        test: {
          // The everyday loop: components, hooks and pure logic. Component
          // tests need a DOM, and pure-logic tests are unaffected by running
          // under jsdom, so the whole project shares one environment.
          // `npm test` runs this.
          name: "app",
          environment: "jsdom",
          exclude: [
            ...defaultExclude,
            ...WORKTREE_COPIES,
            ...SQL_VERIFICATION_TESTS,
          ],
        },
      },
      {
        extends: true,
        test: {
          // The applied-artifact checks. Node instead of jsdom: booting a DOM
          // for a file that only reads SQL text and hashes it cost more than
          // the assertions did. `npm run test:sql` runs this.
          name: "sql",
          environment: "node",
          include: SQL_VERIFICATION_TESTS,
          exclude: [...defaultExclude, ...WORKTREE_COPIES],
          // src/setupTests.js only configures Testing Library, which these
          // tests never use and which expects a DOM.
          setupFiles: [],
          // Measured, not guessed. Roughly fifty-six of these files boot a
          // WASM Postgres and replay the production schema into it. In
          // isolation each finishes in a few seconds; run together they share
          // the same cores, and four of them blew the 15s app budget on the
          // first full run of this project while all four passed on their own.
          // The old single suite hid that by interleaving them with cheap
          // component files.
          //
          // 120s is the budget the work actually needs when the whole project
          // runs at once. It still bounds a genuine hang — a broken assertion
          // fails immediately, and only something stuck waits this out.
          // NOTE (2026-09-02): 39 files in this project used to pin their own
          // 30s per-test timeout. That was a RAISE when everything ran under
          // the 15s app budget, but inside this project it silently LOWERED
          // the budget below — and once the two new SQL rehearsals landed,
          // eleven of those tests timed out in a full run while every one
          // passed in isolation in ~10s. The overrides are gone, so this is
          // the single budget again.
          testTimeout: 120000,
          hookTimeout: 120000,
        },
      },
    ],
  },
});
