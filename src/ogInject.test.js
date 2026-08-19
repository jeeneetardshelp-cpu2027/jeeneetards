// ogInject.test.js — offline unit tests for the edge <head> injector.
//
// testCourseMeta.js exercises the same logic against the live DB and a real
// build; these tests lock the contract in CI with no network and no dist/:
// they run injectCourseMeta against the REAL index.html source, so a shell
// edit that breaks the injector fails here first.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  courseMeta,
  escapeHtml,
  injectCourseMeta,
  courseSchemas,
  injectStructuredData,
  renderCourseBody,
  renderNotFoundBody,
  injectRootContent,
  injectRouteMeta,
  landingSchemas,
  renderLandingBody,
} from "../ogInject.js";
import { metadataForLocation } from "./pageMetadata.js";

const shell = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");

const course = {
  title: "Rectilinear Motion (Kinematics)",
  teacher: "ABJ Sir",
  subjects: { name: "Physics" },
  playlist_videos: [{ count: 10 }],
};

describe("courseMeta", () => {
  it("builds title, description and the canonical course URL", () => {
    const meta = courseMeta(course, 5);
    expect(meta.title).toBe("Rectilinear Motion (Kinematics) by ABJ Sir | JEENEETARD");
    expect(meta.description).toContain("Rectilinear Motion (Kinematics)");
    expect(meta.description).toContain("10 Physics lectures by ABJ Sir");
    expect(meta.description).toContain("ads or recommendations may appear");
    expect(meta.description).not.toContain("ad-free");
    expect(meta.url).toBe("https://www.jeeneetard.com/course/5");
  });
});

describe("injectCourseMeta", () => {
  const html = injectCourseMeta(shell, courseMeta(course, 5));

  it("swaps title, description and og/twitter tags", () => {
    expect(html).toContain("<title>Rectilinear Motion (Kinematics) by ABJ Sir | JEENEETARD</title>");
    expect(html).toContain('property="og:title" content="Rectilinear Motion (Kinematics) by ABJ Sir | JEENEETARD"');
    expect(html).toContain('property="og:url" content="https://www.jeeneetard.com/course/5"');
    expect(html).not.toContain("Free course finder");
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain('property="og:type" content="article"');
  });

  it("adds the course canonical exactly once", () => {
    expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain(
      '<link rel="canonical" href="https://www.jeeneetard.com/course/5" />',
    );
  });

  it("replaces (not duplicates) a canonical when an older shell still ships one", () => {
    const oldShell = shell.replace(
      "<title>",
      '<link rel="canonical" href="https://www.jeeneetard.com/" vite-ignore />\n    <title>',
    );
    const out = injectCourseMeta(oldShell, courseMeta(course, 5));
    expect(out.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(out).toContain('href="https://www.jeeneetard.com/course/5"');
    expect(out).not.toContain('href="https://www.jeeneetard.com/"');
  });

  it("escapes HTML in course titles", () => {
    const hostile = { ...course, title: 'A "<b>&' };
    const out = injectCourseMeta(shell, courseMeta(hostile, 7));
    expect(out).toContain(
      "<title>A &quot;&lt;b&gt;&amp; by ABJ Sir | JEENEETARD</title>",
    );
    expect(out).not.toContain("<b>&");
  });

  it("keeps $ sequences in titles literal (no replace-pattern expansion)", () => {
    // $' $& $1 are replacement patterns in String.replace — a string
    // replacement would expand them and splice page fragments into the tags.
    for (const title of ["Full Course worth $199", "Rock $' Roll", "Best $& $1 tricks"]) {
      const meta = courseMeta({ ...course, title }, 9);
      const out = injectCourseMeta(shell, meta);
      expect(out).toContain(`<title>${escapeHtml(meta.title)}</title>`);
      expect(out.match(/<link rel="canonical"/g)).toHaveLength(1);
      expect(out.match(/<\/html>/g)).toHaveLength(1);
    }
  });

  it("keeps the default branded social image", () => {
    expect(html).toContain(
      'property="og:image" content="https://www.jeeneetard.com/social-preview.png"',
    );
  });
});

describe("server-rendered discovery landings", () => {
  it("uses the same canonical route metadata as the hydrated app", () => {
    const browse = metadataForLocation("/browse", "?q=kinematics");
    expect(browse.title).toBe("Browse free courses | JEENEETARD");
    expect(browse.canonicalPath).toBe("/browse");
    expect(browse.robots).toBe("noindex, follow");
  });

  it("emits the homepage WebSite and Organization schemas", () => {
    expect(landingSchemas("/").map(({ key }) => key))
      .toEqual(["WebSite", "Organization"]);
    expect(landingSchemas("/browse")).toEqual([]);
  });

  it.each([
    ["/", "Find the right lecture. Skip the noise.", "/explore"],
    ["/browse", "All courses", "/explore"],
    ["/explore", "What are you preparing for?", "/browse"],
    ["/terms", "Terms of Service &amp; Disclaimer", "/privacy"],
    ["/privacy", "Privacy Policy", "/terms"],
  ])("renders a truthful %s fallback", (pathname, heading, destination) => {
    const meta = metadataForLocation(pathname);
    const body = renderLandingBody(pathname, meta);
    const html = injectRootContent(
      injectStructuredData(injectRouteMeta(shell, meta), landingSchemas(pathname)),
      body,
    );

    expect(body).toContain(`<h1>${heading}</h1>`);
    expect(body).toContain(`href="${destination}"`);
    expect(html).not.toContain('class="boot"');
    expect(html).toContain(
      `<link rel="canonical" href="https://www.jeeneetard.com${meta.canonicalPath}" />`,
    );
  });

  it("declines unknown and deep routes instead of inventing fallback content", () => {
    expect(renderLandingBody("/explore/jee", metadataForLocation("/explore/jee")))
      .toBe("");
  });
});

// --- server-rendered content + JSON-LD (for non-JS AI crawlers) ------------

describe("courseSchemas", () => {
  const meta = courseMeta(course, 5);

  it("emits Course and BreadcrumbList keyed by @type", () => {
    const keys = courseSchemas(course, meta).map((s) => s.key);
    expect(keys).toEqual(["Course", "BreadcrumbList"]);
  });

  it("carries the facts an AI answer would cite", () => {
    const { schema } = courseSchemas(course, meta).find((s) => s.key === "Course");
    expect(schema["@type"]).toBe("Course");
    expect(schema.name).toBe(course.title);
    expect(schema.url).toBe("https://www.jeeneetard.com/course/5");
    expect(schema.hasCourseInstance.instructor.name).toBe("ABJ Sir");
  });
});

describe("injectStructuredData", () => {
  const html = injectStructuredData(shell, courseSchemas(course, courseMeta(course, 5)));

  it("adds one ld+json script per schema, inside <head>", () => {
    expect((html.match(/application\/ld\+json/g) || []).length).toBe(2);
    expect(html.indexOf("application/ld+json")).toBeLessThan(html.indexOf("</head>"));
  });

  it("uses the same data-schema-key the client upserts on, so it never duplicates", () => {
    expect(html).toContain('data-schema-key="Course"');
    expect(html).toContain('data-schema-key="BreadcrumbList"');
  });

  it("escapes < so a title cannot break out of the script tag", () => {
    const evil = { ...course, title: "</script><img src=x onerror=alert(1)>" };
    const out = injectStructuredData(shell, courseSchemas(evil, courseMeta(evil, 5)));
    expect(out).not.toContain("</script><img");
    expect(out).toContain("\u003c");
  });

  it("is a no-op when there are no schemas", () => {
    expect(injectStructuredData(shell, [])).toBe(shell);
  });
});

describe("renderCourseBody + injectRootContent", () => {
  const meta = courseMeta(course, 5);
  const body = renderCourseBody(course, meta, ["Lesson one", "Lesson two"]);

  it("renders the course as real, readable HTML", () => {
    expect(body).toContain("<h1>Rectilinear Motion (Kinematics)</h1>");
    expect(body).toContain("<li>Lesson one</li>");
    expect(body).toContain("Physics");
    expect(body).toContain("ABJ Sir");
    expect(body).toContain("<dt>Lessons</dt><dd>10</dd>");
  });

  it("reports the true course total when the lesson-title preview is capped", () => {
    const preview = Array.from({ length: 60 }, (_, index) => `Lesson ${index + 1}`);
    const out = renderCourseBody(
      { ...course, playlist_videos: [{ count: 75 }] },
      meta,
      preview,
    );

    expect(out).toContain("<dt>Lessons</dt><dd>75</dd>");
    expect((out.match(/<li>/g) || []).length).toBe(60);
  });

  it("escapes lesson titles and course titles", () => {
    const out = renderCourseBody({ ...course, title: "<img src=x>" }, meta, ["<b>hi</b>"]);
    expect(out).not.toContain("<img src=x>");
    expect(out).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("replaces the boot skeleton inside #root (nested divs and all)", () => {
    const out = injectRootContent(shell, body);
    expect(out).not.toContain('class="boot"');
    expect(out).toContain("<h1>Rectilinear Motion (Kinematics)</h1>");
    // the shell's own closing tags survive
    expect(out).toContain("</body>");
    expect(out.match(/<div id="root"/g).length).toBe(1);
  });

  it("leaves the html untouched when #root is absent or content is empty", () => {
    expect(injectRootContent("<html><body></body></html>", body))
      .toBe("<html><body></body></html>");
    expect(injectRootContent(shell, "")).toBe(shell);
  });
});

describe("renderNotFoundBody", () => {
  it("renders recovery links and escapes the requested path", () => {
    const body = renderNotFoundBody('/bad/<script>', "Course not found");
    expect(body).toContain("<h1>Course not found</h1>");
    expect(body).toContain('href="/explore"');
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });
});

describe("injectRouteMeta (non-course routes)", () => {
  const forPath = (p, s = "") => injectRouteMeta(shell, metadataForLocation(p, s));
  const titleOf = (h) => h.match(/<title>([^<]*)</)?.[1];
  const canonOf = (h) => h.match(/rel="canonical" href="([^"]*)"/)?.[1];
  const robotsOf = (h) => h.match(/name="robots" content="([^"]*)"/)?.[1];

  it("gives /browse its own title and canonical instead of the homepage's", () => {
    const html = forPath("/browse");
    expect(titleOf(html)).toBe("Browse free courses | JEENEETARD");
    expect(canonOf(html)).toBe("https://www.jeeneetard.com/browse");
    expect(titleOf(html)).not.toBe("JEENEETARD - Free course finder");
  });

  it("marks a search view noindex so query URLs are not crawl targets", () => {
    expect(robotsOf(forPath("/browse", "?q=motion"))).toBe("noindex, follow");
    expect(robotsOf(forPath("/browse"))).toBe("index, follow");
  });

  it("builds a descriptive title for a deep explore path", () => {
    const html = forPath("/explore/school/cbse/class-10/science");
    expect(titleOf(html)).toContain("Science");
    expect(canonOf(html)).toBe("https://www.jeeneetard.com/explore/school/cbse/class-10/science");
  });

  it("writes exactly one canonical", () => {
    expect((forPath("/explore/jee").match(/rel="canonical"/g) || []).length).toBe(1);
  });

  it("escapes HTML in generated titles", () => {
    const html = injectRouteMeta(shell, {
      title: '<img src=x> | JEENEETARD', description: "d", canonicalPath: "/browse", robots: "index, follow",
    });
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
  });

  it("is a no-op without metadata", () => {
    expect(injectRouteMeta(shell, null)).toBe(shell);
  });
});
