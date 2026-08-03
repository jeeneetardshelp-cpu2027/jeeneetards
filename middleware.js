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
import { metadataForLocation } from "./src/pageMetadata.js";
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
} from "./ogInject.js";

// /course/:id gets full server-rendered content + JSON-LD. Stable discovery
// landings also get crawler-readable body content; deeper /explore paths keep
// the route-specific head tags added by the existing metadata middleware.
export const config = {
  matcher: ["/course/:id*", "/", "/browse", "/explore/:path*"],
};

/** One place for the HTML response shape (CDN caches the rendered variant). */
function htmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LOOKUP_TIMEOUT_MS = 1500;

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/course\/(\d+)/);

    // Non-course routes need no DB lookup. metadataForLocation is the SAME
    // function the client uses, so server and client never disagree.
    if (!match) {
      const routeMeta = metadataForLocation(url.pathname, url.search);
      if (!routeMeta) return next();
      const shell = await fetch(new URL("/index.html", url.origin));
      if (!shell.ok) return next();
      let html = injectRouteMeta(await shell.text(), routeMeta);
      html = injectStructuredData(html, landingSchemas(url.pathname));
      html = injectRootContent(html, renderLandingBody(url.pathname, routeMeta));
      return htmlResponse(html);
    }

    if (!SUPA_URL || !SUPA_KEY) return next();
    const id = match[1];

    // 1. Look up the course (anon key, public catalogue data) with a hard
    //    timeout so a slow DB never delays the page.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    let course = null;
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}` +
          `&select=title,teacher,average_rating,ratings_count,subjects(name)` +
          `,institutes_channels(name),playlist_videos(count),lessons:playlist_videos(position,videos(title))` +
          `&lessons.order=position.asc&lessons.limit=60`,
        {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
          signal: controller.signal,
        },
      );
      if (res.ok) {
        const rows = await res.json();
        course = Array.isArray(rows) ? rows[0] : null;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!course || !course.title) return next();

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
