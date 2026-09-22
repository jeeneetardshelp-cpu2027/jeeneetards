// FacultyProfile.retry.test.jsx — /faculty/:slug when get_faculty_profile
// fails or is still in flight.
//
// Since supabaseClient.js puts a deadline on every data request, a slow
// profile lookup now ENDS — and postgrest resolves it, never rejects, with the
// ABORTED shape below. The page showed that as a bare "Couldn't load this
// faculty page." with no heading and nothing that could ask again: the hook's
// effect depended only on the slug, so the student's one way out was a reload.
//
// The rule: a FAILED lookup ends in an error with a working Try again; a
// PENDING one still looks pending; an answer clears the error.
//
// Real useFaculty hook and the real page; only the network is stubbed.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({ answer: () => null, calls: [] }));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    // A pending answer is a promise the test settles (or never does).
    rpc: (fn, args) => {
      net.calls.push({ fn, args });
      return Promise.resolve(net.answer(fn, args));
    },
  },
}));

import FacultyProfile from "./FacultyProfile.jsx";
import { ThemeProvider } from "./theme.jsx";

const ok = (data) => ({ data, error: null, count: null, status: 200, statusText: "OK" });

// What postgrest-js resolves with when the request deadline aborts a request
// (dist/index.cjs, the AbortError branch of its fetch catch).
const ABORTED = {
  success: false,
  data: null,
  error: {
    message: "AbortError: Request timeout: the server did not answer in time.",
    details: "AbortError: Request timeout: the server did not answer in time.",
    hint: "Request was aborted (timeout or manual cancellation)",
    code: "",
  },
  count: null,
  status: 0,
  statusText: "",
};

// Shaped like production's get_faculty_profile answer for this slug, trimmed
// to one course.
const PROFILE = ok({
  id: 1, slug: "amit-bijarnia", display_name: "Amit Bijarnia", verified: true,
  course_count: 1, bio: null, photo_url: null, institutes: ["Mohit Tyagi"],
  aliases: [{ type: "initials", alias: "ABJ Sir", status: "verified" }],
  courses: [{
    playlist_id: 510, title: "ABJ Sir Fluid Mechanics — Class 11", subject: "Physics",
    role: "instructor", average_rating: 0, ratings_count: 0,
  }],
});

const ERROR = "Couldn't load this faculty page.";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const renderAt = (url = "/faculty/amit-bijarnia") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/faculty/:slug" element={<FacultyProfile />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const pulses = () => document.querySelector("main").querySelectorAll(".animate-pulse").length;
const profileCalls = () => net.calls.filter((call) => call.fn === "get_faculty_profile");
// Small slices, never one long act(): a single act holds passive effects until
// it returns, so a "still pending" check inside one would pass whatever the
// page does.
const slices = async (count = 8) => {
  for (let i = 0; i < count; i += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }
};

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  net.calls.length = 0;
  net.answer = () => ABORTED;
});

describe("a faculty page whose profile lookup fails", () => {
  it("says so as the page heading, with a Try again that asks for this profile again", async () => {
    renderAt();

    expect(await screen.findByRole("heading", { level: 1, name: ERROR })).toBeTruthy();
    expect(pulses()).toBe(0);
    expect(profileCalls()).toHaveLength(1);

    // The network is back but slow: Try again is pending, so it looks pending.
    const later = deferred();
    net.answer = () => later.promise;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await slices();

    expect(pulses()).toBe(2);
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    // Exactly its own request, for the same teacher, once.
    expect(profileCalls().map((call) => call.args)).toEqual([
      { p_slug: "amit-bijarnia" },
      { p_slug: "amit-bijarnia" },
    ]);

    await act(async () => { later.resolve(PROFILE); });

    expect(await screen.findByRole("heading", { level: 1, name: /Amit Bijarnia/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Fluid Mechanics/ })).toBeTruthy();
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(pulses()).toBe(0);
  });

  it("brings the error back, with its Try again, when the second attempt fails too", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: ERROR });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    // Cleared the moment it asks again, before the answer lands.
    expect(screen.queryByText(ERROR)).toBeNull();

    expect(await screen.findByRole("heading", { level: 1, name: ERROR })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(profileCalls()).toHaveLength(2);
  });
});

describe("a faculty page whose profile lookup is still in flight", () => {
  it("keeps its skeleton and claims nothing", async () => {
    net.answer = () => new Promise(() => {});
    renderAt();
    await slices();

    expect(profileCalls()).toHaveLength(1);
    expect(pulses()).toBe(2);
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText(/No faculty page for/)).toBeNull();
  });
});
