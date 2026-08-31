// READ-ONLY production check for polls_v1, using ONLY the public anon key —
// the same key the shipped app holds. No service-role key, no writes, no admin
// RPC. Everything below is something any visitor's browser could do.
//
// This is deliberately narrower than the staging verifier: it proves the two
// things that actually matter after a production install —
//   1. the module is present and CLOSED (poll_mode = off), and
//   2. a browser cannot read a single poll table directly.
// Row counts and seed contents need the service key and are not worth
// escalating to on production; staging already proved them.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const parseEnv = (t = "") => Object.fromEntries(
  String(t).split(/\r?\n/).flatMap((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    return m ? [[m[1], m[2].replace(/^["']|["']$/g, "").trim()]] : [];
  }),
);
const env = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Refusing: production URL and anon key required.");

const ref = new URL(url).hostname.split(".")[0];
console.log(`production project ref: ${ref}`);

const browser = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// 1. Installed, and installed CLOSED.
const mode = await browser.rpc("poll_mode");
record("poll_mode() exists and is 'off'", !mode.error && mode.data === "off",
  mode.error ? String(mode.error.message).slice(0, 70) : `"${mode.data}"`);

// 2. The public read RPCs exist and are callable by anon.
for (const [name, args] of [
  ["get_poll_topics", undefined],
  ["get_polls_feed", { p_sort: "new", p_topic_slug: null, p_limit: 5, p_offset: 0 }],
]) {
  const r = await browser.rpc(name, args);
  const rows = Array.isArray(r.data) ? r.data.length : 0;
  record(`anon can call ${name}()`, !r.error,
    r.error ? String(r.error.message).slice(0, 70) : `${rows} rows`);
}

// 3. Nothing is public while closed.
const feed = await browser.rpc("get_polls_feed", { p_sort: "new", p_topic_slug: null, p_limit: 5, p_offset: 0 });
record("no polls are public while the mode is off",
  !feed.error && (feed.data ?? []).length === 0, `${(feed.data ?? []).length} public polls`);

// 4. THE SECURITY BOUNDARY — a browser must not read any poll table directly.
for (const table of ["poll_settings", "poll_image_hosts", "polls", "poll_options",
  "poll_votes", "poll_comments", "poll_reports", "poll_rate_events"]) {
  const { error, count } = await browser.from(table).select("*", { head: true, count: "exact" }).limit(1);
  const denied = Boolean(error) || count === null;
  record(`anon cannot read ${table}`, denied, denied ? "denied" : `READABLE (${count}) — grant leaked`);
}

// 5. Admin surface returns nothing to a browser.
const pending = await browser.rpc("poll_admin_list_pending", { p_limit: 1 });
record("anon gets nothing from poll_admin_list_pending()",
  Boolean(pending.error) || (pending.data ?? []).length === 0,
  pending.error ? "refused" : `${(pending.data ?? []).length} rows`);

const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0
  ? "\nPRODUCTION VERIFIED — polls_v1 present, closed, and invisible to browsers."
  : `\nNOT VERIFIED — ${failed.length} check(s) failed.`);
if (failed.length) process.exitCode = 1;
