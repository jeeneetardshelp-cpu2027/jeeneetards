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
  injectRootContent,
} from "../ogInject.js";

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
    expect(meta.title).toBe("Rectilinear Motion (Kinematics) | JEENEETARD");
    expect(meta.description).toContain("10 lectures");
    expect(meta.description).toContain("No JEENEETARD advertisements or sponsored rankings");
    expect(meta.description).toContain("YouTube may show ads or same-channel recommendations");
    expect(meta.description).not.toContain("ad-free");
    expect(meta.url).toBe("https://www.jeeneetard.com/course/5");
  });
});

describe("injectCourseMeta", () => {
  const html = injectCourseMeta(shell, courseMeta(course, 5));

  it("swaps title, description and og/twitter tags", () => {
    expect(html).toContain("<title>Rectilinear Motion (Kinematics) | JEENEETARD</title>");
    expect(html).toContain('property="og:title" content="Rectilinear Motion (Kinematics) | JEENEETARD"');
    expect(html).toContain('property="og:url" content="https://www.jeeneetard.com/course/5"');
    expect(html).not.toContain("Free course finder");
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
    expect(out).toContain("<title>A &quot;&lt;b&gt;&amp; | JEENEETARD</title>");
    expect(out).not.toContain("<b>&");
  });

  it("keeps $ sequences in titles literal (no replace-pattern expansion)", () => {
    // $' $& $1 are replacement patterns in String.replace — a string
    // replacement would expand them and splice page fragments into the tags.
    for (const title of ["Full Course worth $199", "Rock $' Roll", "Best $& $1 tricks"]) {
      const out = injectCourseMeta(shell, courseMeta({ ...course, title }, 9));
      expect(out).toContain(`<title>${escapeHtml(title)} | JEENEETARD</title>`);
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
