// testCourseMeta.js — local verification of the Edge middleware's transform.
//
// Exercises the EXACT ogInject.js logic the middleware ships, against the real
// built shell (dist/index.html) and real course rows from Supabase — so we can
// confirm correctness under plain Node before deploying to a preview.
//
//   npm run build   (produce dist/index.html first)
//   node src/scripts/testCourseMeta.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { courseMeta, injectCourseMeta } from "../../ogInject.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = { ...process.env };
  for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const grab = (html, re) => (html.match(re)?.[1] ?? "(no match)");

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing");

  const shell = readFileSync(resolve(here, "../../dist/index.html"), "utf8");

  // Pull a few real courses to transform.
  const res = await fetch(
    `${url}/rest/v1/playlists?select=id,title,teacher,subjects(name),playlist_videos(count)&order=id&limit=3`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const courses = await res.json();

  let pass = 0, fail = 0;
  for (const c of courses) {
    const meta = courseMeta(c, c.id);
    const html = injectCourseMeta(shell, meta);
    const gotTitle = grab(html, /<title>([\s\S]*?)<\/title>/);
    const gotOgTitle = grab(html, /<meta property="og:title" content="([^"]*)"/);
    const gotOgDesc = grab(html, /<meta property="og:description" content="([^"]*)"/);
    const gotOgUrl = grab(html, /<meta property="og:url" content="([^"]*)"/);
    const gotCanonical = grab(html, /<link rel="canonical" href="([^"]*)"/);

    const titleOk = gotTitle === meta.title && gotOgTitle === meta.title;
    const descOk = gotOgDesc === meta.description && !/course finder/.test(gotOgDesc);
    const urlOk = gotOgUrl === meta.url;
    // The canonical must be the course URL, present exactly once.
    const canonicalOk =
      gotCanonical === meta.url &&
      (html.match(/<link rel="canonical"/g) || []).length === 1;
    // og:image must remain the default branded card (unchanged).
    const imageOk = /og:image" content="https:\/\/www\.jeeneetard\.com\/social-preview\.png"/.test(html);
    const ok = titleOk && descOk && urlOk && canonicalOk && imageOk;
    ok ? pass++ : fail++;

    console.log(`\n/course/${c.id}  ${ok ? "✓" : "✗ FAIL"}`);
    console.log(`  <title>      ${gotTitle}`);
    console.log(`  og:title     ${gotOgTitle}`);
    console.log(`  og:desc      ${gotOgDesc}`);
    console.log(`  og:url       ${gotOgUrl}`);
    console.log(`  canonical    ${gotCanonical}`);
    console.log(`  og:image kept default: ${imageOk}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
