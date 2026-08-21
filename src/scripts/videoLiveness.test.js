// videoLiveness: the rule that decides whether a lesson still plays.
//
// A student who taps a dead or embedding-disabled lesson is the core-promise
// failure the audit flagged, and 99% of the catalogue had never been
// re-verified. These tests pin the classifier so the maintenance run marks the
// right videos and — just as important — does NOT churn a healthy catalogue of
// thousands of rows on every pass.
import { describe, expect, it } from "vitest";
import {
  classifyVideo, planLivenessUpdate, groupUpdates, buildLivenessSql, LIVE_STATUSES,
} from "./videoLiveness.js";

const embeddable = { embeddingStatus: "embeddable" };
const notEmbeddable = { embeddingStatus: "blocked" };

describe("classifyVideo", () => {
  it("marks a video the API omitted as unavailable and not alive", () => {
    // getVideoDetails leaves deleted / private videos out of its Map entirely.
    expect(classifyVideo("embeddable", undefined)).toEqual({
      status: "unavailable", alive: false, changed: true,
    });
  });

  it("marks an embedding-disabled video blocked so the UI shows 'YouTube only'", () => {
    expect(classifyVideo("embeddable", notEmbeddable)).toEqual({
      status: "blocked", alive: true, changed: true,
    });
  });

  it("leaves a healthy video's status untouched — no needless write", () => {
    // The common case for ~5,000 rows. changed:false keeps the write to only
    // last_verified_at, not a status the row already has.
    expect(classifyVideo("embeddable", embeddable)).toEqual({
      status: "embeddable", alive: true, changed: false,
    });
  });

  it("treats the legacy 'allowed' status as healthy and does not rewrite it", () => {
    // 1,812 production rows carry 'allowed'; the UI treats it as embeddable.
    // Rewriting them to 'embeddable' would be pure churn.
    expect(classifyVideo("allowed", embeddable)).toEqual({
      status: "allowed", alive: true, changed: false,
    });
  });

  it("recovers a previously blocked video that now embeds again", () => {
    expect(classifyVideo("blocked", embeddable)).toEqual({
      status: "embeddable", alive: true, changed: true,
    });
  });

  it("recovers a previously unavailable video that came back", () => {
    expect(classifyVideo("unavailable", embeddable)).toEqual({
      status: "embeddable", alive: true, changed: true,
    });
  });

  it("keeps an already-blocked video blocked without flagging a change", () => {
    expect(classifyVideo("blocked", notEmbeddable)).toEqual({
      status: "blocked", alive: true, changed: false,
    });
  });

  it("keeps an already-unavailable video unavailable without flagging a change", () => {
    expect(classifyVideo("unavailable", undefined)).toEqual({
      status: "unavailable", alive: false, changed: false,
    });
  });

  it("fills a null status on a healthy video and counts it as a change", () => {
    expect(classifyVideo(null, embeddable)).toEqual({
      status: "embeddable", alive: true, changed: true,
    });
  });

  it("only ever emits the three known statuses", () => {
    const cases = [
      classifyVideo("embeddable", embeddable),
      classifyVideo("allowed", embeddable),
      classifyVideo("weird", embeddable), // an unknown healthy status is preserved
      classifyVideo("embeddable", notEmbeddable),
      classifyVideo("embeddable", undefined),
    ];
    for (const c of cases) {
      // Preserved-as-is healthy values aside, any status we *assign* is one of the three.
      if (c.changed) expect(LIVE_STATUSES).toContain(c.status);
    }
  });
});

describe("planLivenessUpdate", () => {
  const videos = [
    { id: 1, youtube_video_id: "aaa", embedding_status: "embeddable" }, // stays healthy
    { id: 2, youtube_video_id: "bbb", embedding_status: "embeddable" }, // becomes blocked
    { id: 3, youtube_video_id: "ccc", embedding_status: "embeddable" }, // dies
    { id: 4, youtube_video_id: "ddd", embedding_status: "blocked" }, // recovers
  ];
  const details = new Map([
    ["aaa", embeddable],
    ["bbb", notEmbeddable],
    // "ccc" absent -> dead
    ["ddd", embeddable],
  ]);

  it("counts each outcome and refreshes last_verified_at on every checked video", () => {
    const now = "2026-08-21T00:00:00.000Z";
    const { summary, updates, dead } = planLivenessUpdate(videos, details, now);

    expect(summary).toEqual({
      checked: 4, embeddable: 2, blocked: 1, unavailable: 1, changed: 3,
    });
    // Every video — even the dead one — is stamped as checked now.
    expect(updates).toHaveLength(4);
    expect(updates.every((u) => u.last_verified_at === now)).toBe(true);
    // The healthy, unchanged row still gets a verify stamp but no status change.
    expect(updates.find((u) => u.id === 1)).toMatchObject({
      embedding_status: "embeddable", wasChanged: false,
    });
    // The dead one is reported for manual review, with its previous status kept.
    expect(dead).toEqual([{ id: 3, youtube_video_id: "ccc" }]);
    expect(updates.find((u) => u.id === 3)).toMatchObject({
      embedding_status: "unavailable", previous: "embeddable", wasChanged: true,
    });
  });

  it("handles an empty batch without inventing work", () => {
    const { summary, updates, dead } = planLivenessUpdate([], new Map(), "t");
    expect(summary.checked).toBe(0);
    expect(updates).toHaveLength(0);
    expect(dead).toHaveLength(0);
  });
});

describe("groupUpdates", () => {
  const updates = [
    { id: 1, embedding_status: "embeddable", wasChanged: false },
    { id: 2, embedding_status: "blocked", wasChanged: true },
    { id: 3, embedding_status: "unavailable", wasChanged: true },
    { id: 4, embedding_status: "blocked", wasChanged: true },
    { id: 5, embedding_status: "allowed", wasChanged: false },
  ];

  it("separates unchanged rows from changed rows grouped by target status", () => {
    const { unchanged, changedByStatus } = groupUpdates(updates);
    expect(unchanged).toEqual([1, 5]);
    expect(changedByStatus.get("blocked")).toEqual([2, 4]);
    expect(changedByStatus.get("unavailable")).toEqual([3]);
    expect(changedByStatus.has("embeddable")).toBe(false);
  });
});

describe("buildLivenessSql", () => {
  const now = "2026-08-21T10:00:00.000Z";

  it("returns null when nothing changed — no empty migration", () => {
    const updates = [{ id: 1, embedding_status: "embeddable", wasChanged: false }];
    expect(buildLivenessSql(updates, now)).toBeNull();
  });

  it("emits one bounded UPDATE per status, wrapped in a transaction", () => {
    const updates = [
      { id: 10, embedding_status: "blocked", wasChanged: true },
      { id: 11, embedding_status: "blocked", wasChanged: true },
      { id: 12, embedding_status: "unavailable", wasChanged: true },
      { id: 13, embedding_status: "embeddable", wasChanged: false }, // excluded
    ];
    const sql = buildLivenessSql(updates, now);
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("set embedding_status='blocked'");
    expect(sql).toContain("where id in (10, 11);");
    expect(sql).toContain("set embedding_status='unavailable'");
    expect(sql).toContain("where id in (12);");
    // The unchanged row's id never appears in a WHERE clause.
    expect(sql).not.toMatch(/in \([^)]*\b13\b/);
    expect(sql).toContain(now.replace(/'/g, ""));
  });

  it("drops any non-integer id rather than interpolating it into SQL", () => {
    const updates = [
      { id: "7); drop table videos;--", embedding_status: "unavailable", wasChanged: true },
      { id: 8, embedding_status: "unavailable", wasChanged: true },
    ];
    const sql = buildLivenessSql(updates, now);
    expect(sql).toContain("where id in (8);");
    expect(sql).not.toContain("drop table");
  });
});
