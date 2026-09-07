// The edge is part of the release, not a separate thing that outlives it.
//
// releaseCapabilities.js is the release contract: a feature is on only when the
// database capability is deployed AND the flag is true. /polls and /forum both
// got crawler-visible bodies without consulting it, which is latent while both
// flags are true and wrong the moment either is rolled back — the served HTML
// would keep advertising a route the app refuses to render, and a crawler would
// index a page students then cannot use.
//
// This lives in its own file because it has to mock the flags module, and
// vi.mock is hoisted to the top of whatever file it appears in: doing it inside
// middlewareSeo.test.js would silently apply to every other test there.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock("./releaseCapabilities.js");
  vi.resetModules();
});

/** Load a fresh middleware whose RELEASE_FEATURES carry the given overrides. */
async function middlewareWithFeatures(overrides) {
  vi.resetModules();
  const actual = await vi.importActual("./releaseCapabilities.js");
  vi.doMock("./releaseCapabilities.js", () => ({
    ...actual,
    RELEASE_FEATURES: Object.freeze({ ...actual.RELEASE_FEATURES, ...overrides }),
  }));
  return (await import("../middleware.js")).default;
}

function stubFeed(rows) {
  const spy = vi.fn(async (input) => {
    if (String(input).endsWith("/rpc/get_polls_feed")) return Response.json(rows);
    return new Response(shell, { status: 200 });
  });
  vi.stubEnv("VITE_SUPABASE_URL", "https://polls.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubGlobal("fetch", spy);
  return spy;
}

const LIVE = [{ slug: "is-coaching-worth-it-3", question: "Is coaching worth it?", vote_count: 4, status: "live" }];

describe("edge bodies respect the release flags", () => {
  // The control. Without this the two rollback tests below could pass for any
  // reason at all — a broken import, a typo in the path — and still look green.
  it("serves the poll list while the polls flag is on", async () => {
    const middleware = await middlewareWithFeatures({ polls: true });
    stubFeed(LIVE);
    const html = await (await middleware(new Request("https://www.jeeneetard.com/polls"))).text();
    expect(html).toContain("<h1>Student polls</h1>");
    expect(html).toContain("Is coaching worth it?");
  });

  it("stops advertising /polls when the polls flag is rolled back", async () => {
    const middleware = await middlewareWithFeatures({ polls: false });
    const spy = stubFeed(LIVE);
    const html = await (await middleware(new Request("https://www.jeeneetard.com/polls"))).text();

    // Back to the untouched shell: no heading, no poll, and no crawl path.
    expect(html).not.toContain("<h1>Student polls</h1>");
    expect(html).not.toContain("Is coaching worth it?");
    expect(html).toContain('class="boot"');
    // And the edge does not pay for a feed it must not render.
    expect(spy.mock.calls.some(([i]) => String(i).endsWith("/rpc/get_polls_feed"))).toBe(false);
  });

  it("serves the forum blurb while the forum flag is on", async () => {
    const middleware = await middlewareWithFeatures({ forum: true });
    stubFeed([]);
    const html = await (await middleware(new Request("https://www.jeeneetard.com/forum"))).text();
    expect(html).toContain("<h1>Student preparation forum</h1>");
    // The sentence the React page shows a visitor who cannot post. The served
    // HTML must never issue an invitation the app will not honour.
    expect(html).toContain("only invited student testers can publish");
  });

  it("stops advertising /forum when the forum flag is rolled back", async () => {
    const middleware = await middlewareWithFeatures({ forum: false });
    stubFeed([]);
    const html = await (await middleware(new Request("https://www.jeeneetard.com/forum"))).text();
    expect(html).not.toContain("<h1>Student preparation forum</h1>");
    expect(html).toContain('class="boot"');
  });
});
