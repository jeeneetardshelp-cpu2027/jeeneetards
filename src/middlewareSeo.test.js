import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware, {
  config,
  fetchAppShell,
  isSupportedAppPath,
  parseExplorePath,
} from "../middleware.js";

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("protected preview shell fetching", () => {
  it("forwards only same-origin preview authentication to the app shell", async () => {
    const fetchSpy = vi.fn(async () => new Response(shell, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const request = new Request("https://preview.example/faculty/amit-bijarnia", {
      headers: {
        cookie: "_vercel_jwt=preview-cookie",
        "x-vercel-protection-bypass": "preview-bypass",
        authorization: "Bearer must-not-forward",
      },
    });

    expect(await fetchAppShell(request)).toBe(shell);
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://preview.example/index.html");
    const forwarded = new Headers(fetchSpy.mock.calls[0][1].headers);
    expect(forwarded.get("cookie")).toBe("_vercel_jwt=preview-cookie");
    expect(forwarded.get("x-vercel-protection-bypass")).toBe("preview-bypass");
    expect(forwarded.has("authorization")).toBe(false);
  });

  it("rejects a successful Vercel login response that is not the app shell", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      '<!doctype html><html><body><a href="#geist-skip-nav">Skip to content</a>' +
        "<h1>Log in to Vercel</h1></body></html>",
      { status: 200 },
    )));

    expect(await fetchAppShell(new Request("https://preview.example/faculty/amit-bijarnia")))
      .toBeNull();
  });
});

describe("edge-rendered discovery landings", () => {
  it("matches application paths while excluding built and public assets", () => {
    expect(config.matcher).toHaveLength(1);
    expect(config.matcher[0]).toContain("api/");
    expect(config.matcher[0]).toContain("assets/");
    expect(config.matcher[0]).toContain("study-materials/");
    expect(config.matcher[0]).toContain("robots\\.txt");
  });

  // Serverless functions are not app pages. Before this guard, /api/* fell
  // through to the isSupportedAppPath 404 and every function — including the
  // admin's /api/youtube proxy — was served an HTML 404 before Vercel could
  // route it (verified against production). The body guard must pass the
  // request through untouched: no shell fetch, no redirect, no lookup.
  it.each(["/api/youtube", "/api/og?course=13", "/api/anything/nested"])(
    "passes %s through to the serverless function untouched",
    async (path) => {
      const fetchSpy = vi.fn(async () => new Response(shell, { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);

      const response = await middleware(
        new Request(`https://www.jeeneetard.com${path}`),
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/", "/browse", "/explore/jee/class-11/physics",
    "/faculty", "/faculty/amit-bijarnia", "/chapter/79", "/course/13",
    "/course/13/chapter/8", "/methodology", "/terms", "/privacy", "/search", "/tests",
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

  it("supports the router's numeric forum thread route at the edge", () => {
    const app = readFileSync(resolve(import.meta.dirname, "./App.jsx"), "utf8");
    expect(app).toContain('<Route path="/forum/post/:postId"');
    expect(isSupportedAppPath("/forum/post/42")).toBe(true);
    expect(isSupportedAppPath("/forum/post/not-a-number")).toBe(false);
    expect(isSupportedAppPath("/forum/post/42/extra")).toBe(false);
  });

  it("returns a hard 404 when a forum post is confirmed absent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://forum.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/rpc/forum_mode")) return Response.json("read_only");
      if (url.endsWith("/rpc/get_forum_post")) return Response.json([]);
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(new Request("https://www.jeeneetard.com/forum/post/404"));
    const html = await response.text();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain("Forum post not found");
  });

  it("serves the shell when a forum post exists", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://forum.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/rpc/forum_mode")) return Response.json("read_only");
      if (url.endsWith("/rpc/get_forum_post")) return Response.json([{ id: 42 }]);
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(new Request("https://www.jeeneetard.com/forum/post/42"));
    expect(response.status).toBe(200);
  });

  // The slug is a lossy encoding of the question: lowercased, punctuation
  // stripped, and cut to a 60-character stem. Building the share card from it
  // shipped "…how JEE or NEET is run w" to WhatsApp. The edge already holds the
  // real row, so these pin the card to the question, not the URL.
  it("builds a poll's share card from the question, not the slug", async () => {
    const question = "If you could change one thing about how JEE or NEET is run, what would it be?";
    vi.stubEnv("VITE_SUPABASE_URL", "https://polls.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/rpc/poll_mode")) return Response.json("open");
      if (url.endsWith("/rpc/get_poll")) return Response.json([{ id: 5, question }]);
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/polls/if-you-could-change-one-thing-about-how-jee-or-neet-is-run-w-5",
    ));
    const html = await response.text();
    expect(response.status).toBe(200);
    // The whole question, punctuation intact — and no truncated slug tail.
    expect(html).toContain(`<meta property="og:title" content="${question} | JEENEETARD polls"`);
    expect(html).not.toContain("is run w |");
    expect(html).toContain(`content="Vote and see how other JEE and NEET students answered: ${question}"`);
    expect(html).toContain('<meta property="og:type" content="article"');
  });

  it("falls back to the slug-derived card when the poll row has no question", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://polls.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/rpc/poll_mode")) return Response.json("open");
      if (url.endsWith("/rpc/get_poll")) return Response.json([{ id: 3 }]);
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/polls/how-many-hours-do-you-study-3",
    ));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<meta property="og:type" content="article"');
  });

  it("does not hard-404 forum posts while the forum is off", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://forum.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith("/rpc/forum_mode")) return Response.json("off");
      return new Response(shell, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(new Request("https://www.jeeneetard.com/forum/post/42"));
    expect(response.status).toBe(200);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/rpc/get_forum_post")))
      .toBe(false);
  });

  it.each([
    ["/", "Find the right lecture. Skip the noise."],
    ["/browse", "All courses"],
    ["/explore", "What are you preparing for?"],
    ["/faculty", "Find courses by faculty"],
    ["/materials", "Find study material by your syllabus."],
    ["/materials/jee-main/previous-year-papers", "JEE Main papers, answer keys and solutions"],
    ["/materials/jee-advanced/previous-year-papers", "JEE Advanced question papers, 2007 to 2026"],
    ["/materials/neet/previous-year-papers", "NEET question papers: 2024, 2025 and the 2026 re-exam"],
    ["/tests", "Mock tests"],
    ["/methodology", "How JEENEETARD curates courses"],
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
    if (pathname === "/methodology") {
      expect(html).toContain("What verified means");
      expect(html).toContain("does not currently sell placement");
      expect(html).toContain('href="mailto:jeeneetardshelp@gmail.com"');
    }
    if (pathname === "/materials") {
      expect(html).toContain("Formula sheets, full lecture notes");
      // Zero short-notes rows exist (0 of 408 on 2026-09-01). The page must
      // not promise them anywhere a crawler reads — this covers the edge body
      // AND the <meta name="description"> in one assertion, so the two copy
      // sites cannot drift back independently.
      expect(html.toLowerCase()).not.toContain("short notes");
      expect(html).toContain('href="/explore"');
      expect(html).toContain('href="/tests"');
      expect(html).toContain('href="/methodology"');
    }
  });

  it.each([
    ["/materials", ["BreadcrumbList"]],
    ["/materials/jee-main/previous-year-papers", ["BreadcrumbList"]],
    ["/tests", ["BreadcrumbList", "ItemList"]],
    ["/tests/neet", ["BreadcrumbList"]],
  ])("server-renders discovery-page schemas for %s", async (pathname, keys) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request(`https://www.jeeneetard.com${pathname}`),
    );
    const html = await response.text();

    for (const key of keys) {
      expect(html).toContain(`data-schema-key="${key}"`);
    }
  });

  it("serves approved study-material links and ItemList data before JavaScript", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/get_study_materials")) {
        return Response.json([{
          id: 7,
          title: "Rectilinear motion formula sheet",
          description: "A concise revision sheet for motion in one dimension.",
          source_name: "Reviewed physics resource",
          source_url: "https://example.edu/rectilinear-motion.pdf",
        }]);
      }
      return new Response(shell, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(
      new Request("https://www.jeeneetard.com/materials"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h2>Reviewed resources</h2>");
    expect(html).toContain(
      '<a href="https://example.edu/rectilinear-motion.pdf" rel="noopener">' +
        "Rectilinear motion formula sheet</a>",
    );
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).toContain(
      '"url":"https://example.edu/rectilinear-motion.pdf"',
    );
    const rpcCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/rpc/get_study_materials"));
    expect(JSON.parse(rpcCall[1].body)).toMatchObject({ p_limit: 60, p_offset: 0 });
  });

  it("keeps the materials landing available when its directory lookup is unconfirmed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) =>
      String(input).includes("/rest/v1/rpc/get_study_materials")
        ? new Response("temporarily unavailable", { status: 503 })
        : new Response(shell, { status: 200 })));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/materials"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Find study material by your syllabus.</h1>");
    expect(html).not.toContain("<h2>Reviewed resources</h2>");
    expect(html).not.toContain('data-schema-key="ItemList"');
  });

  it("serves a self-canonical JEE Main paper directory before JavaScript", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/study_materials?")) {
        return Response.json([
          {
            id: 81,
            title: "JEE Main 2024 Session 1 - 27 January Shift 1",
            description: "Official NTA question paper.",
            source_name: "National Testing Agency (JEE Main)",
            source_url: "https://nta.example/paper.pdf",
            exam_year: 2024,
          },
          {
            id: 82,
            title: "JEE Main 2025 Session 1 Final Answer Key",
            description: "Official final answer key only; no worked solutions.",
            source_name: "National Testing Agency (JEE Main)",
            source_url: "https://nta.example/answer-key.pdf",
            exam_year: 2025,
          },
        ]);
      }
      return new Response(shell, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const pathname = "/materials/jee-main/previous-year-papers";
    const response = await middleware(new Request(`https://www.jeeneetard.com${pathname}`));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h1>JEE Main papers, answer keys and solutions</h1>");
    expect(html).toContain("<h2>JEE Main question papers</h2>");
    expect(html).toContain("<h2>JEE Main official answer keys</h2>");
    expect(html).toContain("<h2>JEE Main papers with solutions</h2>");
    expect(html).toContain("No reviewed papers with worked solutions are listed yet");
    expect(html).toContain('<a href="https://nta.example/paper.pdf" rel="noopener">');
    expect(html).toContain('<a href="https://nta.example/answer-key.pdf" rel="noopener">');
    expect(html).toContain(
      `<link rel="canonical" href="https://www.jeeneetard.com${pathname}" />`,
    );
    expect(html).toContain('data-schema-key="ItemList"');

    const dataCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/study_materials?"));
    const dataUrl = new URL(String(dataCall[0]));
    expect(dataUrl.searchParams.get("material_type")).toBe("eq.previous_year_paper");
    expect(dataUrl.searchParams.get("title")).toBe("ilike.JEE Main%");
    expect(dataUrl.searchParams.get("limit")).toBe("100");
    // The 2026-09-02 flip: the edge selects the paper-metadata columns so it
    // classifies papers the same database-first way the hydrated page does.
    const edgeSelect = dataUrl.searchParams.get("select").split(",");
    for (const column of ["paper_kind", "paper_year", "exam_session", "exam_shift"]) {
      expect(edgeSelect).toContain(column);
    }
  });

  // ------------------------------------------------------------------
  // Per-year paper pages: the child that can win "<exam> <year> question
  // paper", instead of one landing competing for every year at once.
  // ------------------------------------------------------------------
  const paperCatalogue = (rows) => vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/study_materials?")) {
      if (typeof rows === "function") return rows(new URL(url));
      return Response.json(rows);
    }
    return new Response(shell, { status: 200 });
  });

  it("serves one exam year as its own page, listing that year's papers", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = paperCatalogue([
      {
        id: 81,
        title: "JEE Main 2024 Session 1 - 27 January Shift 1",
        description: "Official NTA question paper.",
        source_name: "National Testing Agency (JEE Main)",
        source_url: "https://nta.example/2024-s1.pdf",
        exam_year: 2024,
      },
      {
        id: 82,
        title: "JEE Main 2024 Session 1 Final Answer Key",
        description: "Official final answer key only; no worked solutions.",
        source_name: "National Testing Agency (JEE Main)",
        source_url: "https://nta.example/2024-key.pdf",
        exam_year: 2024,
      },
    ]);
    vi.stubGlobal("fetch", fetchSpy);

    const pathname = "/materials/jee-main/previous-year-papers/2024";
    const response = await middleware(new Request(`https://www.jeeneetard.com${pathname}`));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(
      "<title>JEE Main 2024 question papers, session by session | JEENEETARD</title>",
    );
    expect(html).toContain(
      `<link rel="canonical" href="https://www.jeeneetard.com${pathname}" />`,
    );
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain("<h1>JEE Main 2024 papers, session by session</h1>");
    expect(html).toContain('<a href="https://nta.example/2024-s1.pdf" rel="noopener">');
    expect(html).toContain("<h2>JEE Main 2024 official answer keys</h2>");
    expect(html).toContain(
      '<a href="/materials/jee-main/previous-year-papers">All JEE Main papers by year</a>',
    );
    expect(html).toContain('data-schema-key="BreadcrumbList"');
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).not.toContain('class="boot"');

    const dataUrl = new URL(String(fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/study_materials?"))[0]));
    expect(dataUrl.searchParams.get("exam_year")).toBe("eq.2024");
    expect(dataUrl.searchParams.get("title")).toBe("ilike.JEE Main%");
  });

  // The new registry entries ride the same edge path: the NEET year page
  // queries with the NEET pattern and renders without any exam-specific code.
  it("serves a NEET exam year through the same registry-driven edge path", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = paperCatalogue([
      {
        id: 91,
        title: "NEET UG 2024 - Set T1 (English)",
        description: "Official NTA question paper.",
        source_name: "National Testing Agency (NEET)",
        source_url: "https://nta.example/neet-2024-t1.pdf",
        exam_year: 2024,
      },
    ]);
    vi.stubGlobal("fetch", fetchSpy);

    const pathname = "/materials/neet/previous-year-papers/2024";
    const response = await middleware(new Request(`https://www.jeeneetard.com${pathname}`));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<title>NEET 2024 question papers | JEENEETARD</title>");
    expect(html).toContain("<h1>NEET 2024 question papers</h1>");
    expect(html).toContain('<a href="https://nta.example/neet-2024-t1.pdf" rel="noopener">');
    expect(html).toContain(
      '<a href="/materials/neet/previous-year-papers">All NEET papers by year</a>',
    );

    const dataUrl = new URL(String(fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("/rest/v1/study_materials?"))[0]));
    expect(dataUrl.searchParams.get("exam_year")).toBe("eq.2024");
    expect(dataUrl.searchParams.get("title")).toBe("ilike.NEET%");
  });

  it("returns a real 404 for an exam year with no reviewed paper", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", paperCatalogue([]));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/1999",
    ));
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain("<h1>JEE Main 1999 papers not found</h1>");
  });

  it("keeps a paper year available when its lookup is unconfirmed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", paperCatalogue(() =>
      new Response("temporarily unavailable", { status: 503 })));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2024",
    ));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/materials/jee-main/previous-year-papers/20244",
    "/materials/jee-main/previous-year-papers/latest",
    // Unregistered exams: NSEP is deliberately absent (season titles), and
    // NEET PG was never reviewed at all.
    "/materials/nsep/previous-year-papers/2024",
    "/materials/neet-pg/previous-year-papers/2024",
  ])("404s the invented paper URL %s without a lookup", async (pathname) => {
    const fetchSpy = vi.fn(async () => new Response(shell, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(new Request(`https://www.jeeneetard.com${pathname}`));

    expect(response.status).toBe(404);
    expect(fetchSpy.mock.calls.some(([input]) =>
      String(input).includes("/rest/v1/"))).toBe(false);
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

  it("serves the canonical faculty landing as linked crawler-readable profiles", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/get_faculty_facets")) {
        return Response.json([
          {
            slug: "amit-bijarnia", display_name: "Amit Bijarnia",
            institutes: "Competishun", course_count: 4,
          },
          {
            slug: "mohit-tyagi", display_name: "Mohit Tyagi",
            institutes: "Competishun", course_count: 3,
          },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/faculty"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<h1>Find courses by faculty</h1>");
    expect(html).toContain('<a href="/faculty/amit-bijarnia">Amit Bijarnia</a>');
    expect(html).toContain("Competishun (4 linked courses)");
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/faculty" />',
    );
  });

  it("keeps filtered faculty-directory URLs out of the index", async () => {
    const fetchSpy = vi.fn(async () => new Response(shell, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/faculty?goal=jee&subject=physics",
    ));
    const html = await response.text();

    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/faculty" />',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

  // ONE indexable filtered shape: a chapter. Collapsing this one too meant all
  // 249 populated chapters shared a single canonical and a single title, so the
  // only screen this site has that YouTube does not could not be found in
  // search. The exception is exact, so the faceted space stays finite — which
  // is what the rule below still guards.
  it("gives the canonical chapter view its own identity before JavaScript runs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=kinematics",
    ));
    const html = await response.text();

    expect(html).toContain("<title>Kinematics — JEE Class 11 Physics | JEENEETARD</title>");
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/browse'
      + "?goal=jee&amp;class=11&amp;subject=physics&amp;chapter=kinematics\" />",
    );
  });

  // Dropper is the union of Class 11 and Class 12, so its chapter page is a
  // twin of a class page — 171 of 177 were identical in production. The page
  // keeps its title, its canonical and (below) its body; it only asks not to
  // be indexed, so the class page is the one address per chapter.
  it("keeps a Dropper chapter view out of the index but otherwise intact", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=dropper&subject=physics&chapter=kinematics",
    ));
    const html = await response.text();

    expect(html).toContain("<title>Kinematics — JEE Dropper Physics | JEENEETARD</title>");
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/browse'
      + "?goal=jee&amp;class=dropper&amp;subject=physics&amp;chapter=kinematics\" />",
    );
  });

  // A chapter URL used to fall through to the generic landing body: an <h1> of
  // "All courses" and one templated sentence. 380 of these are in the sitemap,
  // so a crawler saw 380 near-identical pages under a heading that contradicted
  // their own <title>. These pin the real heading, the real count, and the
  // sibling links that connect them — and, just as importantly, pin that a
  // lookup which did not confirm renders NO count rather than a zero.
  const CURRICULUM = [
    { level: "chapter", entity_id: 37, slug: "kinematics", name: "Kinematics", course_count: 6 },
    { level: "chapter", entity_id: 38, slug: "laws-of-motion", name: "Laws of Motion", course_count: 4 },
    { level: "chapter", entity_id: 39, slug: "work-energy-power", name: "Work, Energy and Power", course_count: 1 },
  ];

  const stubCurriculum = (rows, capture) => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        if (capture) capture.args = JSON.parse(init.body);
        return rows === null
          ? new Response("nope", { status: 500 })
          : Response.json(rows);
      }
      return new Response(shell, { status: 200 });
    }));
  };

  const chapterUrl =
    "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=kinematics";

  it("gives a chapter landing its own heading instead of the generic one", async () => {
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(chapterUrl))).text();

    expect(html).toContain("<h1>Kinematics</h1>");
    expect(html).not.toContain("<h1>All courses</h1>");
  });

  it("states the real course count, goal-scoped, from the curriculum", async () => {
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(chapterUrl))).text();

    expect(html).toContain("6 courses on this site cover this chapter.");
  });

  it("agrees in number when a chapter has exactly one course", async () => {
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=work-energy-power",
    ))).text();

    expect(html).toContain("1 course on this site covers this chapter.");
  });

  // The house rule this whole change has to obey: never render a plausible-
  // looking zero. A chapter the curriculum knows but that carries no courses
  // gets its honest heading and no count sentence at all.
  it("renders no count line at all when the chapter has no courses", async () => {
    stubCurriculum([
      ...CURRICULUM,
      { level: "chapter", entity_id: 40, slug: "empty-chapter", name: "Empty Chapter", course_count: 0 },
    ]);
    const html = await (await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=empty-chapter",
    ))).text();

    expect(html).toContain("<h1>Empty Chapter</h1>");
    expect(html).not.toContain("0 course");
    expect(html).not.toContain("cover this chapter");
    expect(html).not.toContain("covers this chapter");
  });
  it("links the sibling chapters with their counts, and never to itself", async () => {
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(chapterUrl))).text();

    expect(html).toContain(
      'href="/browse?goal=jee&amp;class=11&amp;subject=physics&amp;chapter=laws-of-motion"',
    );
    expect(html).toContain("(4 courses)");
    // The page must not list itself as somewhere else to go.
    expect(html).not.toContain(
      '<a href="/browse?goal=jee&amp;class=11&amp;subject=physics&amp;chapter=kinematics">',
    );
  });

  it("asks the curriculum for the stage id the RPC speaks, not the URL's short form", async () => {
    const capture = {};
    stubCurriculum(CURRICULUM, capture);
    await middleware(new Request(chapterUrl));

    expect(capture.args).toMatchObject({
      p_goal: "jee", p_class: "class-11", p_subject: "physics",
    });
  });

  it("passes dropper through unchanged, which is what the RPC expects", async () => {
    const capture = {};
    stubCurriculum(CURRICULUM, capture);
    await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=dropper&subject=physics&chapter=kinematics",
    ));

    expect(capture.args.p_class).toBe("dropper");
  });

  // The fail-safe half. An unconfirmed lookup must never become a confident
  // page: no heading it cannot support, and above all no invented count.
  it("falls back to the generic body when the curriculum lookup fails", async () => {
    stubCurriculum(null);
    const html = await (await middleware(new Request(chapterUrl))).text();

    expect(html).toContain("<h1>All courses</h1>");
    expect(html).not.toContain("cover this chapter");
    expect(html).not.toContain("0 courses");
    // The head is unaffected — the title and canonical never depended on it.
    expect(html).toContain("<title>Kinematics — JEE Class 11 Physics | JEENEETARD</title>");
  });

  it("falls back when the curriculum does not know this chapter slug", async () => {
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(
      "https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=not-a-chapter",
    ))).text();

    expect(html).toContain("<h1>All courses</h1>");
    expect(html).not.toContain("cover this chapter");
  });

  it("does not give an unbounded facet a chapter body", async () => {
    // ?page=2 alongside a chapter is a facet, not the canonical shape. It stays
    // noindex, and must not gain content that would make it worth indexing.
    stubCurriculum(CURRICULUM);
    const html = await (await middleware(new Request(
      `${chapterUrl}&page=2`,
    ))).text();

    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).not.toContain("<h1>Kinematics</h1>");
  });

  it.each([
    // One filter short of a chapter — nothing distinctive to index.
    "?goal=jee&class=11&subject=physics",
    // A chapter plus anything else is a facet, and facets are unbounded.
    "?goal=jee&class=11&subject=physics&chapter=kinematics&page=2",
    "?goal=jee&class=11&subject=physics&chapter=kinematics&sort=rating",
    "?goal=jee&class=11&subject=physics&chapter=kinematics&tab=lectures",
    // A personal search must never become a public URL.
    "?q=friction+problems",
  ])("keeps every other Browse filter shape out of the index (%s)", async (query) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(shell, { status: 200 })));

    const response = await middleware(new Request(
      `https://www.jeeneetard.com/browse${query}`,
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

  it("serves the populated root Explore choices as HTML and an ItemList", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes("/rest/v1/rpc/get_browse_curriculum")) {
        return Response.json([
          { entity_id: 1, slug: "jee", name: "JEE", course_count: 80 },
          { entity_id: 2, slug: "neet", name: "NEET", course_count: 40 },
          { entity_id: 3, slug: "olympiad", name: "Olympiad", course_count: 0 },
        ]);
      }
      return new Response(shell, { status: 200 });
    }));

    const response = await middleware(
      new Request("https://www.jeeneetard.com/explore"),
    );
    const html = await response.text();

    expect(html).toContain("<h1>What are you preparing for?</h1>");
    expect(html).toContain('<a href="/explore/jee">JEE</a> (80 courses)');
    expect(html).toContain('<a href="/explore/neet">NEET</a> (40 courses)');
    expect(html).not.toContain("/explore/olympiad");
    expect(html).toContain('data-schema-key="ItemList"');
    expect(html).toContain('"url":"https://www.jeeneetard.com/explore/jee"');
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
    expect(html).toContain('data-schema-key="LearningResource"');
    expect(html).toContain('"@type":"LearningResource"');
    expect(html).toContain('"educationalLevel":"Class 11"');
    expect(html).toContain('"citation":[{"@type":"CreativeWork"');
    expect(html).toContain("A practical order for JEE Class 11 Physics");
    expect(html).toContain('id="subject-guide"');
    expect(html).toContain("not as an official class-wise syllabus");
    expect(html).toContain("https://jeemain.nta.nic.in/document/syllabus-2026/");
    expect(html).toContain('href="/methodology"');
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
          bio: "Legacy database bio.",
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
    expect(html).toContain('<section id="source-backed-profile">');
    expect(html).toContain("listed by Competishun as a Physics faculty member");
    expect(html).toContain('href="https://competishun.com/" rel="noopener"');
    expect(html).toContain("Sources checked 2026-08-25.");
    expect(html).toContain('"description":"Amit Bijarnia (ABJ Sir)');
    expect(html).not.toContain("Legacy database bio.");
    expect(html).not.toContain('class="boot"');
  });

  it("fails through instead of returning a protected-preview login shell", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://catalog.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    const fetchSpy = vi.fn(async (input) => {
      if (String(input).includes("/rest/v1/rpc/get_faculty_profile")) {
        return Response.json({
          id: 1,
          display_name: "Amit Bijarnia",
          slug: "amit-bijarnia",
          verified: true,
          aliases: [],
          institutes: ["Competishun"],
          courses: [],
        });
      }
      return new Response(
        '<!doctype html><html><body><a href="#geist-skip-nav">Skip to content</a>' +
          "<h1>Log in to Vercel</h1></body></html>",
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(new Request(
      "https://preview.example/faculty/amit-bijarnia",
      { headers: { cookie: "_vercel_jwt=preview-cookie" } },
    ));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    const shellCall = fetchSpy.mock.calls.find(([input]) =>
      String(input) === "https://preview.example/index.html");
    expect(new Headers(shellCall[1].headers).get("cookie"))
      .toBe("_vercel_jwt=preview-cookie");
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
