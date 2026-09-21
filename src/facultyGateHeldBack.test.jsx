// /faculty — the same root cause as /browse, one page over.
//
// FacultyDirectory gates the facet query on its dimension lists:
//
//   useFacultyFacets({ ..., enabled: !options.loading && !options.error })
//
// and useFacultyFacets answers a closed gate with loading:true. So when the
// dimension lists FAIL, the facets hook reports "loading" for ever, the page ORs
// that into its own loading flag, and "Loading faculty…" sits above the error
// card saying the directory is unavailable — one line telling the student to
// wait for something that is never coming, directly over the line telling them
// it already failed. aria-busy stays true with it, so a screen reader is told
// the region is still updating.
//
// The cure must not swing the other way. Once the hook stops claiming to load,
// the count line falls through to `${n} faculty members` — and with the facets
// unfetched that reads "0 faculty members", a number nothing counted, printed
// over an error card. Hiding it is the honest rendering; a section with no data
// hides itself.
//
// And a genuinely PENDING lookup must still show its skeleton, which the last
// block pins.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

let MODE = "fail";
const DEAD = { message: "The user aborted a request.", code: "500", details: "", hint: "" };
// The envelope a tripped deadline REALLY produces (postgrest-js 2.110.7 through
// the wrapper in supabaseClient.js): status 0, an EMPTY code, the abort reason
// inside the message. "abort" mode answers with it; see the last block.
const ABORT_TEXT = "AbortError: Request timeout: the server did not answer in time.";
const ABORTED = {
  message: ABORT_TEXT, details: ABORT_TEXT,
  hint: "Request was aborted (timeout or manual cancellation)", code: "",
};
const rpcCalls = [];
const answer = () => {
  if (MODE === "hang") return new Promise(() => {});
  if (MODE === "ok") return Promise.resolve({ data: [], error: null, count: 0 });
  if (MODE === "abort") {
    return Promise.resolve({ data: null, error: ABORTED, count: null, status: 0, statusText: "" });
  }
  return Promise.resolve({ data: null, error: DEAD, count: null });
};

function builder() {
  const b = {
    select: () => b, order: () => b, limit: () => b, range: () => b,
    eq: () => b, in: () => b, ilike: () => b,
    maybeSingle: () => answer(),
    then: (resolve, reject) => answer().then(resolve, reject),
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => builder(),
    rpc: (name) => { rpcCalls.push(name); return answer(); },
  },
}));

import FacultyDirectory from "./FacultyDirectory.jsx";
import { useFacultyFacets } from "./useFaculty.js";

const renderDirectory = () =>
  render(
    <MemoryRouter initialEntries={["/faculty"]}>
      <Routes><Route path="/faculty" element={<FacultyDirectory />} /></Routes>
    </MemoryRouter>,
  );

const pulses = () => document.querySelectorAll(".animate-pulse");
const text = () => document.body.textContent.replace(/\s+/g, " ");
const settle = () => new Promise((r) => setTimeout(r, 60));

beforeEach(() => { MODE = "fail"; rpcCalls.length = 0; });

describe("/faculty when the lists that gate the facets FAILED", () => {
  it("stops saying it is loading, and says so nowhere on the page", async () => {
    renderDirectory();

    await screen.findByText(/Faculty directory unavailable/);
    await settle();

    expect(screen.queryByText(/Loading faculty/), "still loading above its own error card").toBeNull();
    expect(pulses().length).toBe(0);
  });

  it("prints no faculty count it cannot vouch for", async () => {
    renderDirectory();

    await screen.findByText(/Faculty directory unavailable/);
    await settle();

    expect(text(), "printed a faculty count nothing measured").not.toMatch(/\b0 facult/);
  });

  it("leaves the results region not busy", async () => {
    renderDirectory();

    await screen.findByText(/Faculty directory unavailable/);
    await settle();

    const region = document.querySelector('section[aria-label="Faculty results"]');
    expect(region.getAttribute("aria-busy")).toBe("false");
  });
});

describe("/faculty while its lists are still PENDING", () => {
  it("keeps the skeleton and the loading line", async () => {
    MODE = "hang";
    renderDirectory();

    await screen.findByText(/Loading faculty/);
    expect(pulses().length, "the pending directory stopped showing skeletons").toBeGreaterThan(0);
    expect(screen.queryByText(/Faculty directory unavailable/)).toBeNull();
  });
});

// The distinction, at the hook. `enabled:false` cannot say WHY on its own, and
// answering both reasons with loading:true is what the page had to render.
describe("useFacultyFacets tells a pending prerequisite from a failed one", () => {
  it("holds the skeleton while a prerequisite is still resolving", async () => {
    const { result } = renderHook(() => useFacultyFacets({ enabled: false }));
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.facets).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it("reports not-loading once a prerequisite has failed", async () => {
    const { result } = renderHook(() => useFacultyFacets({ enabled: false, blocked: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facets).toEqual([]);
    // The failure belongs to the caller's prerequisite, not to this hook: it
    // must not invent a second error message for the same thing.
    expect(result.current.error).toBeNull();
    // and still no request — being blocked is not a reason to ask
    expect(rpcCalls).toHaveLength(0);
  });

  it("asks the database again as soon as the gate opens", async () => {
    MODE = "ok";
    const { rerender, result } = renderHook(
      ({ enabled, blocked }) => useFacultyFacets({ enabled, blocked }),
      { initialProps: { enabled: false, blocked: true } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpcCalls).toHaveLength(0);

    rerender({ enabled: true, blocked: false });
    await waitFor(() => expect(rpcCalls).toEqual(["get_faculty_facets"]));
  });
});

// The directory's gate reads only `options.error` for truthiness, never its
// message or code — but isMissingFacultyCapability DOES read code and message,
// and a match there means "hide the feature", not "report a failure". So the
// real envelope is driven end to end rather than argued about.
describe("/faculty with the REAL abort envelope", () => {
  it("fails as a failure: error card, no loading line, no count, not busy, no facets request", async () => {
    MODE = "abort";
    renderDirectory();

    await screen.findByText(/Faculty directory unavailable/);
    await settle();

    expect(screen.queryByText(/Loading faculty/)).toBeNull();
    expect(pulses().length).toBe(0);
    expect(text()).not.toMatch(/\b0 facult/);
    expect(document.querySelector('section[aria-label="Faculty results"]').getAttribute("aria-busy")).toBe("false");
    // blocked is not a reason to ask
    expect(rpcCalls).not.toContain("get_faculty_facets");
  });
});
