import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware, { config } from "../middleware.js";

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("edge-rendered discovery landings", () => {
  it("matches only stable public landing routes plus course pages", () => {
    expect(config.matcher).toEqual([
      "/course/:id*",
      "/",
      "/browse",
      "/explore/:path*",
    ]);
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
});
