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
  },
});
