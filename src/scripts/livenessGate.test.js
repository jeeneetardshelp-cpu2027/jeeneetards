// livenessGate: the rule that decides whether a scheduled liveness run goes red.
//
// The bug this file exists to prevent is a SILENT PASS. checkVideoLiveness.js
// exits 0 whatever it finds, so before this gate a run that discovered dead
// lessons was indistinguishable, from the outside, from one that found none.
// The most important assertions here are therefore the ones that say "this must
// NOT come back clean" — a regression that turns any of them green would put
// the original bug straight back.
import { describe, expect, it } from "vitest";
import { buildGateVerdict, renderGateSummary } from "./livenessGate.js";

const clean = { dry_run: false, dead: [], newly_blocked: [], recovered: [] };
const withDead = {
  dry_run: false,
  dead: [{ id: 42, youtube_video_id: "abc123", watch_url: "https://www.youtube.com/watch?v=abc123" }],
  newly_blocked: [],
  recovered: [],
};

describe("buildGateVerdict", () => {
  it("passes a clean report", () => {
    const v = buildGateVerdict(clean);
    expect(v.needsAttention).toBe(false);
    expect(v.unreadable).toBe(false);
  });

  it("fails when a lesson is gone from YouTube", () => {
    expect(buildGateVerdict(withDead).needsAttention).toBe(true);
  });

  it("fails when a lesson newly stopped allowing embedding", () => {
    // 'blocked' degrades to an honest "YouTube only" link rather than breaking,
    // but the catalogue has zero blocked videos today, so the first one is news.
    const v = buildGateVerdict({
      ...clean,
      newly_blocked: [{ id: 77, youtube_video_id: "xyz789", was: "embeddable" }],
    });
    expect(v.needsAttention).toBe(true);
  });

  it("does NOT fail when the only news is a recovery", () => {
    // A video that started embedding again is good news and needs no human.
    const v = buildGateVerdict({
      ...clean,
      recovered: [{ id: 9, youtube_video_id: "rec001", was: "blocked" }],
    });
    expect(v.needsAttention).toBe(false);
    expect(v.recovered).toHaveLength(1);
  });

  it("still fails on findings from a DRY run", () => {
    // A dry run detects exactly what a real run detects; only the write is
    // skipped. Letting dry runs pass would hide real rot behind a flag.
    const v = buildGateVerdict({ ...withDead, dry_run: true });
    expect(v.needsAttention).toBe(true);
    expect(v.dryRun).toBe(true);
  });

  // The fail-safe cases. "We could not tell" must never be reported as "clean".
  it.each([
    ["null (file missing or unparseable)", null],
    ["undefined", undefined],
    ["a JSON array rather than an object", []],
    ["a bare string", "not json at all"],
    ["an object with no dead array", { dry_run: false, summary: {} }],
    ["an object with no newly_blocked array", { dry_run: false, dead: [] }],
    ["dead present but not an array", { dead: "none", newly_blocked: [] }],
  ])("treats %s as unreadable and fails", (_label, report) => {
    const v = buildGateVerdict(report);
    expect(v.unreadable).toBe(true);
    expect(v.needsAttention).toBe(true);
    expect(v.reason).toBeTruthy();
  });
});

describe("renderGateSummary", () => {
  it("never claims the catalogue is clean when the report was unreadable", () => {
    const text = renderGateSummary(buildGateVerdict(null));
    expect(text).toContain("Could not read the liveness report");
    expect(text).not.toContain("Nothing to do");
  });

  it("lists each dead lesson with a link the owner can open", () => {
    const text = renderGateSummary(buildGateVerdict(withDead));
    expect(text).toContain("https://www.youtube.com/watch?v=abc123");
    expect(text).toContain("video 42");
  });

  it("builds a watch URL when the report did not carry one", () => {
    const v = buildGateVerdict({
      ...clean,
      dead: [{ id: 43, youtube_video_id: "a2" }],
    });
    expect(renderGateSummary(v)).toContain("https://www.youtube.com/watch?v=a2");
  });

  it("agrees in number for one finding and for several", () => {
    expect(renderGateSummary(buildGateVerdict(withDead))).toContain("1 lesson is gone");
    const two = buildGateVerdict({
      ...clean,
      dead: [{ id: 1, youtube_video_id: "a" }, { id: 2, youtube_video_id: "b" }],
    });
    expect(renderGateSummary(two)).toContain("2 lessons are gone");
  });

  it("says a dry run did not write, so a red run is not mistaken for a change", () => {
    const text = renderGateSummary(buildGateVerdict({ ...withDead, dry_run: true }));
    expect(text).toContain("Dry run");
  });
});
