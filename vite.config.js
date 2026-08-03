import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  // Component tests need a DOM. Pure-logic tests (classLevels.test.js) are
  // unaffected by running under jsdom.
  test: {
    environment: "jsdom",
    globals: true,
    // Raises Testing Library's own async timeout, which testTimeout below does
    // not govern. See the comment in src/setupTests.js.
    setupFiles: ["./src/setupTests.js"],
    // Vitest defaults to a 5s per-test timeout (verified by probe, not assumed).
    // The heaviest component tests — CourseSequence's full-course paging,
    // Dashboard.goal's mobile search, shellSafety's statistics band — normally
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
  },
});
