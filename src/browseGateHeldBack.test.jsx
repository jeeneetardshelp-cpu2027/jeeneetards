// /browse — what the page does when the filter lookup that gates it will
// NEVER answer, as against when it simply has not answered yet.
//
// THE DEFECT. useCanonicalFilters reports a failed lookup as
// { loading: false, error: "Couldn't load this selection.", ready: false }, and
// BrowsePage turns `ready` into the `enabled` gate on both catalogue hooks.
// Those hooks answer a closed gate with loading:true (useBrowse.js,
// usePlaylistBrowse.js), because a gate closed while slugs resolve MUST hold
// the skeleton rather than show an unfiltered list. So "still resolving" and
// "we could not find out" arrive at the renderer as the same state, and the
// slug-scoped URL — the canonical one — pulses six skeletons and says
// "Loading courses…" for ever, directly under an error card that has already
// said the opposite. That is the exact symptom the request deadline exists to
// kill, on the URL shape 204 of the 205 /browse links in the sitemap use.
//
// Bare /browse is the ONE shape that escapes it, because the resolver
// early-returns ready:true when there is nothing to look up — and bare /browse
// is the shape the deadline work happened to exercise.
//
// THE LINE THIS FILE DRAWS. A prerequisite that FAILED, one that came back
// UNKNOWN, and one that is still PENDING are three different things:
//
//   failed / unknown — nothing more is coming without the student acting. The
//                      page already renders the explanation (the error card,
//                      or the "we don't know that filter" panel with its remove
//                      buttons). Skeletons under it are a promise being broken
//                      every frame, and a count printed there would be a number
//                      nothing measured.
//   pending          — something IS coming. The skeleton is correct, and this
//                      file pins that too, so the fix cannot be "stop showing
//                      skeletons".

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// Every request the page can make, answered three ways. "fail" is the
// production shape under the deadline: an aborted request surfaces as a
// PostgREST-style error object, not a rejection.
let MODE = "fail";
const DEAD = { message: "The user aborted a request.", code: "500", details: "", hint: "" };
// The envelope a tripped deadline REALLY produces, measured against
// postgrest-js 2.110.7 with the wrapper in supabaseClient.js: status 0, an EMPTY
// code, and the abort reason (REQUEST_TIMEOUT_MESSAGE) inside the message. DEAD
// above is a stand-in with a 500 code; "abort" mode answers with this instead,
// so the gating is pinned against the shape production actually sees.
const ABORT_TEXT = "AbortError: Request timeout: the server did not answer in time.";
const ABORTED = {
  message: ABORT_TEXT, details: ABORT_TEXT,
  hint: "Request was aborted (timeout or manual cancellation)", code: "",
};
const aborted = () =>
  Promise.resolve({ data: null, error: ABORTED, count: null, status: 0, statusText: "" });
const answer = () => {
  if (MODE === "hang") return new Promise(() => {});
  if (MODE === "empty") return Promise.resolve({ data: null, error: null, count: 0 });
  if (MODE === "abort") return aborted();
  return Promise.resolve({ data: null, error: DEAD, count: null });
};
// A list-shaped answer for the builders read with `await q` / .then().
const rows = () => {
  if (MODE === "hang") return new Promise(() => {});
  if (MODE === "empty") return Promise.resolve({ data: [], error: null, count: 0 });
  if (MODE === "abort") return aborted();
  return Promise.resolve({ data: null, error: DEAD, count: null });
};

function builder() {
  const b = {
    select: () => b, order: () => b, limit: () => b, range: () => b,
    eq: () => b, in: () => b, ilike: () => b, or: () => b, not: () => b,
    maybeSingle: () => answer(),
    single: () => answer(),
    then: (resolve, reject) => rows().then(resolve, reject),
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => builder(), rpc: () => rows() },
}));

import BrowsePage from "./BrowsePage.jsx";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

const pulses = () => document.querySelectorAll(".animate-pulse");
const text = () => document.body.textContent.replace(/\s+/g, " ");
// Let every other in-flight lookup on the page land, so a "no skeletons"
// assertion is about the finished state and not about the order they settled in.
const settle = () => new Promise((r) => setTimeout(r, 60));

beforeEach(() => { MODE = "fail"; });

describe("a /browse filter lookup that FAILED stops the skeletons", () => {
  // The canonical URL: every Explore drill-down, every chapter landing page,
  // and 204 of the 205 /browse URLs in public/sitemap.xml.
  it("clears them on the canonical slug URL", async () => {
    renderAt("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");

    await screen.findByText(/load this selection/);
    await settle();

    expect(screen.queryByText(/Loading courses/), "still claiming to load courses").toBeNull();
    expect(pulses().length, "skeletons still pulsing under the error card").toBe(0);
    // and the failure is still on screen, with its retry. Scoped to the
    // selection card: every request fails in this mock, so the filter panel's
    // own failure card carries a second, legitimate "Try again".
    const card = screen.getByText(/load this selection/).parentElement;
    expect(within(card).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  // Where universal-search results land (searchDestinations.js), where
  // /chapter/:id redirects, and what Compare and returnTo restore.
  it("clears them on the legacy id URL /browse?ch=7", async () => {
    renderAt("/browse?ch=7");

    await screen.findByText(/load this selection/);
    await settle();

    expect(screen.queryByText(/Loading courses/)).toBeNull();
    expect(pulses().length).toBe(0);
  });

  it("clears them on a subject+chapter URL with no goal", async () => {
    renderAt("/browse?subject=physics&chapter=thermodynamics");

    await screen.findByText(/load this selection/);
    await settle();

    expect(screen.queryByText(/Loading courses/)).toBeNull();
    expect(pulses().length).toBe(0);
  });

  // The lectures tab is gated by the same resolver. Its skeleton is
  // BrowsePage's own, and its heading prints a lesson count — which must not
  // become "0 lessons" the moment the skeleton stops, because nothing counted
  // anything.
  it("clears them on the lectures tab without inventing a count", async () => {
    renderAt("/browse?tab=lectures&ch=7");

    await screen.findByText(/load this selection/);
    await settle();

    expect(pulses().length).toBe(0);
    expect(text(), "printed a lesson count nothing measured").not.toMatch(/\b0 lessons\b/);
  });

  it("prints no course count it cannot vouch for", async () => {
    renderAt("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");

    await screen.findByText(/load this selection/);
    await settle();

    expect(text()).not.toMatch(/\b0 courses\b/);
    expect(text()).not.toContain("No courses match this view");
  });
});

// An unknown slug is not a failure — the database answered, and the answer was
// "no such chapter". The panel that says so already tells the student results
// are not shown; six skeletons pulsing below it say the opposite.
describe("a /browse filter that came back UNKNOWN stops the skeletons too", () => {
  it("shows the unresolved panel with nothing pulsing under it", async () => {
    MODE = "empty";
    renderAt("/browse?chapter=does-not-exist");

    await screen.findByText(/is not a chapter we know about/);
    await settle();

    expect(screen.queryByText(/Loading courses/)).toBeNull();
    expect(pulses().length).toBe(0);
    // the way out is still offered
    expect(screen.getByRole("button", { name: "Remove chapter filter" })).toBeTruthy();
  });
});

// The other half of the rule, and the reason the fix cannot simply be "stop
// rendering skeletons": while the lookup is genuinely in flight the skeleton is
// the correct thing on screen, and no error may be shown.
describe("a /browse filter lookup that is still PENDING keeps its skeletons", () => {
  it("keeps them on the canonical slug URL", async () => {
    MODE = "hang";
    renderAt("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");

    await screen.findByText(/Loading courses/);
    expect(pulses().length, "the pending page stopped showing skeletons").toBeGreaterThan(0);
    expect(screen.queryByText(/load this selection/), "a pending lookup was rendered as a failure").toBeNull();
  });

  it("keeps them on the legacy id URL", async () => {
    MODE = "hang";
    renderAt("/browse?ch=7");

    await screen.findByText(/Loading courses/);
    expect(pulses().length).toBeGreaterThan(0);
    expect(screen.queryByText(/load this selection/)).toBeNull();
  });
});

// Everything above fails with a stand-in error. These use the envelope an
// expired deadline actually produces (see ABORTED), because two parts of the
// gate DO read error fields: isMissingChapterScopeTable matches on code,
// message, details and hint, and a match there is not a failure — on ?ch=7 it
// would record "no scope table" and mark the page READY. So "it is still an
// error object" is not enough; the real shape has to be shown to fail as a
// failure.
describe("the REAL abort envelope is gated as a failure, not misread", () => {
  it("stops the skeletons on the canonical slug URL", async () => {
    MODE = "abort";
    renderAt("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");

    await screen.findByText(/load this selection/);
    await settle();

    expect(screen.queryByText(/Loading courses/)).toBeNull();
    expect(pulses().length).toBe(0);
    expect(text()).not.toMatch(/\b0 courses\b/);
    // Scoped to the selection card. Every request fails in this mock, so the
    // filter panel's own failure card ("Filters aren't available.") carries a
    // second, legitimate "Try again", and an unscoped getByRole finds two.
    const card = screen.getByText(/load this selection/).parentElement;
    expect(within(card).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  // Were the abort read as a missing scope table, the resolver would go READY,
  // the lessons query would run, and this page would say "Couldn't load
  // lessons" — never "load this selection" — so the first await would time out.
  it("is not mistaken for a missing scope table on the legacy id URL", async () => {
    MODE = "abort";
    renderAt("/browse?tab=lectures&ch=7");

    await screen.findByText(/load this selection/);
    await settle();

    expect(screen.queryByText(/couldn't load lessons/i)).toBeNull();
    expect(pulses().length).toBe(0);
    expect(text()).not.toMatch(/\b0 lessons\b/);
  });
});

// The same gate has a second reason to be shut: a ?teacher= filter whose
// capability check came back and was not a yes. The page already says "Results
// are held back" there, so skeletons under it are the same broken promise.
// Lectures tab, because its skeleton and count are BrowsePage's own.
describe("a /browse teacher filter that cannot be verified", () => {
  it("stops the lectures skeleton once the check has failed", async () => {
    MODE = "fail";
    renderAt("/browse?tab=lectures&teacher=7");

    await screen.findByText(/cannot be verified/);
    await settle();

    expect(pulses().length).toBe(0);
    expect(text()).not.toMatch(/\b0 lessons\b/);
    expect(screen.getByRole("button", { name: "Remove faculty filter" })).toBeTruthy();
  });

  it("keeps the skeleton while the check is still pending", async () => {
    MODE = "hang";
    renderAt("/browse?tab=lectures&teacher=7");

    await settle();

    expect(pulses().length, "a pending faculty check stopped showing skeletons").toBeGreaterThan(0);
    expect(screen.queryByText(/cannot be verified/)).toBeNull();
  });
});
