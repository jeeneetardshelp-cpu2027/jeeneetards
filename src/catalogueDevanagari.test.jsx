// Devanagari in the catalogue LISTS, spoken correctly.
//
// index.html declares lang="en". That is right for the interface and wrong for
// the catalogue: real course, lesson, chapter and teacher names in this library
// are written in Devanagari, and under an English lang a screen reader either
// applies English phonetics to them or spells them out. lang.js explains the
// fix and its limits; watchPageDevanagari.test.jsx pins the watch page. This
// file pins the rest of the call sites — the browse grid, the revision panel,
// the study-material card and the homepage channel rail.
//
// EVERY CASE ASSERTS BOTH HALVES. A previous round wrapped every chapter name
// in <span {...langAttrs(name)}>, which emitted an inert span around English
// text and broke an unrelated test that counted matching elements. So each
// test below checks that the Devanagari string is tagged AND that the Latin
// one is left completely alone — no lang, and no wrapper introduced to carry
// one.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "./theme.jsx";
import { VideoCard } from "./Dashboard.jsx";
import ChapterRevision from "./ChapterRevision.jsx";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { SocialProof } from "./HomeSections.jsx";

const HINDI_LESSON = "गति के नियम";
const HINDI_CHAPTER = "गति";
const HINDI_COURSE = "कबीर की साखी";
const HINDI_TEACHER = "अमित बिजारणिया";
const HINDI_CHANNEL = "फिजिक्स वाला";

const show = (node) => render(
  <MemoryRouter>
    <ThemeProvider>{node}</ThemeProvider>
  </MemoryRouter>,
);

describe("a lecture card in the browse grid", () => {
  const video = (over = {}) => ({
    id: 9, youtubeVideoId: "abc123", playlistId: 5,
    title: HINDI_LESSON, institute: "Competishun", instituteId: 8,
    subject: "Physics", chapter: HINDI_CHAPTER, ...over,
  });

  it("tags the lesson title and the subject · chapter line", () => {
    show(<VideoCard video={video()} />);
    expect(screen.getByText(HINDI_LESSON).getAttribute("lang")).toBe("hi");
    expect(screen.getByText(`Physics · ${HINDI_CHAPTER}`).getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin card entirely untagged", () => {
    const { container } = show(
      <VideoCard video={video({ title: "Vectors for JEE", chapter: "Vectors" })} />,
    );
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

describe("the revise-in-one-sitting panel", () => {
  const course = (over = {}) => ({
    id: 1, title: HINDI_COURSE, contentType: "one-shot",
    teacher: HINDI_TEACHER, institute: "Competishun",
    durationSeconds: 2820, rating: null, ratingCount: 0, ...over,
  });
  const panel = (over = {}) => show(
    <ChapterRevision
      chapterId={27}
      chapterName={HINDI_CHAPTER}
      currentCourseId={999}
      chapterCourses={[course(over)]}
    />,
  );

  it("tags the chapter name in the heading and the course title", () => {
    panel();
    expect(screen.getByText(HINDI_CHAPTER).getAttribute("lang")).toBe("hi");
    expect(screen.getByText(HINDI_COURSE).getAttribute("lang")).toBe("hi");
  });

  it("tags the teacher without swallowing the duration beside it", () => {
    panel();
    const credit = screen.getByText(HINDI_TEACHER);
    expect(credit.getAttribute("lang")).toBe("hi");
    // The measured length is digits and a Latin unit; it must stay outside the
    // Hindi element or a screen reader reads "47m" with Hindi phonetics.
    expect(credit.textContent).toBe(HINDI_TEACHER);
    expect(credit.parentElement.textContent).toBe(`${HINDI_TEACHER} · 47m`);
  });

  it("leaves an all-Latin panel untagged and unwrapped", () => {
    const { container } = show(
      <ChapterRevision
        chapterId={27}
        chapterName="Rotational Motion"
        currentCourseId={999}
        chapterCourses={[course({ title: "Mechanics in One Shot", teacher: "Manish Raj" })]}
      />,
    );
    expect(container.querySelector("[lang]")).toBeNull();
    expect(screen.getByText("Manish Raj · 47m")).toBeTruthy();
  });
});

describe("a study-material card", () => {
  const material = (over = {}) => ({
    id: 1, title: HINDI_COURSE, type: "formula_sheet", typeLabel: "Formula sheets",
    description: null, sourceName: "NCERT", sourceUrl: "https://example.test/a.pdf",
    fileFormat: "pdf", pageCount: 4,
    scopes: [{
      goal: "jee", class: "class-11",
      subject: { slug: "physics", name: "Physics" },
      chapter: { name: HINDI_CHAPTER },
    }],
    ...over,
  });

  it("tags the title and the scope line that names the chapter", () => {
    show(<StudyMaterialCard material={material()} />);
    expect(screen.getByText(HINDI_COURSE).getAttribute("lang")).toBe("hi");
    expect(screen.getByText(`JEE · Class 11 · Physics · ${HINDI_CHAPTER}`)
      .getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin card untagged", () => {
    const { container } = show(
      <StudyMaterialCard material={material({
        title: "Kinematics formula sheet",
        scopes: [{
          goal: "jee", class: "class-11",
          subject: { slug: "physics", name: "Physics" },
          chapter: { name: "Kinematics" },
        }],
      })} />,
    );
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

describe("the homepage channel rail", () => {
  it("tags a Devanagari channel name and only that one", () => {
    show(
      <SocialProof
        loading={false}
        institutes={[
          { id: 1, name: HINDI_CHANNEL, logoUrl: null, videoCount: 20 },
          { id: 2, name: "Competishun", logoUrl: null, videoCount: 10 },
        ]}
      />,
    );
    expect(screen.getByText(HINDI_CHANNEL).getAttribute("lang")).toBe("hi");
    expect(screen.getByText("Competishun").getAttribute("lang")).toBeNull();
  });
});
