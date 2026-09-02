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
import { TEST_SECTIONS } from "../testPlatforms.js";
import { CLASS_LEVELS_BY_GOAL } from "../classLevels.js";
import { isIndexableChapter } from "../chapterLanding.js";
import { canonicalBrowseUrl } from "../canonicalUrl.js";
import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "../releaseCapabilities.js";
import {
  PAPER_LANDINGS,
  paperYearPath,
  paperYears,
} from "../studyMaterialLandings.js";

export const BASE = "https://www.jeeneetard.com";
export const STATIC_ROUTES = [
  "/", "/browse", "/explore", "/tests", "/methodology", "/terms", "/privacy",
  ...(RELEASE_CAPABILITIES.facultyRegistry ? ["/faculty"] : []),
  // Every registered paper landing rides the same capability gate as
  // /materials — the registry is the sitemap's source of truth, so a landing
  // that exists for the router exists here too.
  ...(RELEASE_CAPABILITIES.studyMaterials
    ? ["/materials", ...PAPER_LANDINGS.map((landing) => landing.path)]
    : []),
  ...(RELEASE_FEATURES.forum ? ["/forum"] : []),
  // Same rule as the forum: while the flag is off, pageMetadata marks /polls
  // noindex, and advertising a noindex URL is how the forum ended up asking
  // Google to crawl a dead end for two months.
  ...(RELEASE_FEATURES.polls ? ["/polls"] : []),
  // One entry per exam that actually has sources. An exam with an empty list
  // is deliberately absent: pageMetadata marks it noindex, and a sitemap must
  // never advertise a URL that tells Google not to index it.
  ...TEST_SECTIONS.filter((s) => s.resources.length).map((s) => `/tests/${s.id}`),
];

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

// <loc> is XML text, so the five predefined entities must be escaped. This
// never mattered while every URL was a bare path; the chapter URLs are the
// first to carry a query string, and a raw "&" makes the whole document
// unparseable — a sitemap Google rejects outright, which would have silently
// undone the point of listing them.
const xmlText = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

export function urlEntry(path, lastmod) {
  return (
    `  <url>\n    <loc>${xmlText(`${BASE}${path}`)}</loc>` +
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

/**
 * The per-year paper pages that actually have papers.
 *
 * Deliberately NON-FATAL, unlike the catalogue queries: the paper tier is a
 * small side branch, and letting a transient failure there downgrade the whole
 * sitemap to "preserved" would hold back every course and chapter URL too. A
 * year is emitted only when the catalogue returned a paper for it, so this can
 * never advertise a year that renders a 404.
 */
export async function paperYearPaths(db) {
  if (!RELEASE_CAPABILITIES.studyMaterials) return [];
  const paths = [];
  for (const landing of PAPER_LANDINGS) {
    let result;
    try {
      result = await db.from("study_materials")
        .select("exam_year")
        .eq("material_type", "previous_year_paper")
        .ilike("title", landing.titlePattern)
        .limit(2000);
    } catch (error) {
      // A thrown network error is the same event as a returned one here, and
      // letting it escape would defeat the whole point of this being skippable.
      result = { data: null, error };
    }
    if (result.error) {
      console.warn(`! sitemap: ${landing.id} paper years skipped (${result.error.message})`);
      continue;
    }
    for (const year of paperYears(result.data ?? [])) {
      paths.push(paperYearPath(landing, year));
    }
  }
  return paths;
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
    return {
      outcome: preserveOrWriteStatic(out),
      courses: 0, faculty: 0, explore: 0, paperYears: 0,
    };
  }

  try {
    const db = clientFactory(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [courseResult, facultyResult, goalResult, boardResult] = await Promise.all([
      db.from("playlists").select("id, created_at").order("id"),
      db.rpc("get_faculty_facets", {
        p_chapter_id: null,
        p_subject_id: null,
        p_goal_id: null,
      }),
      db.rpc("get_browse_curriculum", {
        p_goal: null,
        p_class: null,
        p_subject: null,
      }),
      db.from("boards")
        .select("id, name, slug, playlist_boards(count)")
        .order("display_order"),
    ]);

    if (courseResult.error) throw new Error(`courses: ${courseResult.error.message}`);
    if (facultyResult.error) throw new Error(`faculty: ${facultyResult.error.message}`);
    if (goalResult.error) throw new Error(`goals: ${goalResult.error.message}`);
    if (boardResult.error) throw new Error(`boards: ${boardResult.error.message}`);

    const activeGoals = (goalResult.data ?? []).filter((row) =>
      CLASS_LEVELS_BY_GOAL[row.slug] && Number(row.course_count ?? 0) > 0,
    );
    const activeBoards = (boardResult.data ?? []).filter((row) =>
      row.slug && Number(row.playlist_boards?.[0]?.count ?? 0) > 0,
    );

    // A class URL is indexable only when it exposes at least one subject, and
    // a subject URL only when it exposes at least one chapter.
    //
    // Chapter paths ARE listed now. They used to be excluded because the edge
    // redirected them into /browse, which is noindex — so the one screen that
    // compares every course on a chapter had no address of its own. They are
    // real pages now, and only those holding a real comparison
    // (MIN_INDEXABLE_COURSES) are offered, so a two-course chapter does not
    // compete with its own subject page.
    const subjectScopes = await Promise.all(activeGoals.flatMap((goal) =>
      CLASS_LEVELS_BY_GOAL[goal.slug].map(async (classSlug) => {
        const result = await db.rpc("get_browse_curriculum", {
          p_goal: goal.slug,
          p_class: classSlug,
          p_subject: null,
        });
        if (result.error) {
          throw new Error(`subjects ${goal.slug}/${classSlug}: ${result.error.message}`);
        }
        return { goal: goal.slug, classSlug, subjects: result.data ?? [] };
      }),
    ));
    const chapterChecks = await Promise.all(subjectScopes.flatMap((scope) =>
      scope.subjects.map(async (subject) => {
        const result = await db.rpc("get_browse_curriculum", {
          p_goal: scope.goal,
          p_class: scope.classSlug,
          p_subject: subject.slug,
        });
        if (result.error) {
          throw new Error(
            `chapters ${scope.goal}/${scope.classSlug}/${subject.slug}: ${result.error.message}`,
          );
        }
        return {
          ...scope,
          subject: subject.slug,
          hasChapters: (result.data ?? []).length > 0,
          chapters: result.data ?? [],
        };
      }),
    ));

    // Only chapters carrying a real comparison earn a URL. A one- or
    // two-course chapter page still WORKS for anyone following a link; it is
    // simply not offered to search engines, because a thin page competing with
    // its own subject page is worse than no page.
    const indexableChapters = (scope) =>
      (scope.chapters ?? []).filter((chapter) =>
        chapter?.slug && isIndexableChapter(chapter.course_count));

    const explorePaths = new Set();
    for (const goal of activeGoals) {
      const populated = chapterChecks.filter((scope) =>
        scope.goal === goal.slug && scope.hasChapters,
      );
      if (!populated.length) continue;
      explorePaths.add(`/explore/${encodeURIComponent(goal.slug)}`);
      if (goal.slug === "school") {
        for (const board of activeBoards) {
          const boardBase = `/explore/school/${encodeURIComponent(board.slug)}`;
          explorePaths.add(boardBase);
          for (const scope of populated) {
            const classBase = `${boardBase}/${encodeURIComponent(scope.classSlug)}`;
            explorePaths.add(classBase);
            const subjectBase = `${classBase}/${encodeURIComponent(scope.subject)}`;
            explorePaths.add(subjectBase);
            for (const chapter of indexableChapters(scope)) {
              explorePaths.add(canonicalBrowseUrl({
                goal: goal.slug, board: board.slug, cls: scope.classSlug,
                subject: scope.subject, chapter: chapter.slug,
              }));
            }
          }
        }
      } else {
        const goalBase = `/explore/${encodeURIComponent(goal.slug)}`;
        for (const scope of populated) {
          const classBase = `${goalBase}/${encodeURIComponent(scope.classSlug)}`;
          explorePaths.add(classBase);
          const subjectBase = `${classBase}/${encodeURIComponent(scope.subject)}`;
          explorePaths.add(subjectBase);
          for (const chapter of indexableChapters(scope)) {
            explorePaths.add(canonicalBrowseUrl({
              goal: goal.slug, cls: scope.classSlug,
              subject: scope.subject, chapter: chapter.slug,
            }));
          }
        }
      }
    }

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
    const exploreEntries = [...explorePaths].sort().map((path) => urlEntry(path));
    const paperEntries = (await paperYearPaths(db)).map((path) => urlEntry(path));

    writeSitemap(
      [...staticEntries, ...exploreEntries, ...paperEntries, ...courseEntries, ...facultyEntries],
      out,
    );
    console.log(
      `sitemap: ${courseEntries.length} courses + ${facultyEntries.length} faculty + ` +
        `${exploreEntries.length} deep Explore + ${paperEntries.length} paper years + ` +
        `${staticEntries.length} static routes`,
    );
    console.log(`sitemap: wrote ${out}`);
    return {
      outcome: "written",
      courses: courseEntries.length,
      faculty: facultyEntries.length,
      explore: exploreEntries.length,
      paperYears: paperEntries.length,
    };
  } catch (error) {
    console.warn(`! sitemap: catalogue fetch failed (${error.message})`);
    return {
      outcome: preserveOrWriteStatic(out),
      courses: 0, faculty: 0, explore: 0, paperYears: 0,
    };
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
