// Guards the browser/server credential split.
//
// VITE_-prefixed variables are inlined into the public frontend bundle by Vite.
// That is correct for the admin panel's importer (the key is public and must be
// HTTP-referrer restricted), and wrong for the Node scripts, which fetch in
// bulk and should carry a separate, IP-restricted server key.
//
// The failure this prevents is silent: a Node script reading
// VITE_YOUTUBE_API_KEY works perfectly in development, and only shows up later
// as quota burned against the public key — or as a referrer-restricted key
// mysteriously rejecting a script that sends no Referer header.
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

describe("the browser importer keeps the VITE key", () => {
  it("src/youtube.js still uses import.meta.env.VITE_YOUTUBE_API_KEY", () => {
    const src = readFileSync(resolve(here, "youtube.js"), "utf8");
    // asserted in the POSITIVE direction too: moving the browser importer onto
    // the server key would leak an unrestricted credential into the bundle
    expect(src).toMatch(/import\.meta\.env\.VITE_YOUTUBE_API_KEY/);
    expect(src).not.toMatch(/import\.meta\.env\.YOUTUBE_API_KEY\b/);
  });
});

describe(".env.example documents both keys", () => {
  const example = readFileSync(resolve(here, "..", ".env.example"), "utf8");

  it("declares the server key placeholder", () => {
    expect(example).toMatch(/^YOUTUBE_API_KEY=/m);
  });

  it("still declares the browser key placeholder", () => {
    expect(example).toMatch(/^VITE_YOUTUBE_API_KEY=/m);
  });

  it("carries no real key values", () => {
    expect(example).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/);
  });
});
