// =====================================================================
//  buildSitemap.js — generate public/sitemap.xml at build time.
//
//  The app is a client-rendered SPA. Navigation now uses real <a href>
//  links crawlers can follow; this sitemap complements them by giving
//  Google the full URL list directly: the static routes plus one entry
//  per course (/course/:id).
//
//  Runs as a prebuild step (see package.json). It is FAIL-SOFT by design:
//  a sitemap must NEVER break a production deploy, so any failure falls back
//  to writing the static routes only and exits 0.
//
//  Env: reads process.env first (Vercel build), then falls back to .env for
//  local runs. Uses the ANON key only — this reads public catalogue data.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = "https://www.jeeneetard.com";
// Public, indexable routes. Admin/search-query URLs are intentionally excluded
// (robots.txt disallows /admin). /search is deliberately absent: the page is
// noindex (a tool, not content) and a sitemap must not advertise noindexed
// URLs — crawlers reach it through the header/footer links instead.
const STATIC_ROUTES = ["/", "/browse", "/explore", "/terms", "/privacy"];

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../public/sitemap.xml");

function loadEnv() {
  const env = { ...process.env };
  try {
    const envPath = resolve(here, "../../.env");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    /* no .env in CI — real environment variables are used instead */
  }
  return env;
}

function urlEntry(path, lastmod) {
  return (
    `  <url>\n    <loc>${BASE}${path}</loc>` +
    (lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "") +
    `\n  </url>`
  );
}

function writeSitemap(entries) {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>\n`;
  writeFileSync(OUT, xml, "utf8");
}

async function main() {
  const staticEntries = STATIC_ROUTES.map((p) => urlEntry(p));
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  let courseEntries = [];
  if (url && key && url.startsWith("http")) {
    try {
      const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db
        .from("playlists")
        .select("id, created_at")
        .order("id");
      if (error) throw new Error(error.message);
      courseEntries = (data ?? []).map((r) =>
        urlEntry(
          `/course/${r.id}`,
          r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : null,
        ),
      );
      console.log(
        `✓ sitemap: ${courseEntries.length} courses + ${staticEntries.length} static routes`,
      );
    } catch (e) {
      console.warn(
        `⚠ sitemap: could not fetch courses (${e.message}); writing static routes only`,
      );
    }
  } else {
    console.warn("⚠ sitemap: Supabase env not set; writing static routes only");
  }

  writeSitemap([...staticEntries, ...courseEntries]);
  console.log(`✓ wrote ${OUT}`);
}

main().catch((e) => {
  // FAIL-SOFT: never break the production build over a sitemap.
  console.warn(`⚠ sitemap generation skipped: ${e.message}`);
  try {
    writeSitemap(STATIC_ROUTES.map((p) => urlEntry(p)));
  } catch {
    /* give up silently — the build must still succeed */
  }
});
