export const PUBLIC_BROWSER_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

export const PRIVATE_SERVER_ENV = [
  "YOUTUBE_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export function parseEnv(source = "") {
  const values = {};
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const split = line.indexOf("=");
    values[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return values;
}

export function resolveReleaseEnvironment(fileSource = "", runtime = {}) {
  const values = parseEnv(fileSource);
  for (const name of [...PUBLIC_BROWSER_ENV, ...PRIVATE_SERVER_ENV]) {
    if (runtime[name]) values[name] = runtime[name];
  }
  return values;
}
