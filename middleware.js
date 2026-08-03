// middleware.js — Vercel Edge Middleware.
//
// The app is a client-rendered SPA: /course/:id serves a generic HTML shell,
// so link-preview crawlers (WhatsApp, Telegram, iMessage, Facebook, ...) and
// search engines see the homepage title/description on every course. This
// middleware rewrites the <head> for /course/:id to that course's own title
// and description before the HTML leaves the edge.
//
// Injected for EVERY visitor (not only bots): serving crawlers different
// content than users is cloaking and is penalised. The SPA simply hydrates
// over the same HTML.
//
// FAIL-THROUGH is absolute: any missing env, lookup miss, slow query, or error
// falls back to next() — the normal shell — so a course page can never break.

import { next } from "@vercel/edge";
import { metadataForLocation, SITE_NAME } from "./src/pageMetadata.js";
import { findTestSection } from "./src/testPlatforms.js";
import {
  courseMeta,
  injectCourseMeta,
  injectRouteMeta,
  courseSchemas,
  injectStructuredData,
  renderCourseBody,
  injectRootContent,
  landingSchemas,
  renderLandingBody,
  renderNotFoundBody,
} from "./ogInject.js";

// Inspect every application path so an unknown SPA URL can carry a real HTTP
// 404. Static assets bypass middleware entirely. Vercel matcher regex supports
// negative lookaheads; keep this list aligned with public/ and Vite's assets/.
export const config = {
  matcher: [
    "/((?!assets/|fonts/|favicon\\.svg|robots\\.txt|sitemap\\.xml|llms\\.txt|social-preview\\.(?:png|svg)|theme-init\\.js|index\\.html).*)",
  ],
};

/** One place for the HTML response shape (CDN caches the rendered variant). */
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 404
        ? "public, max-age=0, s-maxage=60"
        : "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      ...(status === 404 ? { "x-robots-tag": "noindex, nofollow" } : {}),
    },
  });
}
const LOOKUP_TIMEOUT_MS = 1500;

const STATIC_APP_ROUTES = new Set([
  "/", "/admin", "/browse", "/compare", "/explore", "/privacy",
  "/reset", "/search", "/terms", "/tests",
]);

/** Mirrors the route shapes in App.jsx. Resource existence is checked later. */
export function isSupportedAppPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (STATIC_APP_ROUTES.has(path)) return true;
  // Only REAL exam ids are supported. /tests/anything-else must carry a hard
  // 404 rather than render an empty page — TEST_SECTIONS is the same list the
  // router resolves against, so the two can never disagree.
  if (path.startsWith("/tests/")) {
    return Boolean(findTestSection(path.slice("/tests/".length)));
  }
  if (/^\/explore(?:\/[^/]+){1,5}$/.test(path)) return true;
  if (/^\/faculty\/[^/]+$/.test(path)) return true;
  if (/^\/chapter\/\d+$/.test(path)) return true;
  return /^\/course\/\d+(?:\/chapter\/\d+)?$/.test(path);
}

async function notFoundResponse(url, heading = "Page not found") {
  const shell = await fetch(new URL("/index.html", url.origin));
  if (!shell.ok) return next();
  const meta = {
    ...metadataForLocation(url.pathname, url.search),
    title: `${heading} | ${SITE_NAME}`,
    description:
      "This page does not exist. Browse free courses by exam, class, subject and chapter instead.",
    robots: "noindex, nofollow",
    type: "website",
  };
  let html = injectRouteMeta(await shell.text(), meta);
  html = injectRootContent(html, renderNotFoundBody(url.pathname, heading));
  return htmlResponse(html, 404);
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const courseMatch = url.pathname.match(/^\/course\/(\d+)(?:\/chapter\/(\d+))?\/?$/);
    const facultyMatch = url.pathname.match(/^\/faculty\/([^/]+)\/?$/);

    if (!isSupportedAppPath(url.pathname)) return notFoundResponse(url);

    // Non-course routes need no DB lookup. metadataForLocation is the SAME
    // function the client uses, so server and client never disagree.
    if (!courseMatch && !facultyMatch) {
      const routeMeta = metadataForLocation(url.pathname, url.search);
      if (!routeMeta) return next();
      const shell = await fetch(new URL("/index.html", url.origin));
      if (!shell.ok) return next();
      let html = injectRouteMeta(await shell.text(), routeMeta);
      html = injectStructuredData(html, landingSchemas(url.pathname));
      html = injectRootContent(html, renderLandingBody(url.pathname, routeMeta));
      return htmlResponse(html);
    }

    const supaUrl = process.env.VITE_SUPABASE_URL;
    const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supaUrl || !supaKey) return next();

    if (facultyMatch) {
      let slug;
      try {
        slug = decodeURIComponent(facultyMatch[1]);
      } catch {
        return notFoundResponse(url, "Faculty page not found");
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      let profile;
      let lookupConfirmed = false;
      try {
        const res = await fetch(`${supaUrl}/rest/v1/rpc/get_faculty_profile`, {
          method: "POST",
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ p_slug: slug }),
          signal: controller.signal,
        });
        if (res.ok) {
          profile = await res.json();
          lookupConfirmed = true;
        }
      } finally {
        clearTimeout(timer);
      }
      if (lookupConfirmed && !profile) {
        return notFoundResponse(url, "Faculty page not found");
      }
      if (!lookupConfirmed) return next();

      const shell = await fetch(new URL("/index.html", url.origin));
      if (!shell.ok) return next();
      return htmlResponse(injectRouteMeta(
        await shell.text(),
        metadataForLocation(url.pathname, url.search),
      ));
    }

    const id = courseMatch[1];
    const chapterId = courseMatch[2] ?? null;

    // 1. Look up the course (anon key, public catalogue data) with a hard
    //    timeout so a slow DB never delays the page. Chapter membership is an
    //    independent read, so start it at the same time instead of adding a
    //    second network round-trip to every chapter-scoped course response.
    const lookupCourse = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${supaUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}` +
            `&select=title,teacher,average_rating,ratings_count,subjects(name)` +
            `,institutes_channels(name),playlist_videos(count),lessons:playlist_videos(position,videos(title))` +
            `&lessons.order=position.asc&lessons.limit=60`,
          {
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return { course: null, confirmed: false };
        const rows = await res.json();
        return {
          course: Array.isArray(rows) ? rows[0] : null,
          confirmed: true,
        };
      } finally {
        clearTimeout(timer);
      }
    };

    const lookupChapter = async () => {
      if (!chapterId) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${supaUrl}/rest/v1/playlist_videos` +
            `?playlist_id=eq.${encodeURIComponent(id)}` +
            `&select=playlist_id,videos!inner(chapter_id)` +
            `&videos.chapter_id=eq.${encodeURIComponent(chapterId)}` +
            `&limit=1`,
          {
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return { exists: false, confirmed: false };
        const rows = await res.json();
        return {
          exists: Array.isArray(rows) && rows.length > 0,
          confirmed: true,
        };
      } finally {
        clearTimeout(timer);
      }
    };

    const [courseLookup, chapterLookup] = await Promise.all([
      lookupCourse(),
      lookupChapter(),
    ]);
    const { course, confirmed: lookupConfirmed } = courseLookup;
    if (lookupConfirmed && (!course || !course.title)) {
      return notFoundResponse(url, "Course not found");
    }
    if (!lookupConfirmed) return next();

    // A real course can still be paired with a nonexistent or unrelated
    // chapter id. Confirm membership through the same playlist -> video
    // relationship the catalogue uses, without scanning or returning rows.
    if (chapterLookup) {
      if (chapterLookup.confirmed && !chapterLookup.exists) {
        return notFoundResponse(url, "Chapter not found in this course");
      }
      if (!chapterLookup.confirmed) return next();
    }

    // 2. Fetch the built shell (not matched by this middleware, so no loop)
    //    and swap its head tags.
    const shellRes = await fetch(new URL("/index.html", url.origin));
    if (!shellRes.ok) return next();

    const meta = courseMeta(course, id);
    const lessons = (course.lessons ?? [])
      .map((l) => l?.videos?.title)
      .filter((t) => typeof t === "string" && t.trim());

    // Meta first, then JSON-LD, then the crawler-readable body. Each step is
    // independent: if one pattern does not match the shell it leaves the HTML
    // unchanged rather than corrupting it.
    let html = injectCourseMeta(await shellRes.text(), meta);
    html = injectStructuredData(html, courseSchemas(course, meta));
    html = injectRootContent(html, renderCourseBody(course, meta, lessons));

    return htmlResponse(html);
  } catch {
    return next(); // never break a course page
  }
}
