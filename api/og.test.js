// Tests for the /api/og handler plumbing. The pure layout/model logic is
// covered in api/_og/cardModel.test.js; these prove the handler's contract:
// every failure degrades to a redirect at the static social-preview.png
// (a link preview must never 500), and the happy path emits a real cacheable
// 1200x630 PNG — rendered through actual satori + resvg, so a broken native
// binding or font module fails here, not in production.
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./og.js";

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
