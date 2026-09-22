// /materials — a failed FILTER lookup has a way out of its own.
//
// The page asks two independent questions: get_study_materials (the list) and
// get_study_material_curriculum (the Class / Subject / Chapter options). The
// list's Try again re-sends the first and nothing else. So when the curriculum
// lookup failed — one deadline abort is enough — "Couldn't load study-material
// filters." had no way out at all: the network came back, the list recovered,
// and the alert stayed above a Class and a Subject select offering nothing but
// "All". Measured through the real client, a hung transport and the real
// deadline, not assumed.
//
// These run the REAL hooks over a scripted rpc. A failure is answered with the
// shape postgrest RESOLVES to after a deadline abort (it never rejects) —
// recorded through the real supabase-js and createDeadlineFetch, less the stack
// trace it appends to `details` — and an rpc call nobody scripted an answer for
// stays pending, the way a slow network does.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => {
  const calls = [];
  const replies = new Map();
  const rpc = (name, args) => {
    calls.push({ name, args });
    const reply = replies.get(name)?.shift();
    const settled = reply === undefined ? new Promise(() => {}) : Promise.resolve(reply);
    const query = { abortSignal: () => query, then: (resolve, reject) => settled.then(resolve, reject) };
    return query;
  };
  return {
    calls,
    replies,
    rpc,
    answer: (name, ...next) => replies.set(name, [...(replies.get(name) ?? []), ...next]),
    sent: (name) => calls.filter((call) => call.name === name),
  };
});

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));
vi.mock("./supabaseClient.js", async (importOriginal) => ({
  ...(await importOriginal()),
  isSupabaseConfigured: true,
  supabase: { rpc: net.rpc },
}));

import { REQUEST_TIMEOUT_MESSAGE } from "./supabaseClient.js";
import StudyMaterialsPage from "./StudyMaterialsPage.jsx";

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
const ok = (data) => ({ data, error: null, status: 200 });
const CURRICULUM = [
  { level: "goal", entity_id: 1, slug: "jee", name: "JEE", resource_count: 5 },
  { level: "class", entity_id: 11, slug: "class-11", name: "Class 11", resource_count: 3 },
  { level: "subject", entity_id: 10, slug: "physics", name: "Physics", resource_count: 3 },
];

const FILTERS_FAILED = "Couldn't load study-material filters.";
const LIST_FAILED = "Couldn't load study material.";
const filterRetry = () => screen.queryByRole("button", { name: "Try loading filters again" });
const clickFilterRetry = () => {
  const button = filterRetry();
  expect(button, "the failed filter lookup offers no way to ask again").not.toBeNull();
  fireEvent.click(button);
};
const optionNames = (label) =>
  [...screen.getByRole("combobox", { name: label }).options].map((option) => option.textContent);

const renderPage = () => render(
  <MemoryRouter initialEntries={["/materials?goal=jee"]}>
    <StudyMaterialsPage />
  </MemoryRouter>,
);

beforeEach(() => {
  net.calls.length = 0;
  net.replies.clear();
});

describe("the study-material filters alert", () => {
  it("re-sends the failed curriculum lookup alone, and clears once it answers", async () => {
    net.answer("get_study_materials", ok([]));
    net.answer("get_study_material_curriculum", DEADLINE_ABORT);
    renderPage();

    await screen.findByText(FILTERS_FAILED);
    expect(screen.queryByText(LIST_FAILED)).toBeNull();
    expect(optionNames("Class")).toEqual(["All classes"]);
    expect(optionNames("Subject")).toEqual(["All subjects"]);

    // The network is back.
    net.answer("get_study_material_curriculum", ok(CURRICULUM));
    const before = net.calls.length;
    clickFilterRetry();

    await screen.findByRole("option", { name: "Class 11" });
    expect(screen.getByRole("option", { name: "Physics" })).toBeTruthy();
    expect(screen.queryByText(FILTERS_FAILED)).toBeNull();
    expect(filterRetry()).toBeNull();
    expect(screen.getByRole("combobox", { name: "Class" }).disabled).toBe(false);
    // Exactly the request that failed, asked the same way — the list that
    // already answered is not asked again.
    const resent = net.calls.slice(before);
    expect(resent.map((call) => call.name)).toEqual(["get_study_material_curriculum"]);
    expect(resent[0].args).toEqual(net.sent("get_study_material_curriculum")[0].args);
  });

  it("looks pending while the retry is on its way, and fails honestly again", async () => {
    net.answer("get_study_materials", ok([]));
    net.answer("get_study_material_curriculum", DEADLINE_ABORT);
    renderPage();
    await screen.findByText(FILTERS_FAILED);

    let answerRetry;
    net.answer("get_study_material_curriculum", new Promise((resolve) => { answerRetry = resolve; }));
    clickFilterRetry();

    // Pending is not failure: no alert and no button while an answer is on its
    // way, and the lists that depend on it are held rather than offered empty.
    await vi.waitFor(() => expect(screen.queryByText(FILTERS_FAILED)).toBeNull());
    expect(filterRetry()).toBeNull();
    expect(screen.getByRole("combobox", { name: "Class" }).disabled).toBe(true);
    expect(screen.getByRole("combobox", { name: "Subject" }).disabled).toBe(true);

    await act(async () => { answerRetry(DEADLINE_ABORT); });
    await screen.findByText(FILTERS_FAILED);
    expect(filterRetry()).not.toBeNull();
    expect(net.sent("get_study_material_curriculum")).toHaveLength(2);
  });

  it("keeps each Try again to its own request when both lookups failed", async () => {
    net.answer("get_study_materials", DEADLINE_ABORT);
    net.answer("get_study_material_curriculum", DEADLINE_ABORT);
    renderPage();
    await screen.findByText(LIST_FAILED);
    await screen.findByText(FILTERS_FAILED);

    net.answer("get_study_materials", ok([]));
    net.answer("get_study_material_curriculum", ok(CURRICULUM));

    // The list's Try again: the list recovers, the filters are still failed and
    // still say so, with their own way out.
    let before = net.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/No reviewed material/);
    expect(net.calls.slice(before).map((call) => call.name)).toEqual(["get_study_materials"]);
    expect(screen.getByText(FILTERS_FAILED)).toBeTruthy();

    before = net.calls.length;
    clickFilterRetry();
    await screen.findByRole("option", { name: "Class 11" });
    expect(net.calls.slice(before).map((call) => call.name)).toEqual(["get_study_material_curriculum"]);
    expect(screen.queryByText(FILTERS_FAILED)).toBeNull();
  });
});
