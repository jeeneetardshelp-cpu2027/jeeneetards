// packReview.js — produce a review archive that CANNOT contain credentials.
//
//   npm run pack:review
//
// Why this exists: a review archive was once created by compressing the project
// folder directly. That sweeps in .env, .env.staging, node_modules, dist and
// internal settings — a 31 MB archive carrying live service-role and YouTube
// keys. Excluding things by hand is a step someone will eventually forget, so
// this builds the file from an ALLOW-list and then re-opens it and refuses to
// leave a leaking archive on disk.
//
// Two independent gates:
//   1. allow-list — only known-safe paths are added
//   2. post-build scan — the finished archive is re-read, and any credential
//      pattern or forbidden path DELETES it and exits non-zero
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stamp = process.argv[2] ?? "review";
const stage = resolve(root, ".pack-tmp");
// OUTSIDE the project: an archive written into the tree can be swept into the
// NEXT archive, and a stray .zip on the Desktop is what gets shared by mistake.
const outDir = resolve(root, "..", "edu-library-review-archives");
const outZip = resolve(outDir, `edu-library-${stamp}.zip`);

// ---- 1. ALLOW-LIST -------------------------------------------------------
const ALLOW_DIRS = ["src", "docs", "production", "public"];
const ALLOW_FILES = [
  "package.json", "package-lock.json", "vite.config.js", "index.html",
  "README.md", "CLAUDE.md", "AGENTS.md", ".gitignore", ".vercelignore",
  "vercel.json", "netlify.toml",
  "schema.sql", "seed.sql", "community_schema.sql", "courses_data.sql",
  "admin_policies.sql", "playlist_idempotency.sql",
  "staging_bootstrap.sql", "staging_bootstrap.sha256.txt",
  "faculty_staging_delta.sql", "faculty_staging_delta.sha256.txt",
  "faculty_staging_repair_1.sql", "faculty_staging_repair_1.sha256.txt",
  "comparison_staging_delta.sql", "comparison_staging_delta.sha256.txt",
  // Placeholder templates only — they document the variable names a reviewer
  // needs without carrying any value. The scan below still checks them.
  ".env.example", ".env.staging.example",
];
// Never, under any circumstances.
const DENY = [
  // Deny every .env EXCEPT a *.example template. The lookahead is what lets
  // .env.example through while .env and .env.staging stay out — documenting
  // which variables exist is useful; shipping their values is the incident.
  /(^|[\\/])\.env(?!.*\.example$)/i,
  /(^|[\\/])node_modules([\\/]|$)/, /(^|[\\/])dist([\\/]|$)/,
  /(^|[\\/])\.git([\\/]|$)/, /(^|[\\/])\.claude([\\/]|$)/, /(^|[\\/])\.vite([\\/]|$)/,
  /(^|[\\/])archive([\\/]|$)/, /drift-report\.json$/, /test-report\.json$/,
  /(^|[\\/])ui-audit([\\/]|$)/, /\.rar$/i, /\.zip$/i,
  /(^|[\\/])\.report-browser-fixture\.json$/i,
];
// Credential shapes. Placeholders in .example files are matched too, but no
// .example file is in the allow-list, so nothing legitimate trips this.
const SECRET = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "Supabase secret key"],
  [/sb_publishable_[A-Za-z0-9_-]{10,}/, "Supabase publishable key"],
  [/eyJhbGciOi[A-Za-z0-9_.-]{20,}/, "JWT (anon/service_role)"],
  [/AIza[A-Za-z0-9_-]{30,}/, "Google/YouTube API key"],
  // Match the VALUE, not the variable name: a template that says
  // SUPABASE_SERVICE_ROLE_KEY=your-service-role-key is documentation, and
  // refusing it would push people back to hand-rolled archives. A real key is
  // always sb_secret_* or a JWT.
  [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(sb_secret_|eyJhbGciOi)/i, "service-role key value"],
];

const denied = (rel) => DENY.some((re) => re.test(rel));

function collect(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(root, abs);
    if (denied(rel)) continue;
    if (statSync(abs).isDirectory()) collect(abs, acc);
    else acc.push(rel);
  }
  return acc;
}

// Every file under `base`, relative to it, with NO filtering — used to inspect
// what actually came out of the archive. Filtering here would defeat the point:
// the extracted tree must be judged on what it contains, not on what we would
// have allowed in.
function collectAny(base, dir = base, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) collectAny(base, abs, acc);
    else acc.push(relative(base, abs));
  }
  return acc;
}

if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const files = [];
for (const d of ALLOW_DIRS) {
  const abs = resolve(root, d);
  if (existsSync(abs)) files.push(...collect(abs));
}
for (const f of ALLOW_FILES) {
  if (existsSync(resolve(root, f)) && !denied(f)) files.push(f);
}

for (const rel of files) {
  const dest = join(stage, rel);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(resolve(root, rel), dest);
}

// ---- 2. pre-zip content scan --------------------------------------------
const leaks = [];
for (const rel of files) {
  const p = join(stage, rel);
  let text;
  try { text = readFileSync(p, "utf8"); } catch { continue; }   // binary
  for (const [re, label] of SECRET) if (re.test(text)) leaks.push(`${rel}: ${label}`);
}
if (leaks.length) {
  rmSync(stage, { recursive: true, force: true });
  console.error("REFUSING TO PACK — credential material found:");
  for (const l of leaks) console.error("   " + l);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(outZip)) rmSync(outZip, { force: true });
execFileSync("powershell", ["-NoProfile", "-Command",
  `Compress-Archive -Path '${stage}\\*' -DestinationPath '${outZip}' -Force`], { stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });

// ---- 3. EXTRACT the finished archive and re-scan what actually comes out --
//
// Listing entry names is not enough: it proves what the archive claims to
// contain, not what a reviewer ends up with on disk. Extract to a scratch
// directory and run the same credential scan over the extracted files.
const probe = resolve(outDir, `.verify-${Date.now()}`);
rmSync(probe, { recursive: true, force: true });
execFileSync("powershell", ["-NoProfile", "-Command",
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
  `[System.IO.Compression.ZipFile]::ExtractToDirectory('${outZip}', '${probe}')`], { stdio: "inherit" });

const extracted = collectAny(probe);
const fail = (why, detail) => {
  rmSync(probe, { recursive: true, force: true });
  rmSync(outZip, { force: true });
  console.error(`REFUSING — ${why} (archive deleted):`);
  for (const d of detail.slice(0, 10)) console.error("   " + d);
  process.exit(1);
};

// a. forbidden paths
const badPaths = extracted.filter((rel) => denied(rel));
if (badPaths.length) fail("forbidden paths in the extracted archive", badPaths);

// b. the archive must not contain itself or any other archive
const selfIncluded = extracted.filter((rel) => /\.(zip|rar|7z|tar|gz)$/i.test(rel));
if (selfIncluded.length) fail("the archive contains archives (possible self-inclusion)", selfIncluded);

// c. credential scan over the EXTRACTED bytes
const extractedLeaks = [];
for (const rel of extracted) {
  let text;
  try { text = readFileSync(join(probe, rel), "utf8"); } catch { continue; }
  for (const [re, label] of SECRET) if (re.test(text)) extractedLeaks.push(`${rel}: ${label}`);
}
if (extractedLeaks.length) fail("credential material in the extracted archive", extractedLeaks);

// d. any .env* that survived must be a placeholder template only
const envFiles = extracted.filter((rel) => /(^|[\\/])\.env/i.test(rel));
const badEnv = envFiles.filter((rel) => !/\.example$/i.test(rel));
if (badEnv.length) fail("a real .env file is in the archive", badEnv);

rmSync(probe, { recursive: true, force: true });

// ---- 4. manifest + hash --------------------------------------------------
const sha = execFileSync("powershell", ["-NoProfile", "-Command",
  `(Get-FileHash -Algorithm SHA256 '${outZip}').Hash`], { encoding: "utf8" }).trim().toLowerCase();
const kb = Math.round(statSync(outZip).size / 1024);
const manifest = [...extracted].sort();
writeFileSync(outZip.replace(/\.zip$/, ".manifest.txt"),
  `edu-library review archive\n` +
  `sha256: ${sha}\n` +
  `size:   ${kb} KB\n` +
  `files:  ${manifest.length}\n\n` +
  `Verified: allow-list build, pre-zip scan, extraction, re-scan of extracted\n` +
  `bytes, no real .env, no nested archives.\n\n` +
  manifest.join("\n") + "\n");

console.log(`\n✓ ${outZip}`);
console.log(`  sha256 : ${sha}`);
console.log(`  size   : ${kb} KB, ${manifest.length} files`);
console.log(`  gates  : allow-list · pre-zip scan · extraction · extracted re-scan · no real .env · no nested archives`);
console.log(`  manifest -> ${relative(outDir, outZip.replace(/\.zip$/, ".manifest.txt"))}`);
if (envFiles.length) console.log(`  .env templates included (placeholders only): ${envFiles.join(", ")}`);
if (kb > 5000) console.log(`  ⚠ ${kb} KB is large for a source-only archive — inspect before sharing.`);
