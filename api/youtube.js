// api/youtube.js — server-side proxy for the admin panel's YouTube Data API calls.
//
// WHY THIS EXISTS. The admin panel used to call googleapis.com directly from the
// browser with import.meta.env.VITE_YOUTUBE_API_KEY. Vite inlines any VITE_*
// value into the public bundle, so the key was downloadable by anyone:
//
//   curl https://www.jeeneetard.com/assets/AdminPanel-<hash>.js   -> 200, 86 KB
//
// and it was usable, because an HTTP-referrer restriction is a request header the
// caller controls. Measured against the live key: no Referer -> 403, but
// "Referer: http://localhost:5173/" -> 200 with real data. Anyone could drain the
// project's daily quota. A referrer-restricted browser key is a PUBLIC key.
//
// The key now lives only in YOUTUBE_API_KEY (no VITE_ prefix, so Vite cannot
// inline it) and is read at request time on the server. The browser sends its
// Supabase session instead.
//
// THIS IS NOT AN OPEN PROXY. An unauthenticated proxy would be worse than the
// bundled key -- a caller would not even need to spoof a header to spend the
// quota. Every request must carry a Supabase access token belonging to an admin,
// checked against the same public.is_admin() SECURITY DEFINER function the admin
// UI already gates on (AdminPanel.jsx:870).
//
// The allow-lists below are deliberate: only the three resources and the exact
// `part` combinations the import flow needs. A proxy that forwards arbitrary
// paths and parameters is a general-purpose Google API key with extra steps.

const YT = "https://www.googleapis.com/youtube/v3";

// resource -> the only `part` values the admin import flow asks for.
const ALLOWED = new Map([
  ["playlists", new Set(["snippet"])],
  ["playlistItems", new Set(["snippet,contentDetails"])],
  ["videos", new Set(["contentDetails,status"])],
]);

// Everything else in the query string is dropped rather than forwarded.
const ALLOWED_PARAMS = new Set([
  "part", "id", "playlistId", "maxResults", "pageToken",
]);

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(body));
}

async function callerIsAdmin(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, reason: "server is missing its Supabase configuration" };
  let r;
  try {
    r = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch {
    return { ok: false, reason: "could not reach the auth service" };
  }
  if (!r.ok) return { ok: false, reason: "sign in again" };
  let json;
  try { json = await r.json(); } catch { return { ok: false, reason: "sign in again" }; }
  return json === true ? { ok: true } : { ok: false, reason: "admin only" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST." });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    // Deliberately explicit: this is the failure a deploy without the env var
    // produces, and the old code failed the same way but only in the browser.
    return send(res, 503, { error: "YOUTUBE_API_KEY is not set on the server." });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return send(res, 401, { error: "Sign in as an admin to use this." });

  const gate = await callerIsAdmin(token);
  if (!gate.ok) return send(res, 403, { error: gate.reason });

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const resource = body?.resource;
  const params = body?.params ?? {};
  const parts = ALLOWED.get(resource);
  if (!parts) return send(res, 400, { error: "Unsupported resource." });
  if (!parts.has(params.part)) return send(res, 400, { error: "Unsupported part." });

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(k)) continue;
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  qs.set("key", key);

  let upstream;
  try {
    upstream = await fetch(`${YT}/${resource}?${qs}`);
  } catch {
    return send(res, 502, { error: "Could not reach the YouTube API." });
  }

  let json;
  try { json = await upstream.json(); } catch { json = null; }

  if (!upstream.ok) {
    // Map the two failures the admin actually hits, and never pass Google's raw
    // error through -- it can echo the key back in some responses.
    const reason = json?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") return send(res, 429, { error: "YouTube API quota exceeded for today." });
    if (reason === "playlistNotFound") return send(res, 404, { error: "That playlist doesn't exist, or it's private." });
    return send(res, upstream.status, { error: `YouTube API error ${upstream.status}.` });
  }

  return send(res, 200, json ?? {});
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}
