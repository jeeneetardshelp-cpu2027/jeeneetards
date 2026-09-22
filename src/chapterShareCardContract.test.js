// The two halves of a chapter share preview, joined end to end.
//
// middleware.js writes og:image on /course/:id/chapter/:chapterId, and
// api/og.js serves the card. /api/og 308-redirects every query string that is
// not its one canonical spelling, and a scraper that meets a redirect on
// og:image may drop the card entirely — so if the edge ever emits a URL the
// handler does not treat as canonical (parameter order, padded ids, an extra
// param, a stray &amp;), each half still passes its own tests and previews
// silently degrade. This test takes the og:image the middleware ACTUALLY
// emits and requests exactly that path+query from the handler.
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware from "../middleware.js";
import ogHandler from "../api/og.js";
import { chapterCardTree, courseCardTree } from "../api/_og/cardModel.js";

vi.mock("../api/_og/cardModel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    courseCardTree: vi.fn(actual.courseCardTree),
    chapterCardTree: vi.fn(actual.chapterCardTree),
  };
});

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

const COURSE = {
  title: "Rectilinear Motion (Kinematics)",
  teacher: "Ashish Arora",
  average_rating: 4.6,
  ratings_count: 12,
  subjects: { name: "Physics" },
  institutes_channels: { name: "Physics Galaxy" },
  playlist_videos: [{ count: 24 }],
  lessons: [],
};

// One fake Supabase serving both halves: the course row for /playlists and
// the chapter membership row (with a within-course Content-Range total) for
// /playlist_videos — the same query shape both halves send.
function stubCatalogue() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
  const fetchSpy = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/playlists")) return Response.json([COURSE]);
    if (url.includes("/rest/v1/playlist_videos")) {
      return Response.json(
        [{ playlist_id: 13, videos: { chapter_id: 8, chapters: { name: "Relative Motion" } } }],
        { status: 206, headers: { "content-range": "0-0/3" } },
      );
    }
    return new Response(shell, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(body) { this.body = body ?? null; },
  };
}

// Decode the attribute exactly as a scraper's HTML parser would.
const decodeAttr = (value) => value
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("chapter share preview: edge og:image <-> /api/og", () => {
  it.each([
    "/course/13/chapter/8",
    // The route regex accepts padded ids; the emitted image must still be the
    // handler's canonical spelling.
    "/course/013/chapter/08",
  ])("the og:image emitted for %s renders a chapter card without redirecting", async (path) => {
    stubCatalogue();
    const page = await middleware(new Request(`https://www.jeeneetard.com${path}`));
    expect(page.status).toBe(200);
    const html = await page.text();

    const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    const twitterImage = html.match(/<meta name="twitter:image" content="([^"]*)"/)?.[1];
    expect(ogImage).toBeTruthy();
    expect(twitterImage).toBe(ogImage);

    const imageUrl = new URL(decodeAttr(ogImage));
    expect(imageUrl.origin).toBe("https://www.jeeneetard.com");
    expect(imageUrl.pathname).toBe("/api/og");
    expect(imageUrl.search).toBe("?course=13&chapter=8");

    // Request exactly that path+query from the serverless handler.
    stubCatalogue();
    const res = fakeRes();
    await ogHandler({ url: `${imageUrl.pathname}${imageUrl.search}` }, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    // And it is the CHAPTER card, not the course card.
    expect(chapterCardTree).toHaveBeenCalledTimes(1);
    expect(courseCardTree).not.toHaveBeenCalled();
    expect(chapterCardTree.mock.calls[0][0]).toMatchObject({
      chapter: "Relative Motion",
      lectures: 3,
    });
  }, 30_000);
});
