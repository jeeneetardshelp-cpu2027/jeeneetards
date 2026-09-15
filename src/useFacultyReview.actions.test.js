// What a faculty review action hands the panel when the database says no.
//
// The panel has to tell one refusal apart from every other failure: "existing
// faculty already answer to this name" (Postgres check_violation 23514, hint
// duplicate_faculty), which it answers by asking whether this is a different
// person. It decides by code and hint, never by wording, so both have to
// survive the trip from supabase-js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ result: { data: null, error: null }, calls: [] }));

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: async (fn, args) => {
      rpc.calls.push([fn, args]);
      return rpc.result;
    },
  },
}));

import { runFacultyReviewAction } from "./useFacultyReview.js";

beforeEach(() => {
  rpc.calls = [];
  rpc.result = { data: null, error: null };
});

describe("runFacultyReviewAction", () => {
  it("passes the arguments through and returns the data", async () => {
    rpc.result = { data: { teacher_id: 7 }, error: null };

    await expect(runFacultyReviewAction("approve_faculty_review_group_as_new", { p_normalized: "abj" }))
      .resolves.toEqual({ teacher_id: 7 });
    expect(rpc.calls).toEqual([["approve_faculty_review_group_as_new", { p_normalized: "abj" }]]);
  });

  it("keeps Postgres's code, hint and details on the error it throws", async () => {
    rpc.result = {
      data: null,
      error: {
        message: 'Existing faculty already match "ABJ Sir": Amit Bijarnia (#1).',
        code: "23514",
        hint: "duplicate_faculty",
        details: '[{"teacher_id": 1, "slug": "amit-bijarnia"}]',
      },
    };

    await expect(runFacultyReviewAction("approve_faculty_review_group_as_new", {})).rejects.toMatchObject({
      message: 'Existing faculty already match "ABJ Sir": Amit Bijarnia (#1).',
      code: "23514",
      hint: "duplicate_faculty",
      details: '[{"teacher_id": 1, "slug": "amit-bijarnia"}]',
    });
  });

  it("still says something when the database gives no message", async () => {
    rpc.result = { data: null, error: { code: "PGRST000" } };

    await expect(runFacultyReviewAction("reject_faculty_review_group", {}))
      .rejects.toMatchObject({ message: "Faculty review failed.", code: "PGRST000" });
  });
});
