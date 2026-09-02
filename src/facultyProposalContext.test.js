// The one fact that tells a reviewer whether a proposal is a person.
//
// scan_free_text_teachers classifies by spelling. "Magnet Brains" trips no
// organisation keyword, so it reaches the queue labelled `single` — offered as
// a person to approve, which would put an institute in the faculty directory.
// Measured against production 2026-09-02, four names are in that position:
// Magnet Brains (10 courses), NEEV Competishun (4), Hindi Adhyapak (2),
// Sunlike Study (1).
//
// The separating signal is not in the name. It is whether the name is the
// channel the courses sit on — and four OTHER `single` names are real people
// whose channel carries their own name (Mohit Tyagi 32, Digraj Singh Rajput 5,
// Shobhit Nirwan 1, Vinay Uppal 1). A rule that flagged those would be worse
// than no rule, so most of what follows is about not over-flagging.
import { describe, expect, it } from "vitest";
import { indexTeacherChannels, proposalContext, withProposalContext } from "./facultyProposalContext.js";

const row = (teacher, channel) => ({ teacher, institutes_channels: channel ? { name: channel } : null });
const group = (...raws) => ({
  normalized: raws[0],
  kind: "single",
  variants: raws.map((r) => ({ raw_teacher: r, occurrences: 1 })),
});

describe("a name that is only the channel's own name", () => {
  it("is flagged when every course carrying it sits on that channel", () => {
    const rows = Array.from({ length: 10 }, () => row("Magnet Brains", "Magnet Brains"));
    const ctx = proposalContext(group("Magnet Brains"), indexTeacherChannels(rows));

    expect(ctx.isChannelName).toBe(true);
    expect(ctx.total).toBe(10);
    expect(ctx.channels).toEqual([{ name: "Magnet Brains", count: 10 }]);
  });

  it.each([
    ["NEEV Competishun", 4],
    ["Hindi Adhyapak", 2],
    ["Sunlike Study", 1],
  ])("catches %s, which the keyword classifier calls `single`", (name, n) => {
    const rows = Array.from({ length: n }, () => row(name, name));
    expect(proposalContext(group(name), indexTeacherChannels(rows)).isChannelName).toBe(true);
  });
});

describe("a real person is not flagged", () => {
  it("leaves a teacher who teaches on somebody else's channel alone", () => {
    const rows = Array.from({ length: 14 }, () => row("Dr. Sachin Kapur", "Unacademy NEET"));
    const ctx = proposalContext(group("Dr. Sachin Kapur"), indexTeacherChannels(rows));

    expect(ctx.isChannelName).toBe(false);
    expect(ctx.channels).toEqual([{ name: "Unacademy NEET", count: 14 }]);
  });

  it("does not flag a person because ONE of their courses is self-named", () => {
    // The rule that matters. A teacher with their own channel alongside work
    // on others is a person; flagging them would tell the reviewer to reject
    // somebody real. Only ALL counts.
    const rows = [
      row("Mohit Tyagi", "Mohit Tyagi"),
      ...Array.from({ length: 5 }, () => row("Mohit Tyagi", "Competishun+")),
    ];
    const ctx = proposalContext(group("Mohit Tyagi"), indexTeacherChannels(rows));

    expect(ctx.isChannelName).toBe(false);
    expect(ctx.channelNamed).toBe(1);
    expect(ctx.total).toBe(6);
  });

  it("says nothing at all when the catalogue read did not land", () => {
    // No context is honest. A false "not a channel" would be a claim.
    const ctx = proposalContext(group("Anybody"), indexTeacherChannels([]));
    expect(ctx.isChannelName).toBe(false);
    expect(ctx.channels).toEqual([]);
    expect(ctx.total).toBe(0);
  });
});

describe("the channels a reviewer is shown", () => {
  it("lists them commonest first, so the useful one leads", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => row("Anu Gupta", "Unacademy NEET")),
      row("Anu Gupta", "Allen"),
      ...Array.from({ length: 7 }, () => row("Anu Gupta", "Physics Wallah")),
    ];
    const ctx = proposalContext(group("Anu Gupta"), indexTeacherChannels(rows));

    expect(ctx.channels.map((c) => c.name)).toEqual(["Physics Wallah", "Unacademy NEET", "Allen"]);
  });

  it("merges every spelling variant the RPC grouped together", () => {
    // The queue groups by normalize_person_name, so one group can hold
    // "Dr. Sachin Kapur" and "Sachin Kapur". Context has to cover all of them.
    const rows = [
      ...Array.from({ length: 2 }, () => row("Dr. Sachin Kapur", "Unacademy NEET")),
      row("Sachin Kapur", "Unacademy NEET"),
    ];
    const ctx = proposalContext(group("Dr. Sachin Kapur", "Sachin Kapur"), indexTeacherChannels(rows));

    expect(ctx.total).toBe(3);
    expect(ctx.channels).toEqual([{ name: "Unacademy NEET", count: 3 }]);
  });

  it("matches on the RAW name, never on a normalisation of its own", () => {
    // normalize_person_name is a Postgres function this cannot reproduce.
    // Attaching context by a guessed normalisation would put one teacher's
    // channels on another's proposal.
    // These two differ ONLY by case, so they match under a lower-casing rule
    // and not under exact matching — the case that actually distinguishes the
    // two implementations. The previous version of this test used names that
    // differed under both, and so proved nothing.
    const rows = [row("ANU GUPTA", "Allen")];
    const ctx = proposalContext(group("Anu Gupta"), indexTeacherChannels(rows));
    expect(ctx.total).toBe(0);
    expect(ctx.channels).toEqual([]);
  });
});

describe("withProposalContext", () => {
  it("annotates every group and changes nothing else about them", () => {
    const groups = [
      { normalized: "magnet brains", kind: "single", total_occurrences: 10, variants: [{ raw_teacher: "Magnet Brains", occurrences: 10 }] },
      { normalized: "anu gupta", kind: "single", total_occurrences: 1, variants: [{ raw_teacher: "Anu Gupta", occurrences: 1 }] },
    ];
    const rows = [row("Magnet Brains", "Magnet Brains"), row("Anu Gupta", "Unacademy NEET")];
    const out = withProposalContext(groups, rows);

    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe("single");
    expect(out[0].total_occurrences).toBe(10);
    expect(out[0].context.isChannelName).toBe(true);
    expect(out[1].context.isChannelName).toBe(false);
  });

  it("survives an empty queue and an empty catalogue", () => {
    expect(withProposalContext([], [])).toEqual([]);
    expect(withProposalContext(undefined, undefined)).toEqual([]);
  });
});
