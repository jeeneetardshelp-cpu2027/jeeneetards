// videoLiveness.js — the pure decision behind the liveness check.
//
// Split out of checkVideoLiveness.js so the rule that decides a lesson's fate
// is unit-tested, while the runner stays boring I/O. Given what the YouTube
// Data API said about one video, decide its new embedding_status and whether it
// is still alive.
//
// The three states that matter to a student:
//   embeddable  — plays inside the site's player. The happy path.
//   blocked     — exists and is public, but the creator disabled embedding, so
//                 the player cannot show it. The UI already turns this into a
//                 "YouTube only" link (src/MinimalUI.jsx), which is honest.
//   unavailable — the API did not return it at all: deleted, or made private.
//                 There is nothing to play or link to. Flagged for the operator
//                 to remove, because removing a lesson can empty a chapter and
//                 that is a content decision, not something a cron should do.

export const LIVE_STATUSES = Object.freeze(["embeddable", "blocked", "unavailable"]);

/**
 * @param {string|null} current   the video's stored embedding_status
 * @param {object|undefined} details  the getVideoDetails() entry for this video,
 *   or undefined when the API omitted it (deleted / private)
 * @returns {{ status: string, alive: boolean, changed: boolean }}
 */
export function classifyVideo(current, details) {
  // Not returned by videos.list -> the video no longer exists publicly.
  if (!details) {
    return { status: "unavailable", alive: false, changed: current !== "unavailable" };
  }

  // Returned, but the creator turned embedding off.
  if (details.embeddingStatus === "blocked") {
    return { status: "blocked", alive: true, changed: current !== "blocked" };
  }

  // Alive and embeddable. Recover a video that was previously flagged
  // blocked/unavailable and now embeds again; otherwise leave a good status
  // untouched so a healthy catalogue is not needlessly rewritten. "allowed" and
  // "embeddable" are both healthy today, so neither is churned.
  if (current === "blocked" || current === "unavailable") {
    return { status: "embeddable", alive: true, changed: true };
  }
  return { status: current ?? "embeddable", alive: true, changed: current == null };
}

/**
 * Group the changed rows by their target status, so the runner can issue one
 * bulk UPDATE per status instead of one per row. Ids only — the caller knows
 * the target status from the Map key. Unchanged rows are returned separately
 * because they need only a last_verified_at refresh.
 */
export function groupUpdates(updates) {
  const unchanged = [];
  const changedByStatus = new Map(); // status -> [id, ...]
  for (const u of updates) {
    if (!u.wasChanged) { unchanged.push(u.id); continue; }
    if (!changedByStatus.has(u.embedding_status)) changedByStatus.set(u.embedding_status, []);
    changedByStatus.get(u.embedding_status).push(u.id);
  }
  return { unchanged, changedByStatus };
}

/**
 * Emit a reviewable SQL script that applies only the STATUS changes (blocked /
 * unavailable / recovered) — the small, meaningful set an operator wants to see
 * before pasting it into the Supabase SQL editor. The bulk last_verified_at
 * refresh of thousands of healthy rows is deliberately left to the script's
 * direct-write path: it is low-stakes and would bloat this file with id lists.
 * Ids come from our own DB, so numeric interpolation is safe; nowIso is an ISO
 * timestamp. Returns null when nothing changed.
 */
export function buildLivenessSql(updates, nowIso) {
  const { changedByStatus } = groupUpdates(updates);
  if (changedByStatus.size === 0) return null;
  const ts = String(nowIso).replace(/'/g, "");
  const lines = [
    `-- Video liveness status changes generated ${ts}`,
    "-- Review before running. Applies ONLY status changes; the maintenance",
    "-- script also refreshes last_verified_at on every checked video.",
    "begin;",
  ];
  for (const [status, ids] of changedByStatus) {
    const safe = ids.filter((id) => Number.isInteger(id));
    if (!safe.length) continue;
    lines.push(
      `update public.videos set embedding_status='${status}', last_verified_at='${ts}'`,
      `  where id in (${safe.join(", ")});`,
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

/**
 * Roll a batch of classifications into the numbers the runner reports and the
 * rows it writes. `videos` is [{ id, youtube_video_id, embedding_status }];
 * `details` is the Map from getVideoDetails keyed by youtube_video_id.
 */
export function planLivenessUpdate(videos, details, nowIso) {
  const summary = { checked: 0, embeddable: 0, blocked: 0, unavailable: 0, changed: 0 };
  // Every status actually seen, including labels outside LIVE_STATUSES (the
  // catalogue still carries a legacy "allowed" that means the same as
  // "embeddable"). Without this the printed summary silently loses those rows
  // and the operator cannot reconcile it against "checked".
  const byStatus = new Map();
  const updates = []; // every checked video: refresh last_verified_at (+ status)
  const dead = []; // the unavailable ones, for the operator's report

  for (const v of videos) {
    const d = classifyVideo(v.embedding_status, details.get(v.youtube_video_id));
    summary.checked += 1;
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
    if (LIVE_STATUSES.includes(d.status)) summary[d.status] += 1;
    if (d.changed) summary.changed += 1;
    updates.push({
      id: v.id,
      youtube_video_id: v.youtube_video_id,
      embedding_status: d.status,
      last_verified_at: nowIso,
      wasChanged: d.changed,
      previous: v.embedding_status ?? null,
    });
    if (!d.alive) dead.push({ id: v.id, youtube_video_id: v.youtube_video_id });
  }
  return { summary, byStatus, updates, dead };
}
