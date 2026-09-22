// The "Taught by" filter — a failed facet lookup has a way out.
//
// "Couldn't load faculty filters." used to be a dead end. useFacultyFacets has
// always returned a retry, but FacultyFilter never offered it, so on every
// /browse URL that renders the filter (a slug scope, the lectures tab, ?ch=7) a
// deadline abort left that line on screen after the network came back, with
// nothing on the page able to ask again. On a shared ?teacher= link it was
// worse: BrowsePage holds the results back while the filter reports "error".
//
// FacultyFilter.test.jsx stubs the hook, which is right for what it pins. These
// run the REAL useFacultyFacets over a scripted rpc, so the button is proved to
// re-issue the lookup, not merely to call a function. A failure is answered with
// the shape postgrest RESOLVES to after a deadline abort — recorded through the
// real supabase-js and createDeadlineFetch, less the stack trace it appends to
// `details` — and an rpc call nobody scripted an answer for stays pending.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => {
  const calls = [];
  const replies = new Map();
  const rpc = (name, args) => {
    calls.push({ name, args });
    const reply = replies.get(name)?.shift();
    const settled = reply === undefined ? new Promise(() => {}) : Promise.resolve(reply);
    return { then: (resolve, reject) => settled.then(resolve, reject) };
  };
  return {
    calls,
    replies,
    rpc,
    answer: (name, ...next) => replies.set(name, [...(replies.get(name) ?? []), ...next]),
  };
});

vi.mock("./supabaseClient.js", async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: true,
  supabase: { rpc: net.rpc },
}));

import { REQUEST_TIMEOUT_MESSAGE } from "./supabaseClient.js";
import { FacultyFilter } from "./FacultyFilter.jsx";

const DEADLINE_ABORT = {
  success: false,
  data: null,
  error: {
    message: `AbortError: ${REQUEST_TIMEOUT_MESSAGE}`,
    details: `AbortError: ${REQUEST_TIMEOUT_MESSAGE}`,
    hint: "Request was aborted (timeout or manual cancellation)",
    code: "",
  },
  count: null,
  status: 0,
  statusText: "",
};
const FACETS = [
  { teacher_id: 7, display_name: "Amit Bijarnia", slug: "amit-bijarnia", verified: true, course_count: 3 },
  { teacher_id: 9, display_name: "Priya Nair", slug: "priya-nair", verified: false, course_count: 1 },
];
// A chapter-scoped /browse, as BrowsePage hands it over once the slugs resolve.
const SCOPE = { goalId: 1, subjectId: 10, chapterId: 23, enabled: true };
const FAILED = "Couldn't load faculty filters.";

const retryButton = () => screen.queryByRole("button", { name: "Try loading faculty filters again" });
const clickRetry = () => {
  const button = retryButton();
  expect(button, "the failed facet lookup offers no way to ask again").not.toBeNull();
  fireEvent.click(button);
};
const facetCalls = () => net.calls.filter((call) => call.name === "get_faculty_facets");

function Harness({ onAvailabilityChange }) {
  const [params, setParams] = useSearchParams();
  return (
    <FacultyFilter
      params={params}
      setParams={setParams}
      scope={SCOPE}
      onAvailabilityChange={onAvailabilityChange}
    />
  );
}

const renderAt = (url, onAvailabilityChange) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/browse" element={<Harness onAvailabilityChange={onAvailabilityChange} />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  net.calls.length = 0;
  net.replies.clear();
});

describe("the faculty filters alert", () => {
  it("re-sends the failed facet lookup, and shows the teachers once it answers", async () => {
    const availability = vi.fn();
    net.answer("get_faculty_facets", DEADLINE_ABORT);
    renderAt("/browse?ch=23", availability);

    await screen.findByText(FAILED);
    expect(availability).toHaveBeenLastCalledWith("error");

    // The network is back.
    net.answer("get_faculty_facets", { data: FACETS, error: null, status: 200 });
    clickRetry();

    await screen.findByText("Taught by");
    expect(screen.getByText("Amit Bijarnia")).toBeTruthy();
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(retryButton()).toBeNull();
    // BrowsePage releases a ?teacher= link on this, and only on this.
    expect(availability).toHaveBeenLastCalledWith("available");
    // The same question, asked again — the scope did not drift.
    expect(facetCalls()).toHaveLength(2);
    expect(facetCalls()[1].args).toEqual({ p_chapter_id: 23, p_subject_id: 10, p_goal_id: 1 });
    expect(facetCalls()[1].args).toEqual(facetCalls()[0].args);
  });

  it("looks pending while the retry is on its way, and fails honestly again", async () => {
    const availability = vi.fn();
    net.answer("get_faculty_facets", DEADLINE_ABORT);
    renderAt("/browse?ch=23&teacher=7", availability);
    await screen.findByText(FAILED);

    let answerRetry;
    net.answer("get_faculty_facets", new Promise((resolve) => { answerRetry = resolve; }));
    clickRetry();

    // Pending is not failure: the skeleton, no message, no button — and
    // "loading", so BrowsePage swaps its held-back panel for its skeleton
    // instead of reporting a failure that has not happened.
    await screen.findByLabelText("Loading faculty filters");
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(retryButton()).toBeNull();
    expect(availability).toHaveBeenLastCalledWith("loading");

    await act(async () => { answerRetry(DEADLINE_ABORT); });
    await screen.findByText(FAILED);
    expect(retryButton()).not.toBeNull();
    expect(availability).toHaveBeenLastCalledWith("error");
    expect(facetCalls()).toHaveLength(2);
  });
});
