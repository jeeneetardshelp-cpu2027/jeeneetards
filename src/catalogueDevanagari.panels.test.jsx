// Devanagari in the remaining catalogue surfaces, spoken correctly.
//
// Same contract as catalogueDevanagari.test.jsx, extended to the call sites
// that round covered later: the watch page's "other institutes" strip, the
// faculty directory, the watch page's study-material panel heading, the study
// material directory's chapter picker, the guided journey's step cards and the
// browse empty state. lang.js explains the fix and its limits.
//
// EVERY CASE ASSERTS BOTH HALVES: the Devanagari string is tagged AND the
// Latin one is left completely alone — no lang, and no wrapper introduced to
// carry one. A previous round's inert spans around English text broke an
// unrelated element-counting test; see catalogueDevanagari.test.jsx.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "./theme.jsx";

const HINDI_CHAPTER = "गति";
const HINDI_COURSE = "कबीर की साखी";
const HINDI_TEACHER = "अमित बिजारणिया";
const HINDI_CHANNEL = "फिजिक्स वाला";

const FIXTURES = vi.hoisted(() => ({
  HINDI_TEACHER: "अमित बिजारणिया",
  HINDI_CHANNEL: "फिजिक्स वाला",
  HINDI_COURSE: "कबीर की साखी",
}));

// Shared page chrome, stubbed once for every page under test here: these are
// focused script-tagging tests, and the header/shell carries no catalogue text
// of its own (its own Devanagari handling is pinned elsewhere).
vi.mock("./AppShell.jsx", () => ({
  Page: ({ children }) => <>{children}</>,
  GlobalHeader: () => null,
  HeaderSearch: () => null,
  Container: ({ children }) => <div>{children}</div>,
  MAIN_CONTENT_ID: "main-content",
}));

const show = (node) => render(
  <MemoryRouter>
    <ThemeProvider>{node}</ThemeProvider>
  </MemoryRouter>,
);

// ---------------------------------------------------------------------
// ChapterTeachers — "N other institutes teach {chapter}" on the watch page.
// ---------------------------------------------------------------------
import ChapterTeachers from "./ChapterTeachers.jsx";

const teacherCourse = (over) => ({
  id: 1, institute: "Physics Wallah", instituteId: 5, lectures: 8,
  rating: null, ratingCount: 0, instituteLogoUrl: null, ...over,
});

describe("the other-institutes strip on the watch page", () => {
  it("tags a Devanagari chapter name and institute name, and only those", () => {
    show(
      <ChapterTeachers
        chapterId={82} chapterName={HINDI_CHAPTER}
        currentCourseId={1} currentInstituteId={5}
        chapterCourses={[
          teacherCourse({ id: 1, instituteId: 5 }),
          teacherCourse({ id: 3, instituteId: 8, institute: HINDI_CHANNEL }),
          teacherCourse({ id: 4, instituteId: 9, institute: "ALLEN" }),
        ]}
      />,
    );
    expect(screen.getByText(HINDI_CHAPTER).getAttribute("lang")).toBe("hi");
    expect(screen.getByText(HINDI_CHANNEL).getAttribute("lang")).toBe("hi");
    expect(screen.getByText("ALLEN").getAttribute("lang")).toBeNull();
  });

  it("leaves an all-Latin strip untagged", () => {
    const { container } = show(
      <ChapterTeachers
        chapterId={82} chapterName="Laws of Motion"
        currentCourseId={1} currentInstituteId={5}
        chapterCourses={[
          teacherCourse({ id: 1, instituteId: 5 }),
          teacherCourse({ id: 3, instituteId: 8, institute: "ALLEN" }),
        ]}
      />,
    );
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// FacultyDirectory — /faculty cards: display name and institutes line.
// ---------------------------------------------------------------------
vi.mock("./useFaculty.js", () => ({
  useFacultyDirectoryOptions: () => ({
    goals: [], subjects: [], loading: false, error: null, retry: () => {},
  }),
  useFacultyFacets: () => ({
    facets: [
      {
        teacher_id: 7, display_name: FIXTURES.HINDI_TEACHER, slug: "amit",
        verified: true, institutes: FIXTURES.HINDI_CHANNEL, course_count: 4,
      },
      {
        teacher_id: 8, display_name: "Mohit Tyagi", slug: "mohit-tyagi",
        verified: true, institutes: "Competishun", course_count: 3,
      },
    ],
    loading: false, error: null, retry: () => {},
  }),
  useTeacherSearch: () => ({ results: [], loading: false, error: null, retry: () => {} }),
}));

import FacultyDirectory from "./FacultyDirectory.jsx";

describe("a faculty directory card", () => {
  const showDirectory = () => render(
    <MemoryRouter initialEntries={["/faculty"]}>
      <Routes>
        <Route path="/faculty" element={<FacultyDirectory />} />
      </Routes>
    </MemoryRouter>,
  );

  it("tags a Devanagari faculty name and institutes line", () => {
    showDirectory();
    expect(screen.getByText(HINDI_TEACHER).getAttribute("lang")).toBe("hi");
    expect(screen.getByText(HINDI_CHANNEL).getAttribute("lang")).toBe("hi");
  });

  it("leaves the Latin card beside it untagged", () => {
    showDirectory();
    expect(screen.getByText("Mohit Tyagi").getAttribute("lang")).toBeNull();
    expect(screen.getByText("Competishun").getAttribute("lang")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// StudyMaterialPanel — the "Study material for {chapter}" heading.
// ---------------------------------------------------------------------
import { StudyMaterialPanelView } from "./StudyMaterialPanel.jsx";

describe("the watch page's study-material heading", () => {
  it("tags the heading when the chapter name is Devanagari", () => {
    show(<StudyMaterialPanelView chapterName={HINDI_CHAPTER} chapterId={3} items={[]} />);
    const heading = screen.getByRole("heading", { name: `Study material for ${HINDI_CHAPTER}` });
    expect(heading.getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin chapter's panel untagged and unwrapped", () => {
    const { container } = show(
      <StudyMaterialPanelView chapterName="Kinematics" chapterId={3} items={[]} />,
    );
    expect(screen.getByRole("heading", { name: "Study material for Kinematics" })).toBeTruthy();
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// StudyMaterialsPage — the chapter <option>s in the filter cascade.
// ---------------------------------------------------------------------
vi.mock("./useStudyMaterialCatalog.js", () => ({
  useStudyMaterialCatalog: () => ({
    goals: [{ id: 1, slug: "jee", name: "JEE", count: 1 }],
    boards: [],
    classes: [],
    subjects: [{ id: 9, slug: "hindi", name: "Hindi", count: 1 }],
    chapters: [
      { id: 21, slug: "kabir-ki-sakhi", name: FIXTURES.HINDI_COURSE, count: 1 },
      { id: 22, slug: "kinematics", name: "Kinematics", count: 1 },
    ],
    loading: false, error: null, unavailable: false, retry: () => {},
  }),
}));
vi.mock("./useStudyMaterials.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useStudyMaterials: () => ({
      items: [], total: 0, loading: false, error: null, unavailable: false,
    }),
  };
});

import StudyMaterialsPage from "./StudyMaterialsPage.jsx";

describe("the study-material chapter picker", () => {
  it("tags a Devanagari chapter option and leaves the Latin one alone", () => {
    render(
      <MemoryRouter initialEntries={["/materials"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("option", { name: HINDI_COURSE }).getAttribute("lang")).toBe("hi");
    expect(screen.getByRole("option", { name: "Kinematics" }).getAttribute("lang")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Explore — the guided journey's step cards.
// ---------------------------------------------------------------------
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({
    goals: [{ id: 1, slug: "jee", name: "JEE", count: 10 }],
    loading: false, error: null, retry: () => {},
  }),
  useClassLevels: () => ({
    classLevels: [{ id: 2, slug: "class-11", name: "Class 11" }],
  }),
  useBoards: () => ({ boards: [], loading: false, error: null, unavailable: false }),
  usePopulatedClasses: () => ({
    classSlugs: ["class-11"], loading: false, error: null, ready: true, retry: () => {},
  }),
  useGoalCatalog: () => ({
    subjects: [{ id: 11, slug: "hindi", name: "Hindi", count: 4 }],
    chaptersBySubject: {
      11: [
        { id: 101, slug: "kabir-ki-sakhi", name: FIXTURES.HINDI_COURSE, count: 2 },
        { id: 102, slug: "kinematics", name: "Kinematics", count: 3 },
      ],
    },
    loading: false, error: null, ready: true, retry: () => {},
  }),
}));
// Never rendered here (no query is typed); the stub only keeps the module
// graph off the network, exactly as Explore.unknownSlug.test.jsx does.
vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false,
    retry: () => {}, page: 0, setPage: () => {},
  }),
  GROUPS: [{ key: "chapter", label: "Chapters" }],
  MIN_QUERY: 2,
}));

import Explore from "./Explore.jsx";

describe("the guided journey's chapter cards", () => {
  it("tags a Devanagari card label and leaves the Latin card alone", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/explore/jee/class-11/hindi"]}>
          <Routes>
            <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText(HINDI_COURSE).getAttribute("lang")).toBe("hi");
    expect(screen.getByText("Kinematics").getAttribute("lang")).toBeNull();
  });
});

// ---------------------------------------------------------------------
// PlaylistBrowse — the empty state that names the chapter that emptied it.
// ---------------------------------------------------------------------
vi.mock("./usePlaylistBrowse.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePlaylistBrowse: () => ({
      items: [], total: 0, loading: false, error: null, hasMore: false, reload: () => {},
    }),
  };
});
vi.mock("./useRatingsAvailability.js", () => ({ useRatingsAvailability: () => null }));
vi.mock("./usePopularityAvailability.js", () => ({ usePopularityAvailability: () => null }));

import PlaylistBrowse from "./PlaylistBrowse.jsx";

describe("the browse empty state", () => {
  const showEmpty = (chapterName) => show(
    <PlaylistBrowse
      tab="playlists"
      onTabChange={() => {}}
      lectureView={null}
      filters={{ chapterName, subjectName: null, stage: null, chapter: null, search: "", sheetContent: null }}
    />,
  );

  it("tags the title when it names a Devanagari chapter", () => {
    showEmpty(HINDI_CHAPTER);
    expect(screen.getByText(`No courses are listed for ${HINDI_CHAPTER} yet.`)
      .getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin empty state untagged and unwrapped", () => {
    const { container } = showEmpty("Kinematics");
    expect(screen.getByText("No courses are listed for Kinematics yet.")).toBeTruthy();
    expect(container.querySelector("[lang]")).toBeNull();
  });
});
