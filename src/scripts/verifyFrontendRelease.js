import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_BROWSER_ENV,
  PRIVATE_SERVER_ENV,
  resolveReleaseEnvironment,
} from "./releaseEnv.js";

const root = process.cwd();
const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => failures.push(message);

const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

const REQUIRED_HEADERS = [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
];
const REQUIRED_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
];
const VERCEL_SPA_FALLBACKS = [
  "/((?!api/|study-materials/).*)",
];

function verifyHeaderSet(label, headers) {
  const normalized = new Map(
    headers.map(({ key, value }) => [key.toLowerCase(), String(value)]),
  );
  for (const name of REQUIRED_HEADERS) {
    if (!normalized.has(name.toLowerCase())) fail(`${label} is missing ${name}`);
  }
  const csp = normalized.get("content-security-policy") ?? "";
  for (const directive of REQUIRED_CSP) {
    if (!csp.includes(directive)) fail(`${label} CSP is missing: ${directive}`);
  }
  if (REQUIRED_HEADERS.every((name) => normalized.has(name.toLowerCase()))
      && REQUIRED_CSP.every((directive) => csp.includes(directive)))
    pass(`${label} security headers are complete`);
}

const hasEnvFile = exists(".env");
if (!hasEnvFile && process.env.CI !== "true") fail(".env is missing");
else if (!hasEnvFile) pass("CI uses explicit non-secret browser placeholders");
if (!exists("dist/index.html")) fail("dist/index.html is missing; run npm run build first");
if (!exists("vercel.json")) fail("vercel.json is missing");
if (!exists("netlify.toml")) fail("netlify.toml is missing");

const env = resolveReleaseEnvironment(
  hasEnvFile ? read(".env") : "",
  process.env,
);
for (const name of PUBLIC_BROWSER_ENV) {
  const value = env[name];
  if (!value || value.startsWith("your-")) fail(`${name} is not configured`);
  else pass(`${name} is configured as an intentionally public browser value`);
}

const textFiles = exists("dist")
  ? fs.readdirSync(path.join(root, "dist"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:html|css|js)$/.test(entry.name))
      .map((entry) => fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"))
      .join("\n")
  : "";

for (const name of PRIVATE_SERVER_ENV) {
  const value = env[name];
  if (value && textFiles.includes(value)) fail(`${name} leaked into dist`);
  else pass(`${name} is absent from dist`);
}

if (exists("vercel.json")) {
  const config = JSON.parse(read("vercel.json"));
  const fallback = config.rewrites?.some(
    (rule) => VERCEL_SPA_FALLBACKS.includes(rule.source)
      && rule.destination === "/index.html",
  );
  if (!fallback) fail("Vercel SPA fallback is missing");
  else pass("Vercel SPA fallback is configured");
  const globalHeaders = config.headers?.find((rule) => rule.source === "/(.*)")?.headers ?? [];
  verifyHeaderSet("Vercel", globalHeaders);
}

if (exists("netlify.toml")) {
  const config = read("netlify.toml");
  if (!/from\s*=\s*"\/\*"[\s\S]*to\s*=\s*"\/index\.html"[\s\S]*status\s*=\s*200/.test(config))
    fail("Netlify SPA fallback is missing");
  else pass("Netlify SPA fallback is configured");
  const netlifyHeaders = REQUIRED_HEADERS.map((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = config.match(new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]*)"`, "mi"));
    return { key, value: match?.[1] ?? "" };
  }).filter(({ value }) => value);
  verifyHeaderSet("Netlify", netlifyHeaders);
}

if (exists("index.html")) {
  const source = read("index.html");
  if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(source))
    fail("index.html contains inline JavaScript, which weakens script-src");
  else pass("index.html contains no inline JavaScript");

  if (/find and compare/i.test(source))
    fail("index.html promises comparison even though the release disables it");
  else pass("index.html describes the browse-only release truthfully");

  for (const required of [
    'rel="icon"',
    'property="og:image"',
    'name="twitter:card"',
  ]) {
    if (!source.includes(required)) fail(`index.html is missing ${required}`);
  }

  // The shell is served for EVERY route, so a static canonical would claim
  // the homepage on all of them. Canonicals are injected per-route instead
  // (edge middleware for courses, PageMetadata client-side) — the shell
  // shipping one is a release failure, not a requirement.
  if (source.includes('rel="canonical"'))
    fail("index.html ships a static canonical, which would claim the homepage on every route");
  else pass("index.html leaves canonicals to per-route injection");
}

if (exists("dist/index.html") && !read("dist/index.html").includes('name="description"'))
  fail("production HTML has no description metadata");
else if (exists("dist/index.html")) pass("production HTML includes release metadata");

for (const asset of [
  "dist/favicon.svg",
  "dist/social-preview.png",
  "dist/robots.txt",
  "dist/llms.txt",
  "dist/sitemap.xml",
]) {
  if (!exists(asset)) fail(`production build is missing ${asset}`);
  else pass(`production build includes ${asset}`);
}

// One player, and it must be the privacy-enhanced host. src/BrowsePage.jsx was
// checked here too, because the browse "Individual lectures" tab used to play
// in a bare iframe of its own — a second player that recorded no progress and
// fed no streak. That player was deleted (the cards are links to the real
// watch page now), so the gate checks the surviving player and then asserts
// the second one does not come back.
for (const file of ["src/YouTubePlayer.jsx"]) {
  const source = exists(file) ? read(file) : "";
  if (!source.includes("https://www.youtube-nocookie.com/embed/"))
    fail(`${file} does not use YouTube privacy-enhanced embeds`);
  else pass(`${file} uses YouTube privacy-enhanced embeds`);
}

for (const file of ["src/BrowsePage.jsx"]) {
  const source = exists(file) ? read(file) : "";
  if (source.includes("youtube.com/embed/") || source.includes("youtube-nocookie.com/embed/"))
    fail(`${file} embeds YouTube again — browse lectures must link to the watch page, not play in place`);
  else pass(`${file} has no second player`);
}

// Never publish a legal template as if it were a real policy. These values
// require an explicit owner decision and cannot be inferred from source code.
for (const file of ["src/LegalPage.jsx", "src/PrivacyPolicy.jsx"]) {
  if (!exists(file)) {
    fail(`${file} is missing`);
    continue;
  }
  const source = read(file);
  const placeholders = source.match(/\[(?:date|Lecture Library|hello@yourdomain\.com|Jaipur, India|your hosting provider)\]/g) ?? [];
  if (placeholders.length)
    fail(`${file} still contains legal placeholders: ${[...new Set(placeholders)].join(", ")}`);
  else pass(`${file} contains no known legal placeholders`);
}

const legalInputsFile = "docs/legal_release_inputs.md";
if (!exists(legalInputsFile)) {
  fail(`${legalInputsFile} is missing`);
} else {
  const source = read(legalInputsFile);
  const ownerFacts = [
    "Legal entity or individual operator name",
    "Contact email",
    "Postal address and jurisdiction",
    "Hosting provider",
    "Effective date",
  ];
  const missingFacts = ownerFacts.filter((fact) => !source.includes(fact));
  // Every owner-only fact must carry an EXPLICIT status on its own line: either
  // still "Awaiting owner input", or "Supplied:" with the approved value. This
  // stops a fact from being silently dropped, in either the pre-launch or the
  // finalised state.
  if (missingFacts.length) {
    fail(`${legalInputsFile} omits owner inputs: ${missingFacts.join(", ")}`);
  } else if (!ownerFacts.every((fact) => {
    const line = source.split(/\r?\n/).find((candidate) => candidate.includes(fact)) ?? "";
    return /Awaiting owner input/i.test(line) || /Supplied:/i.test(line);
  })) {
    fail(`${legalInputsFile} must mark every owner-only fact as "Awaiting owner input" or "Supplied:"`);
  } else {
    pass("owner-supplied legal facts each carry an explicit status");
  }
}

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} frontend release gate${failures.length === 1 ? "" : "s"} failed`);
  process.exit(1);
}

console.log("\nFrontend release gates passed");
