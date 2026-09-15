// courseSlugLinks.test.jsx — the links the site EMITS carry the slug.
//
// /course/:id/:slug shipped, and the edge 308s the bare id to it, so nothing
// was broken while every internal link still said /course/398 — it was just
// pointless: the keywords the slug exists for never appeared in a link, a share
// message or the crawlable directory, only in a redirect target. These
// assertions are the contract that the emitted link IS the canonical one.
//
// Two halves, and the second is the one that regresses quietly:
//
//   1. A course with a Latin title links to /course/:id/:slug.
//   2. A course with NO ASCII in its title (this catalogue has Devanagari ones)
//      links to the bare /course/:id — deliberately, because canonicalUrl.js
//      refuses to mint a URL from a transliteration guess. A "fix" that
//      percent-encodes Devanagari into the path would pass a naive slug test
//      and break the exact thing the slug is for.
//
// Every call site here goes through canonicalCoursePath so there is one
// definition of a course's address; these tests watch the call sites, and
// canonicalUrl.test.js watches the definition.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { TopRated } from "./HomeSections.jsx";
import { ThemeProvider } from "./theme.jsx";
import { useCourseMetadata } from "./PageMetadata.jsx";
import { browseDirectorySchemas, renderBrowseDirectoryBody, renderFacultyBody } from "../ogInject.js";

const LATIN = {
  id: 398,
  title: "Rectilinear Motion (Kinematics)",
  subject: "Physics",
  classLevels: ["Class 11"],
  teacher: "ABJ Sir",
  lectures: 12,
};
// No ASCII letters or digits at all — the case the id-only path exists for.
const DEVANAGARI = { id: 212, title: "कबीर की साखी", classLevels: [] };

describe("the homepage's top-rated cards", () => {
  const hrefs = (courses) => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <TopRated courses={courses} loading={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    return screen.getAllByRole("link", { name: "View course" })
      .map((link) => link.getAttribute("href"));
  };

  it("links a course by its canonical slugged address", () => {
    expect(hrefs([LATIN])).toEqual(["/course/398/rectilinear-motion-kinematics"]);
  });

  it("links a title with no ASCII by id alone, never a transliteration", () => {
    const [href] = hrefs([DEVANAGARI]);
    expect(href).toBe("/course/212");
    expect(href).not.toContain("%");
  });
});

// The crawler-readable /browse body the edge serves before React hydrates. It
// has the title of every row it lists, so linking the bare id here spent a
// redirect on every course in the directory for nothing.
describe("the edge's browse directory body", () => {
  const body = renderBrowseDirectoryBody(
    { description: "Every free course." },
    { courses: [LATIN, DEVANAGARI] },
  );

  it("links each course by its canonical slugged address", () => {
    expect(body).toContain('<a href="/course/398/rectilinear-motion-kinematics">');
  });

  it("keeps the id-only address for a title with no ASCII", () => {
    expect(body).toContain('<a href="/course/212">');
  });
});

// The two edge emitters that still spent a redirect on every course. Both were
// found live on 15 Sep 2026: /browse's ItemList listed all 490 courses by bare
// id while the SAME page's HTML links above were slugged, and every faculty
// profile's course list was bare (159 redirecting links on six profiles).
describe("the edge's browse ItemList", () => {
  const items = browseDirectorySchemas([LATIN, DEVANAGARI])[0].schema.itemListElement;
  const paths = items.map((item) => new URL(item.url).pathname);

  it("lists each course by its canonical slugged address", () => {
    expect(paths[0]).toBe("/course/398/rectilinear-motion-kinematics");
  });

  it("keeps the id-only address for a title with no ASCII", () => {
    expect(paths[1]).toBe("/course/212");
  });

  // The regression that shipped: two emitters on one page, disagreeing.
  it("names exactly the addresses the same page's HTML links", () => {
    const body = renderBrowseDirectoryBody(
      { description: "Every free course." },
      { courses: [LATIN, DEVANAGARI] },
    );
    const hrefs = body.split('<a href="').slice(1)
      .map((part) => part.slice(0, part.indexOf('"')))
      .filter((href) => href.startsWith("/course/"));
    expect(paths).toEqual(hrefs);
  });
});

describe("the edge's faculty profile body", () => {
  const body = renderFacultyBody(
    {
      display_name: "A. Sharma",
      aliases: [],
      courses: [
        { playlist_id: 398, title: LATIN.title, subject: "Physics", role: "instructor" },
        { playlist_id: 212, title: DEVANAGARI.title },
      ],
    },
    { description: "Faculty profile." },
    null,
  );

  it("links each course by its canonical slugged address", () => {
    expect(body).toContain('<a href="/course/398/rectilinear-motion-kinematics">');
    expect(body).not.toContain('href="/course/398"');
  });

  it("keeps the id-only address for a title with no ASCII", () => {
    expect(body).toContain('<a href="/course/212">');
    expect(body).not.toContain("%");
  });
});

// The hydrated page must declare the SAME canonical the edge-served HTML did.
// It used to stop at the id, so /course/398/kinematics arrived declaring itself
// canonical and hydration quietly renamed it /course/398.
describe("the canonical a hydrated course page declares", () => {
  function CanonicalProbe({ course }) {
    useCourseMetadata(course);
    return null;
  }

  const canonicalFor = (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <CanonicalProbe course={{ title: "Rectilinear Motion (Kinematics)" }} />
      </MemoryRouter>,
    );
    return document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");
  };

  const url = (path) => `${window.location.origin}${path}`;

  beforeEach(() => {
    document.head.querySelector('link[rel="canonical"]')?.remove();
  });

  it("keeps the slug the edge sent the student to", () => {
    expect(canonicalFor("/course/398/rectilinear-motion-kinematics"))
      .toBe(url("/course/398/rectilinear-motion-kinematics"));
  });

  it("leaves a bare id bare — it never invents a slug from the title", () => {
    expect(canonicalFor("/course/398")).toBe(url("/course/398"));
  });

  // Unchanged behaviour, and the reason courseSlug() refuses "chapter" as a
  // slug: a chapter sub-URL still collapses to the course root.
  it("still collapses a chapter sub-URL to the course root", () => {
    expect(canonicalFor("/course/398/chapter/7")).toBe(url("/course/398"));
  });

  it("collapses the hand-edited slug+chapter combination to the slugged root", () => {
    expect(canonicalFor("/course/398/rectilinear-motion-kinematics/chapter/7"))
      .toBe(url("/course/398/rectilinear-motion-kinematics"));
  });

  // "chapters" is a perfectly good slug; only the exact reserved segment is
  // excluded, so the lookahead must not eat a word that merely starts with it.
  it("does not mistake a slug beginning with 'chapter' for the sub-route", () => {
    expect(canonicalFor("/course/398/chapters-of-motion"))
      .toBe(url("/course/398/chapters-of-motion"));
  });
});
