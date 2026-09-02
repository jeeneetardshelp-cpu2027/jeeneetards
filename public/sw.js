// sw.js — service worker, the deliberately SMALL subset of PWA behaviour.
//
// WHY SO LITTLE. Aggressive SPA caching is how sites serve a stale deploy
// forever: precache index.html once and every later release fights the cache.
// This worker precaches NOTHING from the network and never caches a
// navigation response. It exists for exactly three things:
//
//   1. Installability — a fetch handler is part of what makes the browser
//      offer "Add to Home screen" as a real app install.
//   2. Hashed assets under /assets/ are content-addressed (the hash is in the
//      filename), so cache-first is provably safe: a new deploy references
//      new filenames and simply never asks for the old ones.
//   3. A student with no connection gets a small honest page instead of the
//      browser's dinosaur. The page is synthesised right here at install —
//      no network fetch, so a broken deploy can never poison it.
//
// NEVER touched, decided in routeRequest below and pinned by src/pwa.test.js:
//   - /api/*                  (serverless functions, not app pages)
//   - /study-materials/*      (308-redirects into Supabase Storage; the
//                              redirect must reach the browser untouched)
//   - anything cross-origin   (YouTube, Supabase, fonts — not ours to cache)
//   - non-GET requests
//
// DEPLOY SAFETY. Bump VERSION whenever this file's caching behaviour changes:
// activate deletes every cache from other versions, and skipWaiting +
// clients.claim let a new deploy's worker take over promptly instead of
// waiting for every tab to close. Vercel serves this file with
// Cache-Control: no-cache (see vercel.json) so the browser re-checks it on
// every navigation — a cached service worker pins old code.

const VERSION = "v1";
const CACHE_PREFIX = "jeeneetard-";
const ASSET_CACHE = `${CACHE_PREFIX}assets-${VERSION}`;
const OFFLINE_CACHE = `${CACHE_PREFIX}offline-${VERSION}`;
const CURRENT_CACHES = [ASSET_CACHE, OFFLINE_CACHE];

// Synthetic cache key for the offline page — never fetched, so the edge
// middleware and the SPA rewrite never see it.
const OFFLINE_URL = "/__offline__";

// Network-first budget for navigations. Airplane mode rejects instantly, so
// this only governs "lie-fi" — a connection that hangs without answering.
// Generous on purpose: many students are on slow 2G/3G, and replacing a page
// that IS slowly arriving with "You're offline" would be worse than waiting.
const NAVIGATION_TIMEOUT_MS = 6000;

// Self-contained offline page. Inline styles only; dark is the product
// default (matches theme-init.js and the manifest colours) and a stored
// light choice is honoured the same way theme-init.js honours it. The
// "Try again" link has an empty href, which re-requests the current URL —
// no script needed for the retry. 44px minimum target.
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>You're offline — JEENEETARD</title>
<script>try{if(localStorage.getItem("lecture-library-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}</script>
<style>
  html{background:#0a0a0a;color-scheme:dark}
  html[data-theme=light]{background:#ffffff;color-scheme:light}
  body{margin:0;min-height:100vh;display:grid;place-items:center;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#0a0a0a;color:#f5f5f5}
  html[data-theme=light] body{background:#ffffff;color:#171717}
  main{text-align:center;padding:24px;max-width:28rem}
  h1{font-size:1.25rem;margin:0 0 8px}
  p{margin:0 0 24px;opacity:.75;line-height:1.5}
  a{display:inline-flex;align-items:center;justify-content:center;
    min-height:44px;min-width:44px;padding:0 24px;border-radius:9999px;
    background:#0F6F78;color:#ffffff;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>Lessons stream from YouTube, so they need a connection. Reconnect and try again.</p>
  <a href="">Try again</a>
</main>
</body>
</html>`;

// The ONE routing decision, kept pure so src/pwa.test.js can evaluate this
// file in Node and pin every rule above. Takes anything with url/mode/method
// (the real FetchEvent request, or a plain object in tests) and returns:
//   "pass"       — do not call respondWith; the browser behaves as if no
//                  service worker existed (redirects, APIs, cross-origin).
//   "navigation" — network-first with the offline fallback.
//   "asset"      — cache-first, safe because /assets/ filenames are hashed.
function routeRequest(request, swOrigin) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return "pass";
  }
  if (url.origin !== swOrigin) return "pass";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return "pass";
  if (url.pathname === "/study-materials" || url.pathname.startsWith("/study-materials/")) return "pass";
  if (request.mode === "navigate") return "navigation";
  if (request.method !== "GET") return "pass";
  if (url.pathname.startsWith("/assets/")) return "asset";
  return "pass";
}
// Test hook: lets src/pwa.test.js grab the function after evaluating this
// classic (non-module) script against a stub `self`.
self.__routeRequest = routeRequest;

async function assetCacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Only a clean same-origin 200 is worth keeping: never a 206 partial, an
  // error page, or anything opaque. A failed put (quota) must not break the
  // response that is already on its way to the page.
  if (response.status === 200 && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function navigationNetworkFirst(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    // Server responses — including real 404s and 500s — pass through
    // untouched; only a failed or timed-out FETCH falls back to the offline
    // page. Serving "offline" over a real server error would lie.
    return await fetch(request, { signal: controller.signal });
  } catch {
    const cache = await caches.open(OFFLINE_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    // Should be unreachable (install put the page there), but never throw
    // out of a respondWith.
    return new Response("You're offline. Reconnect and try again.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.put(OFFLINE_URL, new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name))
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const decision = routeRequest(event.request, self.location.origin);
  if (decision === "asset") {
    event.respondWith(assetCacheFirst(event.request));
  } else if (decision === "navigation") {
    event.respondWith(navigationNetworkFirst(event.request));
  }
  // "pass": no respondWith, the request proceeds as if this worker were absent.
});
