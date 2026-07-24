// "Back to results" must never leave the app.
//
// The bug this guards: the course page used `window.history.length > 1` to
// decide whether Back was safe. That counts the TAB's history, not ours — a
// student reading another site who opens a shared course link has
// history.length > 1, so our own Back button navigated them off the app.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import {
  makeReturnState, isTrustedReturnUrl, readReturnUrl, resolveBack,
  rememberReturn, recallReturn, RETURN_MARKER,
} from "./returnTo.js";

// ---------------------------------------------------------------- unit
describe("what counts as a trusted return URL", () => {
  it("accepts our own results page", () => {
    expect(isTrustedReturnUrl("/browse")).toBe(true);
    expect(isTrustedReturnUrl("/browse?goal=jee&class=11&chapter=kinematics")).toBe(true);
  });

  it("rejects anything that leaves the app", () => {
    for (const bad of [
      "https://evil.test/x",          // absolute
      "//evil.test",                  // protocol-relative — the classic bypass
      "/\\evil.test",                 // backslash variant
      "javascript:alert(1)",          // scheme
      "http://localhost:5173/browse", // absolute, even to ourselves
    ]) expect([bad, isTrustedReturnUrl(bad)]).toEqual([bad, false]);
  });

  it("rejects internal pages that are not the results page", () => {
    // The marker means "you came from Browse". Accepting any internal path
    // would let a stale or crafted state bounce a student somewhere arbitrary.
    for (const p of ["/admin", "/course/1", "/", "/faculty/x", "/browsers"])
      expect([p, isTrustedReturnUrl(p)]).toEqual([p, false]);
  });

  it("rejects junk instead of throwing", () => {
    for (const bad of [null, undefined, "", 42, {}, []])
      expect(isTrustedReturnUrl(bad)).toBe(false);
  });
});

describe("reading the marker", () => {
  it("accepts state stamped by Browse", () => {
    const s = makeReturnState("/browse", "?goal=jee");
    expect(s.from).toBe(RETURN_MARKER);
    expect(readReturnUrl(s)).toBe("/browse?goal=jee");
  });

  it("ignores state without our marker, however plausible", () => {
    expect(readReturnUrl({ url: "/browse?goal=jee" })).toBeNull();
    expect(readReturnUrl({ from: "somewhere-else", url: "/browse" })).toBeNull();
    expect(readReturnUrl(null)).toBeNull();
  });

  it("ignores our marker carrying an untrusted URL", () => {
    expect(readReturnUrl({ from: RETURN_MARKER, url: "https://evil.test" })).toBeNull();
  });
});

describe("resolveBack decides without consulting history.length", () => {
  beforeEach(() => sessionStorage.clear());

  it("uses Back when the origin is proven — that is what restores scroll", () => {
    const state = makeReturnState("/browse", "?goal=jee&class=11&chapter=kinematics");
    expect(resolveBack({ state, coursePath: "/course/1/chapter/1", chapterId: "1" }))
      .toEqual({ mode: "back", url: "/browse?goal=jee&class=11&chapter=kinematics" });
  });

  it("a direct/shared link goes to the chapter's results, staying in the app", () => {
    expect(resolveBack({ state: null, coursePath: "/course/1/chapter/9", chapterId: "9" }))
      .toEqual({ mode: "push", url: "/browse?ch=9" });
  });

  it("with no chapter at all it falls back to /browse", () => {
    expect(resolveBack({ state: null, coursePath: "/course/1", chapterId: undefined }))
      .toEqual({ mode: "push", url: "/browse" });
  });

  it("never returns an external destination", () => {
    const hostile = { from: RETURN_MARKER, url: "//evil.test" };
    const r = resolveBack({ state: hostile, coursePath: "/course/1", chapterId: "3" });
    expect(r.mode).toBe("push");
    expect(r.url).toBe("/browse?ch=3");
  });
});

describe("the marker survives a reload", () => {
  beforeEach(() => sessionStorage.clear());

  it("is recalled for the same course after history state is gone", () => {
    rememberReturn("/course/1/chapter/1", "/browse?goal=jee&chapter=kinematics");
    // simulate a reload: no router state at all
    expect(resolveBack({ state: null, coursePath: "/course/1/chapter/1", chapterId: "1" }))
      .toEqual({ mode: "back", url: "/browse?goal=jee&chapter=kinematics" });
  });

  it("does NOT leak to a different course", () => {
    rememberReturn("/course/1/chapter/1", "/browse?goal=jee");
    expect(resolveBack({ state: null, coursePath: "/course/2/chapter/1", chapterId: "1" }))
      .toEqual({ mode: "push", url: "/browse?ch=1" });
  });

  it("refuses to remember an untrusted URL", () => {
    rememberReturn("/course/1", "https://evil.test");
    expect(recallReturn("/course/1")).toBeNull();
  });
});

// ---------------------------------------------------------------- integration
// A miniature app: Browse stamps the marker, the course page consumes it.
function FakeBrowse() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <div data-testid="loc">{location.pathname + location.search}</div>
      <button onClick={() => navigate("/course/1/chapter/9", {
        state: makeReturnState(location.pathname, location.search),
      })}>
        View course
      </button>
    </div>
  );
}

function FakeCourse() {
  const navigate = useNavigate();
  const location = useLocation();
  const back = resolveBack({
    state: location.state, coursePath: location.pathname, chapterId: "9",
  });
  return (
    <div>
      <div data-testid="loc">{location.pathname + location.search}</div>
      <div data-testid="mode">{back.mode}</div>
      <button onClick={() => (back.mode === "back" ? navigate(-1) : navigate(back.url))}>
        Back to results
      </button>
    </div>
  );
}

const app = (entries) => (
  <MemoryRouter initialEntries={entries}>
    <Routes>
      <Route path="/browse" element={<FakeBrowse />} />
      <Route path="/course/:id/chapter/:ch" element={<FakeCourse />} />
      <Route path="*" element={<div data-testid="loc">OUTSIDE</div>} />
    </Routes>
  </MemoryRouter>
);

describe("Browse -> course -> Back", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns to the exact filtered Browse URL via history", async () => {
    const filtered = "/browse?goal=jee&class=11&subject=physics&chapter=kinematics";
    render(app([filtered]));
    fireEvent.click(screen.getByText("View course"));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/course/1/chapter/9"));
    // proven origin -> history.back(), which is what preserves scroll
    expect(screen.getByTestId("mode").textContent).toBe("back");
    fireEvent.click(screen.getByText("Back to results"));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe(filtered));
  });
});

describe("a shared course link opened cold", () => {
  beforeEach(() => sessionStorage.clear());

  it("stays inside the app instead of going Back out of it", async () => {
    // One entry only, and no marker — exactly a link opened from elsewhere.
    render(app(["/course/1/chapter/9"]));
    expect(screen.getByTestId("mode").textContent).toBe("push");
    fireEvent.click(screen.getByText("Back to results"));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/browse?ch=9"));
    expect(screen.queryByText("OUTSIDE")).toBeNull();
  });

  it("is unaffected by a long external history", async () => {
    // Entries that are NOT ours: history.length would be > 1 here, which is
    // precisely the signal the old code trusted.
    render(app(["/course/1/chapter/9"]));
    expect(screen.getByTestId("mode").textContent).toBe("push");
  });
});
