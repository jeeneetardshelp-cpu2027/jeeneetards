// dbProbe.js — the only sanctioned way for an evidence script to read data.
//
// WHY THIS EXISTS
//
// A probe in this project printed "playlist_class_levels 42703" for a table
// holding 7 rows. The query was `.select("id")` on a table with no `id`
// column. The guard — `r.error ? r.error.code : r.count` — actually FIRED:
// 42703 is the Postgres error code for undefined_column. It was printed into a
// column of row counts, where an error code is indistinguishable from data.
//
// So the lesson is not "check the error". It is that a checked error must not
// be RENDERED as a result. Failures have to look like failures.
//
// The rule that follows: NO SCRIPT MAY READ `data` OR `count` WITHOUT THE
// ERROR HAVING BEEN CHECKED FIRST. `must()` enforces it by construction — the
// only way to get at the payload is through a function that throws first.
//
// A probe that cannot fail cannot produce evidence.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export class ProbeError extends Error {
  constructor(label, error) {
    super(`${label}: ${error?.message ?? "unknown error"}${error?.code ? ` [${error.code}]` : ""}`);
    this.name = "ProbeError";
    this.cause = error;
  }
}

/**
 * Unwrap a PostgREST response, throwing on ANY error.
 *
 * Also rejects a structurally impossible response (no error, but no data and
 * no count) — that shape has meant "the request did not do what you think"
 * every time it has appeared here.
 */
export function must(label, res) {
  if (!res || typeof res !== "object") throw new ProbeError(label, { message: "no response" });
  if (res.error) throw new ProbeError(label, res.error);
  if (res.data === undefined && res.count === undefined && res.status !== 204)
    throw new ProbeError(label, { message: "response carried neither data nor count" });
  return res;
}

/** `must` for rows: returns the array, never undefined. */
export function rows(label, res) {
  const r = must(label, res);
  if (!Array.isArray(r.data)) throw new ProbeError(label, { message: "expected rows, got none" });
  return r.data;
}

/** `must` for counts: returns a number, never a stale or absent one. */
export function count(label, res) {
  const r = must(label, res);
  if (typeof r.count !== "number")
    throw new ProbeError(label, { message: "expected an exact count; did the query ask for one?" });
  return r.count;
}

export function readEnv(file = ".env") {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8").split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
  } catch { return {}; }
}

/** Read-only client. Scripts here never write. */
export function client({ service = false, env = readEnv() } = {}) {
  const url = env.VITE_SUPABASE_URL;
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ProbeError("client", { message: "missing URL or key in .env" });
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Fetch every row, page by page, so a 1000-row default limit cannot truncate
 *  a comparison into a false "no mismatches". */
export async function all(label, build, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const data = rows(`${label} (from ${from})`, await build().range(from, from + pageSize - 1));
    out.push(...data);
    if (data.length < pageSize) return out;
  }
}

/**
 * Fetch an exact, complete, deterministically ordered row set.
 *
 * Unlike `all`, this does not assume the server honoured the requested page
 * size. PostgREST may enforce a lower response cap, so the next range starts
 * after the number of rows actually received. The first response must include
 * an exact count and every row must have a stable unique key; otherwise the
 * probe fails instead of presenting partial evidence as complete.
 *
 * `build` receives `"exact"` for the first page and `null` afterwards so the
 * caller can add `{ count: "exact" }` to its first `.select(...)`.
 */
export async function allExact(
  label,
  build,
  { pageSize = 1000, key = (row) => row?.id } = {},
) {
  if (!Number.isInteger(pageSize) || pageSize <= 0)
    throw new ProbeError(label, { message: "pageSize must be a positive integer" });
  if (typeof build !== "function")
    throw new ProbeError(label, { message: "build must be a query factory" });
  if (typeof key !== "function")
    throw new ProbeError(label, { message: "key must be a function" });

  const out = [];
  const seen = new Set();
  let expected = null;
  let from = 0;

  while (expected === null || from < expected) {
    const response = must(
      `${label} (from ${from})`,
      await build(expected === null ? "exact" : null).range(from, from + pageSize - 1),
    );
    if (expected === null) {
      if (typeof response.count !== "number")
        throw new ProbeError(label, { message: "first page did not include an exact count" });
      expected = response.count;
    }

    if (!Array.isArray(response.data))
      throw new ProbeError(label, { message: "expected rows, got none" });
    if (response.data.length === 0) {
      if (expected === 0 && from === 0) return [];
      throw new ProbeError(label, {
        message: `received an empty page after ${from} of ${expected} rows`,
      });
    }

    for (const row of response.data) {
      const value = key(row);
      if (value === undefined || value === null || value === "")
        throw new ProbeError(label, { message: `row at offset ${out.length} has no stable key` });
      if (seen.has(value))
        throw new ProbeError(label, { message: `duplicate row key ${String(value)}` });
      seen.add(value);
      out.push(row);
    }

    from += response.data.length;
    if (from > expected)
      throw new ProbeError(label, {
        message: `received ${from} rows, exceeding exact count ${expected}`,
      });
  }

  if (out.length !== expected)
    throw new ProbeError(label, {
      message: `received ${out.length} rows, expected ${expected}`,
    });
  return out;
}
