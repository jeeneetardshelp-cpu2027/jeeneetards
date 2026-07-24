import fs from "node:fs";
import path from "node:path";

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

function parseEnv(source) {
  const values = {};
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const split = line.indexOf("=");
    values[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return values;
}

if (!exists(".env")) fail(".env is missing");
if (!exists("dist/index.html")) fail("dist/index.html is missing; run npm run build first");
if (!exists("vercel.json")) fail("vercel.json is missing");
if (!exists("netlify.toml")) fail("netlify.toml is missing");

const env = exists(".env") ? parseEnv(read(".env")) : {};
for (const name of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_YOUTUBE_API_KEY",
]) {
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

for (const name of ["YOUTUBE_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  const value = env[name];
  if (value && textFiles.includes(value)) fail(`${name} leaked into dist`);
  else pass(`${name} is absent from dist`);
}

if (exists("vercel.json")) {
  const config = JSON.parse(read("vercel.json"));
  const fallback = config.rewrites?.some(
    (rule) => rule.source === "/(.*)" && rule.destination === "/index.html",
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
}

if (exists("dist/index.html") && !read("dist/index.html").includes('name="description"'))
  fail("production HTML has no description metadata");
else if (exists("dist/index.html")) pass("production HTML includes release metadata");

for (const file of ["src/YouTubePlayer.jsx", "src/Dashboard.jsx"]) {
  const source = exists(file) ? read(file) : "";
  if (!source.includes("https://www.youtube-nocookie.com/embed/"))
    fail(`${file} does not use YouTube privacy-enhanced embeds`);
  else pass(`${file} uses YouTube privacy-enhanced embeds`);
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

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  console.error(`\n${failures.length} frontend release gate${failures.length === 1 ? "" : "s"} failed`);
  process.exit(1);
}

console.log("\nFrontend release gates passed");
