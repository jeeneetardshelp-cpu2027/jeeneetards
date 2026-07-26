import { describe, expect, it } from "vitest";
import { allExact, ProbeError } from "./scripts/dbProbe.js";

const numberedRows = (length) =>
  Array.from({ length }, (_, index) => ({ id: index + 1 }));

function pagedBuild(source, { serverCap = Infinity, calls = [] } = {}) {
  return (countMode) => ({
    range(from, to) {
      calls.push({ countMode, from, to });
      const last = Math.min(to, from + serverCap - 1);
      return Promise.resolve({
        data: source.slice(from, last + 1),
        error: null,
        count: countMode === "exact" ? source.length : null,
        status: 200,
      });
    },
  });
}

describe("allExact", () => {
  it("fetches all 1,201 rows instead of stopping at the response cap", async () => {
    const calls = [];
    const result = await allExact(
      "large catalogue",
      pagedBuild(numberedRows(1201), { serverCap: 1000, calls }),
    );

    expect(result).toHaveLength(1201);
    expect(result.at(-1)).toEqual({ id: 1201 });
    expect(calls.map(({ countMode, from }) => ({ countMode, from }))).toEqual([
      { countMode: "exact", from: 0 },
      { countMode: null, from: 1000 },
    ]);
  });

  it("does not request a phantom page at an exact boundary", async () => {
    const calls = [];

    await expect(allExact(
      "exact boundary",
      pagedBuild(numberedRows(1000), { serverCap: 1000, calls }),
    )).resolves.toHaveLength(1000);
    expect(calls).toHaveLength(1);
  });

  it("advances by rows received when the server cap is below the requested page", async () => {
    const calls = [];

    await expect(allExact(
      "lower cap",
      pagedBuild(numberedRows(250), { serverCap: 100, calls }),
    )).resolves.toHaveLength(250);
    expect(calls.map((call) => call.from)).toEqual([0, 100, 200]);
  });

  it("accepts an exact empty result", async () => {
    await expect(allExact(
      "empty catalogue",
      pagedBuild([]),
    )).resolves.toEqual([]);
  });

  it("fails when the first page omits its exact count", async () => {
    const build = () => ({
      range: () => Promise.resolve({ data: [{ id: 1 }], error: null, status: 200 }),
    });

    await expect(allExact("missing count", build)).rejects.toThrow(
      /first page did not include an exact count/,
    );
  });

  it("fails on an empty intermediate page", async () => {
    let page = 0;
    const build = (countMode) => ({
      range: () => Promise.resolve(page++ === 0
        ? { data: [{ id: 1 }], error: null, count: countMode === "exact" ? 2 : null }
        : { data: [], error: null, count: null }),
    });

    await expect(allExact("empty page", build)).rejects.toThrow(
      /received an empty page after 1 of 2 rows/,
    );
  });

  it("fails if a later page errors", async () => {
    let page = 0;
    const build = (countMode) => ({
      range: () => Promise.resolve(page++ === 0
        ? { data: [{ id: 1 }], error: null, count: countMode === "exact" ? 2 : null }
        : { data: null, error: { message: "network failed", code: "TEST" } }),
    });

    await expect(allExact("later error", build)).rejects.toThrow(
      /network failed \[TEST\]/,
    );
  });

  it("fails on duplicate or missing stable keys", async () => {
    await expect(allExact(
      "duplicate key",
      pagedBuild([{ id: 1 }, { id: 1 }]),
    )).rejects.toThrow(/duplicate row key 1/);

    await expect(allExact(
      "missing key",
      pagedBuild([{ title: "No identifier" }]),
    )).rejects.toBeInstanceOf(ProbeError);
  });
});
