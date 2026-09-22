// Tests for the /api/og handler plumbing. The pure layout/model logic is
// covered in api/_og/cardModel.test.js; these prove the handler's contract:
// every failure degrades to a redirect at the static social-preview.png
// (a link preview must never 500), and the happy path emits a real cacheable
// 1200x630 PNG — rendered through actual satori + resvg, so a broken native
// binding or font module fails here, not in production.
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./og.js";
import { chapterCardTree, courseCardTree } from "./_og/cardModel.js";

// Pass-through spies on the two tree builders, so a handler test can tell
// WHICH card was rendered without decoding the PNG.
vi.mock("./_og/cardModel.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    courseCardTree: vi.fn(actual.courseCardTree),
    chapterCardTree: vi.fn(actual.chapterCardTree),
  };
});

const ROW = {
  title: "Rotational Motion — Complete Course",
  teacher: "Mahendra Singh",
  average_rating: 4.6,
  ratings_count: 12,
  subjects: { name: "Physics" },
  institutes_channels: { name: "Unacademy NEET" },
  playlist_videos: [{ count: 14 }],
};

const FALLBACK = "https://www.jeeneetard.com/social-preview.png";

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(body) { this.body = body ?? null; this.ended = true; },
  };
  return res;
}

const request = (qs) => ({ url: `/api/og${qs}` });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubSupabase(rows) {
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

describe("/api/og", () => {
  it("redirects to the static preview for an invalid course id, without a lookup", async () => {
    const fetchSpy = stubSupabase([ROW]);
    for (const qs of ["", "?course=abc", "?course=0", "?course=-4", "?course=1.5"]) {
      const res = fakeRes();
      await handler(request(qs), res);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(FALLBACK);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects when the course does not exist", async () => {
    stubSupabase([]);
    const res = fakeRes();
    await handler(request("?course=374"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
  });

  it("redirects when Supabase is unreachable", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const res = fakeRes();
    await handler(request("?course=374"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
  });

  it("redirects rather than rendering tofu for a Devanagari title", async () => {
    stubSupabase([{ ...ROW, title: "कबीर की साखी" }]);
    const res = fakeRes();
    await handler(request("?course=374"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
  });

  it("renders a cacheable PNG card for a real course", async () => {
    const fetchSpy = stubSupabase([ROW]);
    const res = fakeRes();
    await handler(request("?course=374"), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("s-maxage=86400");
    // PNG magic bytes — a real render, not a stub.
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    // The lookup asked only for the card's columns, with the anon key.
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/rest/v1/playlists?id=eq.374");
    expect(new Headers(init.headers).get("apikey")).toBe("anon-key");
  }, 30_000);
});

// The CDN keys on the exact query string, and this endpoint's URL is published
// in the og:image of every course page — where anything can append to it. Each
// distinct variant used to pay a fresh satori+resvg render AND a database read
// even though the handler ignores every parameter except `course`.
describe("cache key is canonical", () => {
  it("redirects a decorated URL onto the one cacheable form, without rendering", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = fakeRes();
    await handler(request("?course=5&utm_source=whatsapp"), res);

    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("/api/og?course=5");
    // The point of the fix: no database read and no image render on a variant.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.body).toBeNull();
    // And the redirect itself is cached, so the second hit never reaches us.
    expect(res.headers["cache-control"]).toMatch(/s-maxage=604800/);
  });

  it("normalises an equivalent id rather than caching it twice", async () => {
    const res = fakeRes();
    await handler(request("?course=007"), res);
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe("/api/og?course=7");
  });

  it("does not redirect the canonical URL, so there is no loop", async () => {
    const res = fakeRes();
    await handler(request("?course=5"), res);
    expect(res.statusCode).not.toBe(308);
  });

  it("still falls back, never redirects, when the id is unusable", async () => {
    const res = fakeRes();
    await handler(request("?course=abc&utm_source=x"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
  });
});

// The chapter card. ChapterCleared shares /course/:id/chapter/:chapterId, and
// as measured on 15 Sep 2026 that preview showed the whole course's card.
describe("chapter card", () => {
  const CHAPTER_ROWS = [{ videos: { chapter_id: 78, chapters: { name: "Binomial Theorem" } } }];

  // Routes the two lookups the way PostgREST answers them: the course row from
  // /playlists, and the chapter row plus a Content-Range total (Prefer:
  // count=exact) from /playlist_videos.
  function stubBoth({ course = [ROW], chapter = CHAPTER_ROWS, total = 92, chapterFails = false, chapterStatus = null } = {}) {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    const fetchSpy = vi.fn(async (input) => {
      const u = String(input);
      if (u.includes("/rest/v1/playlist_videos")) {
        if (chapterFails) throw new Error("timeout");
        if (chapterStatus) return new Response("upstream error", { status: chapterStatus });
        return new Response(JSON.stringify(chapter), {
          status: chapter.length ? 206 : 200,
          headers: {
            "content-type": "application/json",
            "content-range": chapter.length ? `0-0/${total}` : "*/0",
          },
        });
      }
      return new Response(JSON.stringify(course), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    return fetchSpy;
  }

  it("renders the canonical chapter URL as a chapter card, without redirecting", async () => {
    const fetchSpy = stubBoth();
    const res = fakeRes();
    await handler(request("?course=88&chapter=78"), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(chapterCardTree).toHaveBeenCalledTimes(1);
    expect(courseCardTree).not.toHaveBeenCalled();
    expect(chapterCardTree.mock.calls[0][0]).toMatchObject({
      chapter: "Binomial Theorem",
      courseTitle: ROW.title,
      lectures: 92,
    });

    // The chapter lookup is scoped to THIS course and asks for an exact count.
    const chapterCall = fetchSpy.mock.calls.find(([u]) => String(u).includes("/playlist_videos"));
    expect(String(chapterCall[0])).toContain("playlist_id=eq.88");
    expect(String(chapterCall[0])).toContain("videos.chapter_id=eq.78");
    expect(new Headers(chapterCall[1].headers).get("prefer")).toBe("count=exact");
  }, 30_000);

  it("redirects reordered or decorated chapter queries onto the canonical form", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const qs of [
      "?chapter=78&course=88",
      "?course=88&chapter=78&utm_source=whatsapp",
      "?course=088&chapter=078",
      "?course=88&chapter=%2078",
    ]) {
      const res = fakeRes();
      await handler(request(qs), res);
      expect(res.statusCode).toBe(308);
      expect(res.headers.location).toBe("/api/og?course=88&chapter=78");
      expect(res.headers["cache-control"]).toMatch(/s-maxage=604800/);
      expect(res.body).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects an invalid chapter value to the course card URL", async () => {
    for (const qs of ["?course=88&chapter=abc", "?course=88&chapter=0", "?course=88&chapter=", "?course=88&chapter=-2"]) {
      const res = fakeRes();
      await handler(request(qs), res);
      expect(res.statusCode).toBe(308);
      expect(res.headers.location).toBe("/api/og?course=88");
    }
  });

  it("renders the course card when the chapter is not in the course", async () => {
    stubBoth({ chapter: [] });
    const res = fakeRes();
    await handler(request("?course=88&chapter=99999"), res);
    expect(res.statusCode).toBe(200);
    expect(courseCardTree).toHaveBeenCalledTimes(1);
    expect(chapterCardTree).not.toHaveBeenCalled();
    // A CONFIRMED non-member is a true answer: the long cache is fine.
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    );
  }, 30_000);

  // Regression: a failed chapter lookup used to go out with the day-long
  // success header, pinning the course card on the chapter card's canonical
  // URL at the CDN for 24h (plus stale serving) after one Supabase blip.
  it("caches a course card drawn for a FAILED chapter lookup only briefly", async () => {
    for (const opts of [{ chapterFails: true }, { chapterStatus: 503 }]) {
      vi.clearAllMocks();
      stubBoth(opts);
      const res = fakeRes();
      await handler(request("?course=88&chapter=78"), res);
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(courseCardTree).toHaveBeenCalledTimes(1);
      expect(chapterCardTree).not.toHaveBeenCalled();
      expect(res.headers["cache-control"]).toBe("public, max-age=0, s-maxage=3600");
    }
  }, 60_000);

  it("renders the course card when the chapter lookup fails", async () => {
    stubBoth({ chapterFails: true });
    const res = fakeRes();
    await handler(request("?course=88&chapter=78"), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(courseCardTree).toHaveBeenCalledTimes(1);
    expect(chapterCardTree).not.toHaveBeenCalled();
  }, 30_000);

  it("renders the course card when the chapter row has no name", async () => {
    stubBoth({ chapter: [{ videos: { chapter_id: 78, chapters: null } }] });
    const res = fakeRes();
    await handler(request("?course=88&chapter=78"), res);
    expect(res.statusCode).toBe(200);
    expect(courseCardTree).toHaveBeenCalledTimes(1);
    expect(res.headers["cache-control"]).toContain("s-maxage=86400");
  }, 30_000);

  it("still falls back statically when the course lookup fails", async () => {
    stubBoth({ course: [] });
    const res = fakeRes();
    await handler(request("?course=88&chapter=78"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
    expect(chapterCardTree).not.toHaveBeenCalled();
  });

  it("falls back statically for a Devanagari chapter name", async () => {
    stubBoth({ chapter: [{ videos: { chapter_id: 78, chapters: { name: "द्विपद प्रमेय" } } }] });
    const res = fakeRes();
    await handler(request("?course=88&chapter=78"), res);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(FALLBACK);
    expect(chapterCardTree).not.toHaveBeenCalled();
  });
});
