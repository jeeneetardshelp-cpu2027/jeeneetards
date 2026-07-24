import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const calls = [];

function builder(table) {
  const rec = { table, select: null, eq: {}, terms: [], limit: null };
  const chain = {
    select(value) { rec.select = value; return chain; },
    eq(key, value) { rec.eq[key] = value; return chain; },
    ilike(key, value) { rec.terms.push([key, value]); return chain; },
    limit(value) { rec.limit = value; return chain; },
    then(resolve) {
      const data = table === "chapters"
        ? [{ id: 7, name: "Kinematics", slug: "kinematics", subject_id: 2,
             subjects: { name: "Physics", slug: "physics" } }]
        : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  calls.push(rec);
  return chain;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table) },
}));

import { useScopedSearch } from "./useScopedSearch.js";

let result;
function Probe(props) {
  result = useScopedSearch("motion", props);
  return null;
}

beforeEach(() => { calls.length = 0; result = undefined; });

describe("goal-scoped search integrity", () => {
  it("does not query globally-scoped chapters before a subject is known", async () => {
    render(<Probe goalId={1} subjectId={null} chapterId={null} />);
    await waitFor(() => expect(result.loading).toBe(false));
    expect(calls.filter((call) => call.table === "chapters")).toHaveLength(0);
    expect(calls.find((call) => call.table === "videos")?.eq)
      .toEqual({ "video_learning_goals.learning_goal_id": 1 });
  });

  it("scopes chapters by subject and preserves their canonical slugs", async () => {
    render(<Probe goalId={1} subjectId={2} chapterId={null} />);
    await waitFor(() => expect(result.loading).toBe(false));
    const chapterCall = calls.find((call) => call.table === "chapters");
    expect(chapterCall.eq).toEqual({ subject_id: 2 });
    expect(result.results.chapters).toEqual([{
      id: 7,
      name: "Kinematics",
      slug: "kinematics",
      subject: "Physics",
      subjectSlug: "physics",
    }]);
  });
});
