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
import { courseMeta, injectCourseMeta } from "./ogInject.js";

export const config = { matcher: "/course/:id*" };

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LOOKUP_TIMEOUT_MS = 1500;

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/course\/(\d+)/);
    if (!match || !SUPA_URL || !SUPA_KEY) return next();
    const id = match[1];

    // 1. Look up the course (anon key, public catalogue data) with a hard
    //    timeout so a slow DB never delays the page.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    let course = null;
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}` +
          `&select=title,teacher,subjects(name),playlist_videos(count)`,
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
    const html = injectCourseMeta(await shellRes.text(), courseMeta(course, id));

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // CDN caches the rendered variant; course meta changes rarely.
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return next(); // never break a course page
  }
}
