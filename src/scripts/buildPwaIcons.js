// =====================================================================
// buildPwaIcons.js - rasterise public/favicon.svg into the PWA icon set.
//
// Run manually (node src/scripts/buildPwaIcons.js) whenever the favicon
// changes; the PNGs it writes to public/icons/ are committed. It is NOT part
// of the build: the icons change only when the logo does, and a deploy must
// not depend on a native rasteriser doing design work nobody reviewed.
//
// Four outputs, one source of truth:
//   icon-192.png / icon-512.png  - the favicon as-is (rounded rect on a
//                                  transparent canvas), for manifest
//                                  purpose "any".
//   maskable-512.png             - full-bleed variant for purpose "maskable":
//                                  Android crops an arbitrary shape out of the
//                                  icon, so the artwork is scaled to 80% (the
//                                  documented safe zone) and centred on the
//                                  brand navy pulled from the favicon itself.
//   apple-touch-icon.png (180)   - same full-bleed treatment; iOS ignores
//                                  manifest icons, applies its own corner
//                                  rounding, and paints black behind any
//                                  transparency, so the "any" icon's
//                                  transparent corners would look broken.
//
// Uses @resvg/resvg-js, already a dependency (api/og.js renders share cards
// with it), so this adds nothing to package.json.
// =====================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const faviconPath = resolve(repoRoot, "public", "favicon.svg");
const outDir = resolve(repoRoot, "public", "icons");

const favicon = readFileSync(faviconPath, "utf8");

// The maths below assumes the favicon's 64-unit canvas; fail loudly rather
// than silently mis-placing artwork if someone redraws it on another grid.
if (!/viewBox="0 0 64 64"/.test(favicon)) {
  throw new Error("public/favicon.svg is no longer on a 0 0 64 64 viewBox - update buildPwaIcons.js to match");
}

// Full-bleed background = the favicon's own rounded-rect fill, read from the
// file so a rebrand cannot leave the maskable padding a stale colour.
const navyMatch = favicon.match(/<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/);
if (!navyMatch) {
  throw new Error("could not find the background rect fill in public/favicon.svg");
}
const navy = navyMatch[1];

// Everything between the outer <svg ...> and </svg> tags, re-nested below.
const inner = favicon.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// Nested <svg> keeps the original artwork untouched: 80% of the canvas
// (51.2 of 64 units) centred, which keeps every shape inside the maskable
// safe zone - a circle of 80% diameter - because the glyph is already inset
// within the favicon's own canvas.
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${navy}"/>
  <svg x="6.4" y="6.4" width="51.2" height="51.2" viewBox="0 0 64 64">${inner}</svg>
</svg>`;

function renderPng(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

mkdirSync(outDir, { recursive: true });

const outputs = [
  ["icon-192.png", renderPng(favicon, 192)],
  ["icon-512.png", renderPng(favicon, 512)],
  ["maskable-512.png", renderPng(fullBleed, 512)],
  ["apple-touch-icon.png", renderPng(fullBleed, 180)],
];

for (const [name, png] of outputs) {
  writeFileSync(resolve(outDir, name), png);
  console.log(`wrote public/icons/${name} (${png.length} bytes)`);
}
