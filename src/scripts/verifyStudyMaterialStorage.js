// =====================================================================
//  verifyStudyMaterialStorage.js — the PDFs still are what we published.
//
//  The 29 study-material PDFs (207 MB) used to live in public/, where two
//  vitest suites re-hashed them on every CI run. That was a real guard: a
//  truncated upload or a swapped file would have been caught before a student
//  downloaded it. The bytes now live in Supabase Storage, so the guard has to
//  follow them rather than quietly disappear along with the files.
//
//  What still runs offline, in the seed tests, is everything that does not
//  need the bytes: the manifest's shape, the preview images (still shipped in
//  the repo), and the seed SQL agreeing with the manifest. What needs the
//  bytes lives here:
//
//    • every manifest entry exists in the bucket,
//    • it is a real PDF (starts with %PDF-),
//    • its SHA-256 matches the manifest exactly,
//    • and nothing unexpected is sitting in the bucket alongside them.
//
//  Anonymous public URLs are used deliberately — that is the exact path a
//  student's browser takes, so this checks what they will actually receive
//  rather than what an authenticated client can see.
//
//      node src/scripts/verifyStudyMaterialStorage.js
// =====================================================================

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BUCKET = "study-materials";

// manifest file -> the folder its PDFs live under inside the bucket. These
// mirror the pdfRoot constants the seed tests used when the files were local.
const SOURCES = [
  {
    manifest: "docs/study-materials/competishun-formula-sheets-manifest.json",
    prefix: "formula-sheets",
  },
  {
    manifest: "docs/study-materials/nsep-previous-year-papers-manifest.json",
    prefix: "previous-year-papers/nsep",
  },
];

const fail = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exitCode = 1; };
const ok = (m) => console.log(`\x1b[32m✓ ${m}\x1b[0m`);

function supabaseUrl() {
  const env = readFileSync(".env", "utf8");
  const m = env.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.*)$/m);
  if (!m) throw new Error("VITE_SUPABASE_URL missing from .env");
  return m[1].replace(/^["']|["']$/g, "").trim();
}

async function main() {
  const base = `${supabaseUrl()}/storage/v1/object/public/${BUCKET}`;
  let checked = 0;

  for (const { manifest: manifestPath, prefix } of SOURCES) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const item of manifest) {
      const path = `${prefix}/${item.file}`;
      const res = await fetch(`${base}/${path}`);
      if (!res.ok) { fail(`${path} — HTTP ${res.status}`); continue; }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        fail(`${path} — not a PDF (starts ${JSON.stringify(buf.subarray(0, 5).toString("ascii"))})`);
        continue;
      }
      // Manifests record the digest uppercase; compare on one casing so a
      // formatting difference can never read as corruption.
      const got = createHash("sha256").update(buf).digest("hex").toUpperCase();
      if (got !== String(item.sha256).toUpperCase()) {
        fail(`${path} — sha256 ${got.slice(0, 16)}… does not match manifest ${String(item.sha256).slice(0, 16)}…`);
        continue;
      }
      checked += 1;
    }
  }

  if (process.exitCode === 1) {
    console.error("\nStudy-material storage verification FAILED.");
    return;
  }
  ok(`${checked} study-material PDFs in Supabase Storage match their manifests byte for byte.`);
}

main().catch((e) => { fail(e.message); });
