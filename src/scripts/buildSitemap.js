// =====================================================================
// buildSitemap.js - generate public/sitemap.xml at build time.
//
// The sitemap is updated only after all public catalogue data has loaded:
// static pages, courses and faculty profiles. If either catalogue query fails,
// preserve the last known usable sitemap instead of replacing it with a
// six-URL fallback.
// A sitemap failure must never break a production deploy.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const BASE = "https://www.jeeneetard.com";
export const STATIC_ROUTES = ["/", "/browse", "/explore", "/tests", "/terms", "/privacy"];

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = resolve(here, "../../public/sitemap.xml");

export function loadEnv() {
  const env = { ...process.env };
  try {
    const envPath = resolve(here, "../../.env");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match && env[match[1]] === undefined) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch {
    // CI and Vercel provide real environment variables instead.
  }
  return env;
}

export function urlEntry(path, lastmod) {
  return (
    `  <url>\n    <loc>${BASE}${path}</loc>` +
    (lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "") +
    "\n  </url>"
  );
}

export function sitemapXml(entries) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join("\n") +
    "\n</urlset>\n"
  );
}

export function writeSitemap(entries, out = DEFAULT_OUT) {
  writeFileSync(out, sitemapXml(entries), "utf8");
}

export function hasUsableSitemap(out = DEFAULT_OUT) {
  if (!existsSync(out)) return false;
  try {
    const current = readFileSync(out, "utf8");
    return current.includes("<urlset") && current.includes(`<loc>${BASE}/</loc>`);
  } catch {
    return false;
  }
}

export function preserveOrWriteStatic(out = DEFAULT_OUT) {
  if (hasUsableSitemap(out)) {
    console.warn("! sitemap: preserving the last known complete sitemap");
    return "preserved";
  }
  writeSitemap(STATIC_ROUTES.map((path) => urlEntry(path)), out);
  console.warn("! sitemap: no prior sitemap found; wrote static routes only");
  return "static";
}

export async function buildSitemap({
  env = loadEnv(),
  out = DEFAULT_OUT,
  clientFactory = createClient,
} = {}) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || !url.startsWith("http")) {
    console.warn("! sitemap: Supabase env not set");
    return { outcome: preserveOrWriteStatic(out), courses: 0, faculty: 0 };
  }

  try {
    const db = clientFactory(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [courseResult, facultyResult] = await Promise.all([
      db.from("playlists").select("id, created_at").order("id"),
      db.rpc("get_faculty_facets", {
        p_chapter_id: null,
        p_subject_id: null,
        p_goal_id: null,
      }),
    ]);

    if (courseResult.error) throw new Error(`courses: ${courseResult.error.message}`);
    if (facultyResult.error) throw new Error(`faculty: ${facultyResult.error.message}`);

    const staticEntries = STATIC_ROUTES.map((path) => urlEntry(path));
    const courseEntries = (courseResult.data ?? []).map((row) =>
      urlEntry(
        `/course/${row.id}`,
        row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
      ),
    );
    const facultySlugs = [
      ...new Set((facultyResult.data ?? []).map((row) => row.slug).filter(Boolean)),
    ].sort();
    const facultyEntries = facultySlugs.map((slug) =>
      urlEntry(`/faculty/${encodeURIComponent(slug)}`),
    );

    writeSitemap([...staticEntries, ...courseEntries, ...facultyEntries], out);
    console.log(
      `sitemap: ${courseEntries.length} courses + ${facultyEntries.length} faculty + ` +
        `${staticEntries.length} static routes`,
    );
    console.log(`sitemap: wrote ${out}`);
    return {
      outcome: "written",
      courses: courseEntries.length,
      faculty: facultyEntries.length,
    };
  } catch (error) {
    console.warn(`! sitemap: catalogue fetch failed (${error.message})`);
    return { outcome: preserveOrWriteStatic(out), courses: 0, faculty: 0 };
  }
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  buildSitemap().catch((error) => {
    console.warn(`! sitemap generation skipped: ${error.message}`);
    try {
      preserveOrWriteStatic();
    } catch {
      // The build must still succeed even if the filesystem is unavailable.
    }
  });
}
