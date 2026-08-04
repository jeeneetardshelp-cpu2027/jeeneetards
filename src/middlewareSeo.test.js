import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware, {
  config,
  isSupportedAppPath,
  parseExplorePath,
} from "../middleware.js";

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
    "/course/13/chapter/8", "/terms", "/privacy", "/search", "/tests",
    "/tests/jee-main", "/tests/neet", "/tests/class-12",
  ])("recognises supported application path %s", (pathname) => {
    expect(isSupportedAppPath(pathname)).toBe(true);
  });

  it.each([
    "/not-real", "/course/nope", "/course/13/extra", "/faculty/a/b",
    "/explore/a/b/c/d/e/f", "/explore/jee/class-11/physics/kinematics/extra",
    "/chapter/nope",
    // An invented exam must 404 rather than render an empty exam page —
    // otherwise every typo becomes an indexable soft-404.
    "/tests/not-an-exam", "/tests/jee", "/tests/neet/extra",
  ])("rejects unsupported application path %s", (pathname) => {
    expect(isSupportedAppPath(pathname)).toBe(false);
  });

  it("parses School board paths without shifting class, subject or chapter", () => {
    expect(parseExplorePath(
      "/explore/school/cbse/class-10/science/motion",
    )).toEqual({
      goal: "school",
      isSchool: true,
      board: "cbse",
      cls: "class-10",
      subject: "science",
      chapter: "motion",
    });
    expect(parseExplorePath(
      "/explore/jee/class-11/physics/kinematics",
    )).toEqual({
      goal: "jee",
      isSchool: false,
      board: null,
      cls: "class-11",
      subject: "physics",
      chapter: "kinematics",
    });
  });

  // The matcher now inspects EVERY application path, so a route that React
  // knows about but this middleware does not is served a hard 404 and never
  // reaches React at all. That is invisible in component tests — the route
  // renders fine in jsdom — and it already shipped once, when /tests was
  // added to App.jsx but not to STATIC_APP_ROUTES. Read the real router so
  // adding a route without teaching the edge about it fails here instead.
  it("supports every static route the router declares", () => {
    const app = readFileSync(resolve(import.meta.dirname, "./App.jsx"), "utf8");
    const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes(":") && p !== "*");

    expect(declared.length).toBeGreaterThan(5); // the parse actually worked
    for (const pathname of declared) {
      expect(isSupportedAppPath(pathname), `${pathname} 404s at the edge`).toBe(
        true,
      );
    }
  });

  it.each([
    ["/", "Find the right lecture. Skip the noise."],
    ["/browse", "All courses"],
    ["/explore", "What are you preparing for?"],
    ["/tests", "Mock tests"],
    ["/terms", "Terms of Service &amp; Disclaimer"],
    ["/privacy", "Privacy Policy"],
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
    if (pathname === "/explore") {
      expect(html).toContain('href="/explore/jee"');
      expect(html).toContain('href="/explore/neet"');
    }
  });

  it("serves canonical Browse as a linked course and faculty directory", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/playlists?")) {
        return Response.json([
          { id: 5, title: "Kinematics" },
          { id: 8, title: "Newton's Laws of Motion" },
        ]);
      }
      if (url.includes("/rest/v1/rpc/get_faculty_facets")) {
        return Response.json([
          { slug: "amit-bijarnia", display_name: "Amit Bijarnia", course_count: 4 },
          { slug: "mohit-tyagi", display_name: "Mohit Tyagi", course_count: 3 },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/browse"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h2>Course directory</h2>");
    expect(html).toContain('<a href="/course/5">Kinematics</a>');
    expect(html).toContain("<a href=\"/course/8\">Newton's Laws of Motion</a>");
    expect(html).toContain("<h2>Faculty directory</h2>");
    expect(html).toContain('<a href="/faculty/amit-bijarnia">Amit Bijarnia</a>');
    expect(html).toContain('<a href="/faculty/mohit-tyagi">Mohit Tyagi</a>');
    expect(html).toContain('<a href="/tests">Mock tests</a>');
    expect(html).toContain('<a href="/terms">Terms</a>');
    expect(html).toContain('<a href="/privacy">Privacy</a>');
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).toContain(
      '"url":"https://www.jeeneetard.com/course/5"',
    );
    expect(html).toContain(
      '"url":"https://www.jeeneetard.com/course/8"',
    );
  });

  it("keeps Browse available when the directory lookup is unconfirmed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/playlists?")) {
        return new Response("temporarily unavailable", { status: 503 });
      }
      if (url.includes("/rest/v1/rpc/get_faculty_facets")) {
        return Response.json([]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/browse"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h1>All courses</h1>");
    expect(html).not.toContain("<h2>Course directory</h2>");
    expect(html).not.toContain('data-schema-key="ItemList"');
  });

  it("marks a browse search noindex before JavaScript runs", async () => {
    const fetchSpy = vi.fn(async () => new Response(shell, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(
      new Request("https://www.jeeneetard.com/browse?q=kinematics"),
    );
    const html = await response.text();

    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/browse" />',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://www.jeeneetard.com/index.html",
    );
  });

  it("marks structured Browse filters noindex before JavaScript runs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=kinematics",
    ));
    const html = await response.text();

    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/browse" />',
    );
  });

  it.each([
    ["/chapter/79", "https://www.jeeneetard.com/browse?ch=79"],
    ["/chapter/79/?source=old", "https://www.jeeneetard.com/browse?ch=79"],
    ["/chapter/0", "https://www.jeeneetard.com/browse"],
  ])("redirects legacy chapter URL %s at the edge", async (path, target) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(
      new Request(`https://www.jeeneetard.com${path}`),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(target);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["/browse/", "https://www.jeeneetard.com/browse"],
    ["/terms///?source=old", "https://www.jeeneetard.com/terms?source=old"],
    ["/course/13/", "https://www.jeeneetard.com/course/13"],
    ["/explore/jee/", "https://www.jeeneetard.com/explore/jee"],
  ])("redirects duplicate trailing-slash URL %s to its canonical path", async (path, target) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(
      new Request(`https://www.jeeneetard.com${path}`),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(target);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes homepage schemas in the served response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request("https://www.jeeneetard.com/"));
    const html = await response.text();

    expect(html).toContain('data-schema-key="WebSite"');
    expect(html).toContain('data-schema-key="Organization"');
  });

  it("serves validated deep Explore navigation as HTML and structured data", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        if (args.p_goal == null) {
          return Response.json([{ entity_id: 1, slug: "jee", name: "JEE", course_count: 80 }]);
        }
        if (args.p_subject == null) {
          return Response.json([{ entity_id: 2, slug: "physics", name: "Physics", course_count: 30 }]);
        }
        return Response.json([
          { entity_id: 3, slug: "kinematics", name: "Kinematics", course_count: 4 },
          { entity_id: 4, slug: "laws-of-motion", name: "Laws of Motion", course_count: 2 },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee/class-11/physics"),
    );
    const html = await response.text();

    expect(html).toContain("<title>Explore JEE Class 11 Physics courses | JEENEETARD</title>");
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/explore/jee/class-11/physics" />',
    );
    expect(html).toContain("<h1>Choose a chapter for JEE Class 11 Physics</h1>");
    expect(html).toContain(
      'href="/browse?goal=jee&amp;class=11&amp;subject=physics&amp;chapter=kinematics"',
    );
    expect(html).toContain(
      '"url":"https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=kinematics"',
    );
    expect(html).toContain('data-schema-key="BreadcrumbList"');
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).not.toContain('class="boot"');
  });

  it("redirects an invalid Explore class to the nearest valid step", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        if (args.p_goal == null) {
          return Response.json([{ entity_id: 1, slug: "jee", name: "JEE", course_count: 80 }]);
        }
        return Response.json([]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee/11/physics"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.jeeneetard.com/explore/jee",
    );
  });

  it("does not link empty class branches from an Explore goal page", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        return Response.json(args.p_class === "class-11"
          ? [{ entity_id: 2, slug: "physics", name: "Physics", course_count: 30 }]
          : []);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('href="/explore/jee/class-11"');
    expect(html).not.toContain('href="/explore/jee/class-12"');
    expect(html).not.toContain('href="/explore/jee/dropper"');
  });

  it("redirects an empty valid Explore class to its populated parent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/boards")) {
        return Response.json([
          { id: 1, slug: "cbse", name: "CBSE", playlist_boards: [{ count: 2 }] },
        ]);
      }
      if (url.includes("/rest/v1/rpc/get_browse_curriculum")) {
        return Response.json([]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/school/cbse/class-11"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.jeeneetard.com/explore/school/cbse",
    );
  });

  it("does not link zero-course boards from the School Explore page", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/boards")) {
        return Response.json([
          { id: 1, slug: "cbse", name: "CBSE", playlist_boards: [{ count: 2 }] },
          { id: 2, slug: "icse", name: "ICSE", playlist_boards: [{ count: 0 }] },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/school"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('href="/explore/school/cbse"');
    expect(html).not.toContain('href="/explore/school/icse"');
  });

  it("redirects a direct zero-course board URL to School Explore", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/boards")) {
        return Response.json([
          { id: 2, slug: "icse", name: "ICSE", playlist_boards: [{ count: 0 }] },
        ]);
      }
      if (url.includes("/rest/v1/rpc/get_browse_curriculum")) {
        return Response.json([
          { entity_id: 2, slug: "mathematics", name: "Mathematics", course_count: 2 },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/school/icse"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.jeeneetard.com/explore/school",
    );
  });

  it("redirects a subject with no navigable chapters to its class page", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        return Response.json(args.p_subject == null
          ? [{ entity_id: 2, slug: "physics", name: "Physics", course_count: 1 }]
          : []);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee/class-11/physics"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.jeeneetard.com/explore/jee/class-11",
    );
  });

  it("redirects a validated final Explore chapter to canonical browse results", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        if (args.p_goal == null) {
          return Response.json([{ entity_id: 1, slug: "jee", name: "JEE", course_count: 80 }]);
        }
        if (args.p_subject == null) {
          return Response.json([{ entity_id: 2, slug: "physics", name: "Physics", course_count: 30 }]);
        }
        return Response.json([{ entity_id: 3, slug: "kinematics", name: "Kinematics", course_count: 4 }]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore/jee/class-11/physics/kinematics"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=kinematics",
    );
  });

  it.each([
    [
      "/explore/jee/class-11/chemistry",
      "https://www.jeeneetard.com/explore/jee/class-11",
    ],
    [
      "/explore/jee/class-11/physics/not-a-chapter",
      "https://www.jeeneetard.com/explore/jee/class-11/physics",
    ],
  ])("redirects an unknown Explore selection %s to its real parent", async (path, target) => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        const args = JSON.parse(init.body);
        return args.p_subject == null
          ? Response.json([{ entity_id: 2, slug: "physics", name: "Physics", course_count: 30 }])
          : Response.json([{ entity_id: 3, slug: "kinematics", name: "Kinematics", course_count: 4 }]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request(`https://www.jeeneetard.com${path}`),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(target);
  });

  it("serves faculty facts, course links and Person schema before JavaScript", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes("/rest/v1/rpc/get_faculty_profile")) {
        return Response.json({
          id: 1,
          display_name: "Amit Bijarnia",
          slug: "amit-bijarnia",
          verified: true,
          bio: "Physics educator.",
          photo_url: "https://example.com/amit.jpg",
          aliases: [
            { alias: "ABJ Sir", status: "verified" },
            { alias: "A. Bijarnia", status: "proposed" },
          ],
          institutes: ["Competishun"],
          course_count: 1,
          courses: [{ playlist_id: 5, title: "Kinematics", subject: "Physics", role: "instructor" }],
        });
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/faculty/amit-bijarnia"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Amit Bijarnia</h1>");
    expect(html).toContain("Also known as ABJ Sir");
    expect(html).not.toContain("A. Bijarnia");
    expect(html).toContain('href="/course/5"');
    expect(html).toContain('data-schema-key="Person"');
    expect(html).toContain('data-schema-key="BreadcrumbList"');
    expect(html).not.toContain('class="boot"');
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

  it("starts independent course and chapter lookups together", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    let resolveCourse;
    let chapterStarted = false;
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/playlists?")) {
        return new Promise((resolve) => {
          resolveCourse = resolve;
        });
      }
      if (url.includes("/rest/v1/playlist_videos")) {
        chapterStarted = true;
        return Response.json([{ playlist_id: 13, videos: { chapter_id: 8 } }]);
      }
      return new Response(shell, { status: 200 });
    }));

    const pending = middleware(
      new Request("https://www.jeeneetard.com/course/13/chapter/8"),
    );
    await Promise.resolve();
    await Promise.resolve();
    const chapterStartedBeforeCourseResolved = chapterStarted;

    resolveCourse(Response.json([{ title: "Kinematics", lessons: [] }]));
    const response = await pending;

    expect(response.status).toBe(200);
    expect(chapterStartedBeforeCourseResolved).toBe(true);
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
