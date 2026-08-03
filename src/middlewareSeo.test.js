import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware, { config, isSupportedAppPath } from "../middleware.js";

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("edge-rendered discovery landings", () => {
  it("matches application paths while excluding built and public assets", () => {
    expect(config.matcher).toHaveLength(1);
    expect(config.matcher[0]).toContain("assets/");
    expect(config.matcher[0]).toContain("robots\\.txt");
  });

  it.each([
    "/", "/browse", "/explore/jee/class-11/physics",
    "/faculty/amit-bijarnia", "/chapter/79", "/course/13",
    "/course/13/chapter/8", "/terms", "/privacy", "/search",
  ])("recognises supported application path %s", (pathname) => {
    expect(isSupportedAppPath(pathname)).toBe(true);
  });

  it.each([
    "/not-real", "/course/nope", "/course/13/extra", "/faculty/a/b",
    "/explore/a/b/c/d/e/f", "/chapter/nope",
  ])("rejects unsupported application path %s", (pathname) => {
    expect(isSupportedAppPath(pathname)).toBe(false);
  });

  it.each([
    ["/", "Find the right lecture. Skip the noise."],
    ["/browse", "All courses"],
    ["/explore", "What are you preparing for?"],
  ])("serves crawler-readable HTML for %s", async (pathname, heading) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request(`https://www.jeeneetard.com${pathname}`),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain(
      `<link rel="canonical" href="https://www.jeeneetard.com${pathname}" />`,
    );
    expect(html).not.toContain('class="boot"');
  });

  it("marks a browse search noindex before JavaScript runs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/browse?q=kinematics"),
    );
    const html = await response.text();

    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/browse" />',
    );
  });

  it("includes homepage schemas in the served response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request("https://www.jeeneetard.com/"));
    const html = await response.text();

    expect(html).toContain('data-schema-key="WebSite"');
    expect(html).toContain('data-schema-key="Organization"');
  });

  it("keeps deep Explore routes head-only until their taxonomy is validated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee/class-11/physics"),
    );
    const html = await response.text();

    expect(html).toContain("<title>Explore JEE Class 11 Physics courses | JEENEETARD</title>");
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/explore/jee/class-11/physics" />',
    );
    expect(html).toContain('class="boot"');
    expect(html).not.toContain("<h1>");
  });

  it("returns an honest HTTP 404 for an unknown SPA route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/definitely-not-real"),
    );
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });

  it("returns HTTP 404 only after a course lookup confirms it is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) =>
      String(input).includes("/rest/v1/playlists")
        ? Response.json([])
        : new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/course/999999999"),
    );

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("<h1>Course not found</h1>");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain("<title>Course not found | JEENEETARD</title>");
  });

  it("returns HTTP 404 when a chapter is not part of an existing course", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/playlists")) {
        return Response.json([{ title: "Kinematics", lessons: [] }]);
      }
      if (url.includes("/rest/v1/playlist_videos")) return Response.json([]);
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/course/13/chapter/999999999"),
    );

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain(
      "<h1>Chapter not found in this course</h1>",
    );
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });

  it("returns HTTP 404 only after a faculty lookup confirms it is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) =>
      String(input).includes("/rest/v1/rpc/get_faculty_profile")
        ? Response.json(null)
        : new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/faculty/not-a-real-faculty"),
    );

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("<h1>Faculty page not found</h1>");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain("<title>Faculty page not found | JEENEETARD</title>");
  });
});
