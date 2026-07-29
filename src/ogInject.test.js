// ogInject.test.js — offline unit tests for the edge <head> injector.
//
// testCourseMeta.js exercises the same logic against the live DB and a real
// build; these tests lock the contract in CI with no network and no dist/:
// they run injectCourseMeta against the REAL index.html source, so a shell
// edit that breaks the injector fails here first.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { courseMeta, escapeHtml, injectCourseMeta } from "../ogInject.js";

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
