// streakSync.test.js — the study-day push/pull, isolated from the network via
// a mocked supabaseClient (same pattern as progressSync.test.js).
//
// Module state note: streakSync remembers "table missing" and "already
// pushed" for the life of the module, so each test imports a FRESH module
// (vi.resetModules + dynamic import) instead of leaking a silenced sync from
// one test into the next.

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: { user: { id: "student-1" } },
  upsert: vi.fn(),
  range: vi.fn(),
  rangeCalls: [],
  fromCalls: 0,
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: state.session } }),
    },
    from: () => {
      state.fromCalls += 1;
      return {
        upsert: (...args) => state.upsert(...args),
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        range(from, to) {
          state.rangeCalls.push([from, to]);
          return state.range(from, to);
        },
      };
    },
  },
}));

// The relation-missing answer PostgREST gives while the staged migration has
// not been applied.
const MISSING = {
  code: "PGRST205",
  message: "Could not find the table 'public.study_days' in the schema cache",
};

let sync;
beforeEach(async () => {
  state.session = { user: { id: "student-1" } };
  state.upsert = vi.fn(() => Promise.resolve({ error: null }));
  state.range = vi.fn(() => Promise.resolve({ data: [], error: null }));
  state.rangeCalls = [];
  state.fromCalls = 0;
  vi.resetModules();
  sync = await import("./streakSync.js");
});

describe("queueStudyDaySync", () => {
  it("upserts the (user, day) row when a session exists", async () => {
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).toHaveBeenCalledWith(
      { user_id: "student-1", day: "2026-08-31" },
      { onConflict: "user_id,day", ignoreDuplicates: true },
    );
  });

  it("does nothing when nobody is signed in", async () => {
    state.session = null;
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("refuses a malformed day instead of writing garbage", async () => {
    await sync.queueStudyDaySync("31-08-2026");
    await sync.queueStudyDaySync(null);
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("pushes each day only once after a SUCCESSFUL upsert", async () => {
    await sync.queueStudyDaySync("2026-08-31");
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).toHaveBeenCalledTimes(1);
    await sync.queueStudyDaySync("2026-09-01");
    expect(state.upsert).toHaveBeenCalledTimes(2);
  });

  it("retries a day whose push failed — a failure is not success", async () => {
    state.upsert
      .mockResolvedValueOnce({ error: { message: "network down" } })
      .mockResolvedValueOnce({ error: null });
    await sync.queueStudyDaySync("2026-08-31");
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).toHaveBeenCalledTimes(2);
    // Now recorded — a third call stays quiet.
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).toHaveBeenCalledTimes(2);
  });

  it("never throws into the caller, even with a broken client", async () => {
    state.upsert = vi.fn(() => { throw new Error("boom"); });
    await expect(sync.queueStudyDaySync("2026-08-31")).resolves.toBeUndefined();
  });
});

describe("missing-table degradation (migration not applied yet)", () => {
  it("goes quiet for the rest of the session after a push meets no table", async () => {
    state.upsert.mockResolvedValue({ error: MISSING });
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).toHaveBeenCalledTimes(1);

    // Every later push AND pull is a silent no-op — no more requests at all.
    const requestsSoFar = state.fromCalls;
    await sync.queueStudyDaySync("2026-09-01");
    expect(await sync.pullServerStudyDays("student-1")).toEqual([]);
    expect(state.fromCalls).toBe(requestsSoFar);
  });

  it("a pull that meets no table returns [] and silences later pushes", async () => {
    state.range.mockResolvedValue({ data: null, error: MISSING });
    expect(await sync.pullServerStudyDays("student-1")).toEqual([]);
    await sync.queueStudyDaySync("2026-08-31");
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("recognises the raw Postgres undefined_table code too", async () => {
    state.upsert.mockResolvedValue({
      error: { code: "42P01", message: 'relation "public.study_days" does not exist' },
    });
    await sync.queueStudyDaySync("2026-08-31");
    const requestsSoFar = state.fromCalls;
    await sync.queueStudyDaySync("2026-09-01");
    expect(state.fromCalls).toBe(requestsSoFar);
  });
});

describe("pullServerStudyDays", () => {
  it("maps rows to day strings and drops garbage rows", async () => {
    state.range.mockResolvedValueOnce({
      data: [{ day: "2026-08-30" }, { day: "2026-08-31" }, { day: "garbage" }, {}],
      error: null,
    });
    expect(await sync.pullServerStudyDays("student-1")).toEqual([
      "2026-08-30", "2026-08-31",
    ]);
  });

  it("does nothing without a signed-in user", async () => {
    expect(await sync.pullServerStudyDays(null)).toEqual([]);
    expect(state.range).not.toHaveBeenCalled();
  });

  it("keeps fetching past PostgREST's 1000-row cap instead of truncating", async () => {
    const day = (i) => ({
      day: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
    });
    const page1 = Array.from({ length: 1000 }, (_, i) => day(i));
    const page2 = Array.from({ length: 37 }, (_, i) => day(i));
    state.range
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    const days = await sync.pullServerStudyDays("student-1");
    expect(days).toHaveLength(1037);
    expect(state.rangeCalls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("keeps the pages it already has when a later page errors", async () => {
    const page1 = Array.from({ length: 1000 }, () => ({ day: "2026-08-30" }));
    state.range
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await sync.pullServerStudyDays("student-1")).toHaveLength(1000);
  });

  it("returns [] instead of throwing when the client is broken", async () => {
    state.range = vi.fn(() => { throw new Error("boom"); });
    expect(await sync.pullServerStudyDays("student-1")).toEqual([]);
  });
});
