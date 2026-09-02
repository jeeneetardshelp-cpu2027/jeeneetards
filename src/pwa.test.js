// PWA installability — the conservative subset, pinned.
//
// The decision (Phase 3): a home-screen icon and an app-like launch are most
// of a native app's value, so the site ships a manifest and a MINIMAL service
// worker. The worker precaches nothing and never caches a navigation — the
// whole point of these tests is to keep it that way, because aggressive SPA
// caching is how a site serves a stale deploy forever.
//
// HONESTY: jsdom cannot install a service worker, go offline, or run
// Lighthouse. What CAN be verified here is verified — the manifest is valid
// and its icons really exist at the declared pixel sizes, index.html links
// everything, and public/sw.js makes the right routing decision for every
// class of request (the file is evaluated the way the browser evaluates it,
// so the function under test is the shipped one, not a copy). Install and
// offline behaviour need a real browser against the deployed site.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const ORIGIN = "https://www.jeeneetard.com";

// public/sw.js is a classic worker script, not a module. Evaluate it against
// a stub `self` (same technique as themeColor.test.js uses for theme-init.js)
// and pull out the pure routing function it exposes for exactly this purpose.
function loadRouteRequest() {
  const self = { addEventListener: () => {} };
  new Function("self", read("public/sw.js"))(self);
  expect(typeof self.__routeRequest).toBe("function");
  return (request) => self.__routeRequest(request, ORIGIN);
}

describe("manifest", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));

  it("declares the identity and standalone launch an install needs", () => {
    expect(manifest.name).toBe("JEENEETARD");
    expect(manifest.short_name).toBe("JEENEETARD");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("matches the real dark default the first frame actually paints", () => {
    // #0a0a0a is CHROME_COLOUR.dark in public/theme-init.js and --canvas in
    // src/index.css; themeColor.test.js pins those two to each other.
    expect(manifest.theme_color).toBe("#0a0a0a");
    expect(manifest.background_color).toBe("#0a0a0a");
    expect(read("public/theme-init.js")).toContain('dark: "#0a0a0a"');
  });

  it("references icons that exist on disk at the declared pixel sizes", () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const png = readFileSync(resolve(root, "public", icon.src.replace(/^\//, "")));
      // PNG signature, then IHDR width/height (the same header check
      // seoAssets.test.js applies to the social preview).
      expect(png.subarray(0, 8).toString("hex"), `${icon.src} is not a PNG`)
        .toBe("89504e470d0a1a0a");
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(png.readUInt32BE(16), `${icon.src} width`).toBe(w);
      expect(png.readUInt32BE(20), `${icon.src} height`).toBe(h);
      expect(icon.type).toBe("image/png");
    }
  });

  it("covers the 192/512 'any' sizes plus a maskable variant for Android", () => {
    const byPurpose = (purpose, size) => manifest.icons.some(
      (icon) => icon.purpose === purpose && icon.sizes === size,
    );
    expect(byPurpose("any", "192x192")).toBe(true);
    expect(byPurpose("any", "512x512")).toBe(true);
    expect(byPurpose("maskable", "512x512")).toBe(true);
  });
});

describe("index.html wires the PWA in", () => {
  const html = read("index.html");

  it("links the manifest", () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
  });

  it("gives iOS its full-bleed apple-touch-icon, and the file exists", () => {
    const match = html.match(/rel="apple-touch-icon" href="([^"]+)"/);
    expect(match).not.toBeNull();
    const png = readFileSync(resolve(root, "public", match[1].replace(/^\//, "")));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});

describe("sw.js routing decisions (the shipped function, evaluated)", () => {
  const route = loadRouteRequest();
  const get = (url, mode = "no-cors") => ({ url, mode, method: "GET" });
  const navigate = (url) => ({ url, mode: "navigate", method: "GET" });

  it("serves navigations network-first (so a deploy is never pinned)", () => {
    expect(route(navigate(`${ORIGIN}/`))).toBe("navigation");
    expect(route(navigate(`${ORIGIN}/browse`))).toBe("navigation");
    expect(route(navigate(`${ORIGIN}/course/12/chapter/3`))).toBe("navigation");
  });

  it("serves hashed immutable /assets/ cache-first", () => {
    expect(route(get(`${ORIGIN}/assets/index-B3xQz9kd.js`))).toBe("asset");
    expect(route(get(`${ORIGIN}/assets/supabase-Ck2P1a.js`))).toBe("asset");
  });

  it("NEVER intercepts /api/ — not even as a navigation", () => {
    expect(route(get(`${ORIGIN}/api/youtube`))).toBe("pass");
    expect(route(navigate(`${ORIGIN}/api/og?id=5`))).toBe("pass");
    expect(route(get(`${ORIGIN}/api`))).toBe("pass");
  });

  it("NEVER intercepts /study-materials/ — the 308 into Supabase Storage must reach the browser", () => {
    expect(route(navigate(`${ORIGIN}/study-materials/formula-sheets/algebra.pdf`))).toBe("pass");
    expect(route(get(`${ORIGIN}/study-materials/previous-year-papers/jee/2024.pdf`))).toBe("pass");
  });

  it("NEVER intercepts cross-origin requests", () => {
    expect(route(get("https://kezelafqhgqrprpadmlf.supabase.co/rest/v1/playlists"))).toBe("pass");
    expect(route(navigate("https://www.youtube-nocookie.com/embed/x"))).toBe("pass");
    expect(route(get("https://i.ytimg.com/vi/x/hqdefault.jpg"))).toBe("pass");
  });

  it("leaves non-GET and unhashed same-origin files alone", () => {
    expect(route({ url: `${ORIGIN}/assets/x.js`, mode: "cors", method: "POST" })).toBe("pass");
    expect(route(get(`${ORIGIN}/theme-init.js`))).toBe("pass");
    expect(route(get(`${ORIGIN}/sw.js`))).toBe("pass");
    expect(route(get(`${ORIGIN}/fonts/inter-latin-wght-normal.woff2`))).toBe("pass");
  });
});

describe("sw.js stays deploy-safe", () => {
  const source = read("public/sw.js");

  it("precaches nothing from the network — no addAll, no shell URL list", () => {
    expect(source).not.toContain("addAll");
    expect(source).not.toContain('"/index.html"');
  });

  it("synthesises the offline page at install instead of fetching it", () => {
    expect(source).toContain("You're offline");
    // The offline copy goes into the cache as a constructed Response; a
    // network fetch here could cache a middleware 404 or a stale deploy.
    expect(source).toMatch(/cache\.put\(OFFLINE_URL,\s*new Response\(OFFLINE_HTML/);
  });

  it("takes over promptly on deploy and cleans up old caches", () => {
    expect(source).toContain("skipWaiting");
    expect(source).toContain("clients.claim");
    expect(source).toContain("caches.delete");
    // Cache names carry the version, so a bump orphans (and deletes) old ones.
    expect(source).toMatch(/const VERSION = "v\d+"/);
  });
});

describe("vercel.json serves the PWA files correctly", () => {
  const config = JSON.parse(read("vercel.json"));
  const headersFor = (sourcePattern) =>
    config.headers.find((entry) => entry.source === sourcePattern)?.headers ?? [];

  it("serves /sw.js with no-cache — a cached service worker pins old code", () => {
    expect(headersFor("/sw.js")).toContainEqual({
      key: "Cache-Control",
      value: "no-cache",
    });
  });

  it("gives the manifest and icons sensible short caches", () => {
    expect(headersFor("/manifest.webmanifest")).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=3600",
    });
    expect(headersFor("/icons/(.*)")).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=86400",
    });
  });

  it("keeps a CSP that allows the same-origin worker and manifest", () => {
    const csp = headersFor("/(.*)").find((h) => h.key === "Content-Security-Policy")?.value;
    expect(csp).toBeTruthy();
    // No worker-src or manifest-src directive: worker registration falls back
    // to script-src, manifest fetch to default-src — both of which are 'self',
    // and both files are same-origin. Adding either directive without 'self'
    // would silently kill the PWA.
    expect(csp).not.toContain("worker-src");
    expect(csp).not.toContain("manifest-src");
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/script-src 'self'/);
  });
});
