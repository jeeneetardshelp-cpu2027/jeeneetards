// examLane: the remembered JEE/NEET/Boards choice. Storage can be absent,
// blocked or full of garbage, and none of that may break the homepage — the
// honest fallback is always "no preference", which is the old behaviour.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExamLane, setExamLane, orderExamsByLane } from "./examLane.js";

const KEY = "ll_exam_lane_v1";

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("getExamLane / setExamLane", () => {
  it("returns null when nothing has been chosen yet", () => {
    expect(getExamLane()).toBeNull();
  });

  it("round-trips a valid lane", () => {
    setExamLane("neet");
    expect(localStorage.getItem(KEY)).toBe("neet");
    expect(getExamLane()).toBe("neet");
  });

  it("ignores values that are not a known lane, on read and on write", () => {
    setExamLane("olympiad");
    setExamLane("");
    setExamLane(null);
    expect(localStorage.getItem(KEY)).toBeNull();

    localStorage.setItem(KEY, '{"weird":"json"}');
    expect(getExamLane()).toBeNull();
  });

  it("survives a throwing storage instead of breaking the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getExamLane()).toBeNull();
    expect(() => setExamLane("jee")).not.toThrow();
  });
});

describe("orderExamsByLane", () => {
  const exams = [
    { id: "jee" }, { id: "neet" }, { id: "school" }, { id: "olympiad" },
  ];

  it("puts the student's lane first and keeps every other card in order", () => {
    expect(orderExamsByLane(exams, "school").map((e) => e.id))
      .toEqual(["school", "jee", "neet", "olympiad"]);
  });

  it("changes nothing without a lane, or with a lane the grid does not show", () => {
    expect(orderExamsByLane(exams, null)).toEqual(exams);
    expect(orderExamsByLane(exams, "upsc")).toEqual(exams);
    expect(orderExamsByLane(null, "jee")).toEqual([]);
  });

  it("reads the stored lane by default", () => {
    setExamLane("neet");
    expect(orderExamsByLane(exams).map((e) => e.id))
      .toEqual(["neet", "jee", "school", "olympiad"]);
  });
});
