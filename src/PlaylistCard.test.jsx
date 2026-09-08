// PlaylistCard.jsx — the ONE shared course card, now in its own module so the
// homepage can import it without dragging the whole browse page into its
// bundle. These tests pin down the card's honesty rules; the browse-page tests
// (PlaylistBrowse.test.jsx) keep covering the card inside its grid.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PlaylistCard } from "./PlaylistCard.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = (course, props = {}) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <PlaylistCard course={course} to="/course/1" comparisonEnabled={false} {...props} />
      </ThemeProvider>
    </MemoryRouter>,
  );

const richCourse = (over = {}) => ({
  id: 1,
  title: "Complete Kinematics",
  subject: "Physics",
  classLevels: ["Class 11"],
  teacher: "ABJ Sir",
  lectures: 12,
  durationSeconds: 3600,
  coverage: 80,
  contentType: "full-course",
  difficulty: "advanced",
  coverVideoId: "CBvaO-uDvs8",
  ...over,
});

describe("PlaylistCard", () => {
  it("shows a confident rating as a score with its count", () => {
    show(richCourse({ rating: 4.6, ratingCount: 9 }));
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(9)")).toBeTruthy();
  });

  it("shows a low-count rating as a count, never as a score", () => {
    show(richCourse({ rating: 5, ratingCount: 1 }));
    expect(screen.getByText("1 student rating")).toBeTruthy();
    expect(screen.queryByText("5.0")).toBeNull();
  });

  it("marks a card with three or more missing decision fields as limited", () => {
    show({ id: 2, title: "Mystery Course", classLevels: [] });
    expect(screen.getByText("Limited metadata")).toBeTruthy();
  });

  it("does not apologise on a card with rich metadata", () => {
    show(richCourse());
    expect(screen.queryByText("Limited metadata")).toBeNull();
    expect(screen.getByText("1h 0m")).toBeTruthy();
    expect(screen.getByText("12 lectures")).toBeTruthy();
  });

  it("keeps the full-quality cover image — this is the large rendition", () => {
    const { container } = show(richCourse());
    expect(container.querySelector("img")?.getAttribute("src"))
      .toBe("https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg");
  });

  // LANGUAGE IS THE ONE ATTRIBUTE MOST OF THIS AUDIENCE FILTERS ON FIRST.
  // It used to be a grey word in the middle of the facts row; it is now a
  // badge above the title, where a student scanning a grid can see it.
  it("shows the course language as a badge, in the canonical vocabulary", () => {
    show(richCourse({ language: "hinglish" }));
    // "Taught in" is sr-only, so the badge reads as a sentence to a listener
    // while staying one scannable word on screen.
    const badge = screen.getByText("Taught in").parentElement;
    expect(badge.textContent.replace(/\s+/g, " ").trim()).toBe("Taught in Hinglish");
    expect(screen.getByText("Hinglish")).toBeTruthy();
  });

  it("uses the filter vocabulary's label, not the raw column value", () => {
    show(richCourse({ language: "hindi" }));
    // The database stores "hindi"; the badge must say what the filter says.
    expect(screen.getByText("Hindi")).toBeTruthy();
    expect(screen.queryByText("hindi")).toBeNull();
  });

  it("shows no language badge at all when the language is unknown", () => {
    show(richCourse({ language: null }));
    expect(screen.queryByText("Taught in")).toBeNull();
    for (const label of ["Hindi", "English", "Hinglish"])
      expect([label, screen.queryByText(label)]).toEqual([label, null]);
  });

  it("marks a Devanagari course title as Hindi for screen readers", () => {
    show(richCourse({ title: "कबीर की साखी" }));
    expect(screen.getByRole("heading", { name: "कबीर की साखी" }).getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin title under the document's own lang", () => {
    show(richCourse());
    expect(screen.getByRole("heading", { name: "Complete Kinematics" }).getAttribute("lang")).toBeNull();
  });

  it("renders a real link when `to` is given, and a button for legacy onOpen callers", () => {
    show(richCourse());
    expect(screen.getByRole("link", { name: "View course" })
      .getAttribute("href")).toBe("/course/1");

    const onOpen = vi.fn();
    const course = richCourse({ id: 3 });
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard course={course} onOpen={onOpen} to={undefined} comparisonEnabled={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View course" }));
    expect(onOpen).toHaveBeenCalledWith(course);
  });

  // THE CARD'S IDENTITY IS THE LINK. On a 375x812 phone the first card's title
  // sits at y=783 and the only control on the card, "View course", sits at
  // y=899 — 87px below the fold. A student who taps the title, or the cover
  // they were actually aiming at, got nothing at all.
  it("opens the course from the title, with the anchor inside the heading", () => {
    show(richCourse());
    const heading = screen.getByRole("heading", { name: "Complete Kinematics" });
    const link = screen.getByRole("link", { name: "Complete Kinematics" });
    expect(link.getAttribute("href")).toBe("/course/1");
    // <a> INSIDE <h3>, never the <h3> inside the <a>.
    expect(heading.contains(link)).toBe(true);
    // The clamp that makes every card the same shape rides on the ANCHOR, not
    // on the heading — see the focus-ring test below for why.
    expect(link.className).toContain("line-clamp-2");
    expect(heading.className).not.toContain("line-clamp");
  });

  // THE FOCUS RING MUST NOT BE CLIPPED AWAY. Tailwind's `line-clamp-*`
  // compiles to `display:-webkit-box` + `overflow:hidden`, and an ancestor's
  // overflow:hidden clips a DESCENDANT's outline (an element's own does not
  // clip its own). With `line-clamp-2` on the <h3> and `line-clamp-1` on the
  // credit row, the two new links' `focus-visible:outline-offset-2` rings —
  // painted 2-4px outside the anchor's line boxes — were cut on the top,
  // bottom and left, leaving stray arcs off the right edge. Measured in
  // Chromium at 375x812 against the built CSS: the title link is the FIRST tab
  // stop of every card on /browse and the homepage grids.
  //
  // jsdom does not lay out or paint, so this pins the structural cause: no
  // element BETWEEN a focusable link and the card root may carry a clamp.
  it("keeps every clamp off the ancestors of the card's links, so focus rings are not clipped", () => {
    const { container } = show(richCourse({ teacherSlug: "amit-bijarnia", institute: "Test Institute", instituteId: 7 }));
    const root = container.firstElementChild;
    const links = [...container.querySelectorAll("a")];
    // Title, teacher, institute, "View course" — every one of them focusable.
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) {
      for (let el = link.parentElement; el && el !== root; el = el.parentElement) {
        expect(`${link.getAttribute("href")} < ${el.tagName}.${el.className}`)
          .not.toContain("line-clamp");
      }
    }
    // And the credit row keeps no overflow clip of its own: `flex` already
    // beat the clamp's `display`, so all it ever contributed was the clip.
    const credit = screen.getByRole("link", { name: "View all courses by ABJ Sir" }).parentElement;
    expect(credit.className).toContain("flex");
    expect(credit.className).not.toContain("line-clamp");
  });

  it("opens the course from the cover without adding a second, nameless tab stop", () => {
    const { container } = show(richCourse());
    const cover = container.querySelector("img").closest("a");
    expect(cover.getAttribute("href")).toBe("/course/1");
    // The cover says nothing the title link does not, so it is decorative:
    // out of the accessibility tree and out of the tab order. A keyboard or
    // screen-reader user meets the course once by name, not twice.
    expect([cover.getAttribute("aria-hidden"), cover.getAttribute("tabindex")])
      .toEqual(["true", "-1"]);
    expect(screen.getAllByRole("link").map((a) => a.textContent))
      .toEqual(["Complete Kinematics", "View course"]);
  });

  it("links the teacher credit to the faculty page when one teacher resolved", () => {
    show(richCourse({ teacherSlug: "amit-bijarnia" }));
    const link = screen.getByRole("link", { name: "View all courses by ABJ Sir" });
    expect(link.getAttribute("href")).toBe("/faculty/amit-bijarnia");
    // The visible text stays the CREDIT the student is shown, not the
    // registry's display_name — 94 of the linked credits differ from it, and
    // renaming "ABJ Sir" to "Amit Bijarnia" under the cursor is a different
    // claim from the one the card is making.
    expect(link.textContent).toBe("ABJ Sir");
  });

  it("keeps the teacher as plain text when no single faculty page owns the credit", () => {
    // teacherSlug is null both for the 128 free-text credits with no linked
    // teacher at all and for the 134 credited to TWO OR MORE slugged teachers.
    // Either way the card says the name and stops: a slug is never derived
    // from a name, and a shared credit is never resolved by guessing (rule 2).
    show(richCourse({ teacherSlug: null }));
    expect(screen.getByText("ABJ Sir").closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: /courses by/ })).toBeNull();
  });

  it("falls back to a plain heading and no broken links when `to` is absent", () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard course={richCourse({ id: 4 })} onOpen={vi.fn()} to={undefined}
                        comparisonEnabled={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const heading = screen.getByRole("heading", { name: "Complete Kinematics" });
    expect(heading).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Complete Kinematics" })).toBeNull();
    // Card geometry is identical with and without `to`: the plain branch keeps
    // the same two-line clamp, on its own <span> instead of on an <a>.
    expect(heading.firstElementChild.tagName).toBe("SPAN");
    expect(heading.firstElementChild.className).toContain("line-clamp-2");
    expect(container.querySelector("img").closest("a")).toBeNull();
    // Nothing on this card pretends to be a link: the legacy onOpen button is
    // still the whole story for callers that have not migrated.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
