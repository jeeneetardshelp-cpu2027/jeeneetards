// Guards the browser/server credential split.
//
// VITE_-prefixed variables are inlined into the public frontend bundle by Vite,
// so a VITE_ key is a PUBLIC key. No YouTube key may be read in browser code.
//
// This file used to assert the OPPOSITE for src/youtube.js — that the browser
// importer must keep VITE_YOUTUBE_API_KEY, on the theory that an HTTP-referrer
// restriction made it safe. That theory was wrong and was disproved against the
// live key on 2026-08-10:
//
//   curl https://www.jeeneetard.com/assets/AdminPanel-<hash>.js  -> 200, 86 KB,
//     no auth, containing AIzaSyD12w…
//   same key, no Referer                              -> 403
//   same key, Referer: https://www.jeeneetard.com/admin -> 403  (!)
//   same key, Referer: http://localhost:5173/         -> 200 with real data
//
// Referer is a header the caller controls, so the restriction stopped nobody —
// and because the production domain was not on the allow-list, the admin tooling
// was silently broken in production while remaining usable by strangers.
// api/youtube.js now proxies those calls with a server-only key behind an admin
// session check.
//
// Run: npm test
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = resolve(here, "scripts");

const scriptFiles = readdirSync(SCRIPTS).filter((f) => f.endsWith(".js"));
const read = (f) => readFileSync(join(SCRIPTS, f), "utf8");

// An actual READ of the variable: env.X, process.env.X, env["X"], env['X'].
// A mention inside a quoted string (an error message telling the operator which
// variable to set) is deliberately allowed — that text is how someone recovers.
const readsVar = (src, name) =>
  new RegExp(String.raw`(?:process\s*\.\s*)?env\s*(?:\.\s*${name}\b|\[\s*["']${name}["']\s*\])`).test(src);

// Assertions below must judge CODE, not prose. These files deliberately explain
// in comments which variable was removed and why — naming the old variable in a
// comment is how the next person avoids reintroducing it, so a test that forbids
// the string outright would punish good documentation. Strip comments first.
const codeOnly = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|--)/.test(line))
    .join("\n");

describe("Node scripts never read the browser YouTube key", () => {
  it.each(scriptFiles)("%s does not read VITE_YOUTUBE_API_KEY", (file) => {
    expect(readsVar(read(file), "VITE_YOUTUBE_API_KEY")).toBe(false);
  });

  it("the two YouTube-fetching scripts read the server key instead", () => {
    for (const f of ["importChannel.js", "backfillVideoMetadata.js"]) {
      expect(readsVar(read(f), "YOUTUBE_API_KEY"), `${f} should read YOUTUBE_API_KEY`).toBe(true);
    }
  });

  it("their missing-key errors name the server variable, not the browser one", () => {
    for (const f of ["importChannel.js", "backfillVideoMetadata.js"]) {
      const src = read(f);
      expect(src).toMatch(/YOUTUBE_API_KEY missing from \.env/);
      // and the message should warn against the public key rather than ask for it
      expect(src).toMatch(/do NOT use VITE_YOUTUBE_API_KEY/);
    }
  });
});

describe("no YouTube key reaches the browser bundle", () => {
  const browserFiles = readdirSync(here)
    .filter((f) => (f.endsWith(".js") || f.endsWith(".jsx")) && !f.includes(".test."));

  it.each(browserFiles)("%s reads no YouTube API key from import.meta.env", (file) => {
    const src = codeOnly(readFileSync(join(here, file), "utf8"));
    expect(src).not.toMatch(/import\.meta\.env\.[A-Z_]*YOUTUBE_API_KEY/);
  });

  it("src/youtube.js calls the server proxy instead of googleapis directly", () => {
    const src = codeOnly(readFileSync(resolve(here, "youtube.js"), "utf8"));
    expect(src).toContain("/api/youtube");
    // The browser must not build a googleapis request at all -- if it does, it
    // needs a key to do it, and we are back where we started.
    expect(src).not.toMatch(/googleapis\.com/);
    expect(src).not.toMatch(/\bkey:\s/);
  });

  it("no browser file hardcodes a Google API key", () => {
    for (const file of browserFiles) {
      expect(readFileSync(join(here, file), "utf8"), file).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/);
    }
  });
});

describe("the server proxy is not an open proxy", () => {
  const raw = readFileSync(resolve(here, "..", "api", "youtube.js"), "utf8");
  const src = codeOnly(raw);

  it("reads the server key only, never a VITE_ one", () => {
    expect(src).toMatch(/process\.env\.YOUTUBE_API_KEY/);
    expect(src).not.toMatch(/VITE_YOUTUBE_API_KEY/);
  });

  it("requires an admin session before spending quota", () => {
    // Without this the proxy would be worse than the bundled key: a caller
    // would not even need to spoof a header to drain the daily quota.
    expect(src).toMatch(/rpc\/is_admin/);
    expect(src).toMatch(/authorization/i);
    expect(src).toMatch(/401|Sign in/);
  });

  it("allow-lists the resources and parts rather than forwarding anything", () => {
    expect(src).toMatch(/playlists/);
    expect(src).toMatch(/playlistItems/);
    expect(src).toMatch(/videos/);
    expect(src).toMatch(/Unsupported resource/);
    expect(src).toMatch(/Unsupported part/);
  });

  it("never forwards Google's raw error body", () => {
    // Some Google error payloads echo the request, key included.
    expect(src).toMatch(/YouTube API error/);
    expect(src).not.toMatch(/json\?\.error\?\.message/);
  });
});

describe(".env.example documents both keys", () => {
  const example = readFileSync(resolve(here, "..", ".env.example"), "utf8");

  it("declares the server key placeholder", () => {
    expect(example).toMatch(/^YOUTUBE_API_KEY=/m);
  });

  it("no longer offers a browser key placeholder", () => {
    // Handing someone a VITE_YOUTUBE_API_KEY= line is an instruction to publish
    // a key. The line is kept only as a commented explanation of the removal.
    expect(example).not.toMatch(/^VITE_YOUTUBE_API_KEY=/m);
    expect(example).toMatch(/VITE_YOUTUBE_API_KEY was REMOVED/);
  });

  it("carries no real key values", () => {
    expect(example).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/);
  });
});
