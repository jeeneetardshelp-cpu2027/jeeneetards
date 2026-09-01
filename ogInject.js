// ogInject.js — pure helpers for per-course <head> metadata.
//
// Shared by the Vercel Edge middleware (middleware.js) and its local test
// (src/scripts/testCourseMeta.js). The helpers have no side effects or
// browser-only assumptions — just data and strings in, strings out — so the
// exact logic that ships can be exercised under plain Node first.

import {
  courseSchema,
  breadcrumbListSchema,
  itemListSchema,
  learningResourceSchema,
  personSchema,
  websiteSchema,
  organizationSchema,
  safeStructuredDataJson,
} from "./src/structuredData.js";
import { getFacultyGuide } from "./src/facultyGuides.js";
// Pure data, no React — safe to pull into the edge runtime.
import { TEST_SECTIONS, ACCESS, findTestSection } from "./src/testPlatforms.js";
import { buildCourseMetadata } from "./src/courseMetadata.js";
import {
  studyMaterialLandingSchemas,
  studyMaterialsPageSchemas,
} from "./src/studyMaterialsStructuredData.js";
import {
  JEE_MAIN_PAPERS_META,
  JEE_MAIN_PAPERS_PATH,
  splitJeeMainPapers,
} from "./src/studyMaterialLandings.js";
import { testPageSchemas } from "./src/testPageStructuredData.js";
import {
  METHODOLOGY_CONTACT,
  METHODOLOGY_INTRO,
  METHODOLOGY_SECTIONS,
  METHODOLOGY_UPDATED,
} from "./src/methodologyContent.js";

const SITE = "https://www.jeeneetard.com";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the { title, description, url } for a course row from PostgREST. */
export function courseMeta(course, id) {
  return {
    ...buildCourseMetadata(course),
    url: `${SITE}/course/${id}`,
    // Per-course WhatsApp/Telegram preview card. /api/og renders the course's
    // own title/teacher/rating as a PNG and falls back to the static
    // social-preview.png for anything it cannot render, so pointing og:image
    // here is always safe — the preview degrades, never breaks.
    image: `${SITE}/api/og?course=${id}`,
    robots: "index, follow",
  };
}

/**
 * Swap the generic homepage <head> tags in the built index.html shell for a
 * course's own. Relies on the tags being single-line (see index.html). Any tag
 * that does not match is simply left as-is — a partial rewrite is still valid
 * HTML, never a broken page.
 */
export function injectCourseMeta(html, meta) {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  const robots = escapeHtml(meta.robots || "index, follow");
  const type = escapeHtml(meta.type || "website");
  // Function replacements throughout: a string replacement would expand `$`
  // sequences ($&, $', $1, …) in course titles as replace() patterns and
  // corrupt the page — a title like `worth $199` must stay literal text.
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta name="robots" content=")[^"]*(")/, (m, a, z) => `${a}${robots}${z}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (m, a, z) => `${a}${u}${z}`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, (m, a, z) => `${a}${type}${z}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`);
  // Course pages carry their own preview card (/api/og renders the course's
  // title/teacher/rating as a PNG, falling back to the static
  // social-preview.png for anything it cannot render). Opt-in via meta.image
  // so every other caller keeps the generic image. The og:image:width/height/
  // type tags stay as-is: /api/og emits a 1200x630 PNG too.
  const img = meta.image ? escapeHtml(meta.image) : null;
  const withImage = img
    ? out
        .replace(/(<meta property="og:image" content=")[^"]*(")/, (m, a, z) => `${a}${img}${z}`)
        .replace(/(<meta name="twitter:image" content=")[^"]*(")/, (m, a, z) => `${a}${img}${z}`)
    : out;
  // Canonical: the shell deliberately ships WITHOUT one (a static canonical
  // would claim the homepage for every route). Replace it if an old shell
  // still has it, otherwise insert it next to <title> — which always exists.
  const canonicalTag = `<link rel="canonical" href="${u}" />`;
  return /<link rel="canonical"[^>]*>/.test(withImage)
    ? withImage.replace(/<link rel="canonical"[^>]*>/, () => canonicalTag)
    : withImage.replace(/<title>/, () => `${canonicalTag}\n    <title>`);
}

/**
 * Head tags for a NON-course route (/browse, /explore/...). Takes the result of
 * pageMetadata.metadataForLocation() so the server emits exactly what the
 * client would compute — one source of truth, no drift.
 *
 * Separate from injectCourseMeta on purpose: this one also writes `robots`
 * (the client marks search views noindex) and takes an already-resolved
 * canonical path rather than building a course URL.
 */
export function injectRouteMeta(html, meta) {
  if (!meta) return html;
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(`${SITE}${meta.canonicalPath || "/"}`);
  const r = escapeHtml(meta.robots || "index, follow");
  // pageMetadata declares a type per route — "article" for a forum post or a
  // single poll, "website" for everything else — and the CLIENT sets it. The
  // edge did not, so a shared poll or forum link unfurled as og:type "website"
  // while the same page said "article" once React took over: two sources of
  // truth disagreeing about the same URL, and the crawler only ever sees the
  // edge's answer. injectCourseMeta has always set this; the omission here was
  // the reason /course got it right and every other article route did not.
  // Defaults to "website", so no existing caller changes behaviour.
  const ty = escapeHtml(meta.type || "website");
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta name="robots" content=")[^"]*(")/, (m, a, z) => `${a}${r}${z}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (m, a, z) => `${a}${u}${z}`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, (m, a, z) => `${a}${ty}${z}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`);
  const canonicalTag = `<link rel="canonical" href="${u}" />`;
  return /<link rel="canonical"[^>]*>/.test(out)
    ? out.replace(/<link rel="canonical"[^>]*>/, () => canonicalTag)
    : out.replace(/<title>/, () => `${canonicalTag}\n    <title>`);
}

/** Homepage schemas use the same pure builders as Home.jsx. */
export function landingSchemas(pathname, materials = []) {
  if (pathname === "/") {
    return [
      { key: "WebSite", schema: websiteSchema() },
      { key: "Organization", schema: organizationSchema() },
    ];
  }
  const schemas = pathname === "/materials"
    ? studyMaterialsPageSchemas(materials)
    : pathname === JEE_MAIN_PAPERS_PATH
      ? studyMaterialLandingSchemas(materials, {
          label: "JEE Main previous year papers",
          path: JEE_MAIN_PAPERS_PATH,
        })
      : testPageSchemas(pathname);
  return schemas.map((schema) => ({
    key: schema["@type"],
    schema,
  }));
}

/**
 * Canonical study-material directory for crawlers that do not run the React
 * request. The RPC already limits this input to approved, published records;
 * this layer additionally refuses non-HTTPS destinations before rendering.
 */
export function renderStudyMaterialsBody(meta, materials = []) {
  const safeMaterials = materials
    .filter((material) => material?.title &&
      /^https:\/\//i.test(material.sourceUrl ?? material.source_url ?? ""));
  const renderItems = (collection) => collection
    .map((material) => {
      const url = material.sourceUrl ?? material.source_url;
      const source = material.sourceName ?? material.source_name;
      const description = material.description
        ? ` ${escapeHtml(material.description)}`
        : "";
      return `<li><a href="${escapeHtml(url)}" rel="noopener">` +
        `${escapeHtml(material.title)}</a>` +
        `${source ? ` — ${escapeHtml(source)}.` : ""}${description}</li>`;
    })
    .join("");
  const renderYearGroups = (collection) => {
    const byYear = new Map();
    for (const material of collection) {
      const year = Number(material.examYear ?? material.exam_year);
      const label = Number.isFinite(year) ? String(year) : "Year not listed";
      if (!byYear.has(label)) byYear.set(label, []);
      byYear.get(label).push(material);
    }
    return [...byYear.entries()]
      .sort(([yearA], [yearB]) => {
        if (yearA === "Year not listed") return 1;
        if (yearB === "Year not listed") return -1;
        return Number(yearB) - Number(yearA);
      })
      .map(([year, collectionForYear]) => (
        `<section><h3>${escapeHtml(year)}</h3><ul>${renderItems(collectionForYear)}</ul></section>`
      ))
      .join("");
  };

  if (!safeMaterials.length) return renderLandingBody(meta.canonicalPath || "/materials", meta);
  const jeeMain = meta.canonicalPath === JEE_MAIN_PAPERS_PATH;
  const groups = splitJeeMainPapers(safeMaterials);
  const items = renderItems(safeMaterials);
  const questionOnlyItems = jeeMain
    ? renderYearGroups(groups.questionOnly)
    : renderItems(groups.questionOnly);
  const answerKeyItems = jeeMain
    ? renderYearGroups(groups.answerKeys)
    : renderItems(groups.answerKeys);
  const solutionItems = jeeMain
    ? renderYearGroups(groups.withSolutions)
    : renderItems(groups.withSolutions);
  return [
    "<main>",
    jeeMain
      ? '<nav aria-label="Breadcrumb"><a href="/">Home</a> - <a href="/materials">Study material</a> - <span>JEE Main papers</span></nav>'
      : '<nav aria-label="Breadcrumb"><a href="/">Home</a> - <span>Study material</span></nav>',
    `<h1>${escapeHtml(jeeMain ? JEE_MAIN_PAPERS_META.heading : "Find study material by your syllabus.")}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    jeeMain ? "<h2>JEE Main question papers</h2>" : "<h2>Reviewed resources</h2>",
    jeeMain ? questionOnlyItems : `<ul>${items}</ul>`,
    jeeMain ? "<h2>JEE Main official answer keys</h2>" : "",
    jeeMain && answerKeyItems
      ? answerKeyItems
      : jeeMain
        ? "<p>No official final answer keys are listed yet. Provisional keys are excluded.</p>"
        : "",
    jeeMain ? "<h2>JEE Main papers with solutions</h2>" : "",
    jeeMain && solutionItems
      ? solutionItems
      : jeeMain
        ? "<p>No reviewed papers with worked solutions are listed yet. Official answer keys are not labelled as worked solutions.</p>"
        : "",
    '<nav aria-label="Study resources"><a href="/materials">All study material</a> ' +
      '<a href="/explore">Find a course</a> ' +
      '<a href="/tests">Mock tests</a> ' +
      '<a href="/methodology">How resources are curated</a></nav>',
    "</main>",
  ].join("");
}

/** The canonical Browse response already renders every course link as HTML.
 *  Describe that same ordered directory for non-JavaScript crawlers; the
 *  client replaces this ItemList with the currently visible page on hydrate. */
export function browseDirectorySchemas(courses = []) {
  const list = itemListSchema(
    courses
      .filter((course) => course?.id && course?.title)
      .map((course, index) => ({
        title: course.title,
        url: `/course/${encodeURIComponent(course.id)}`,
        position: index + 1,
      })),
  );
  return list ? [{ key: "ItemList", schema: list }] : [];
}

/** The canonical faculty landing lists every linked public faculty profile. */
export function facultyDirectorySchemas(faculty = []) {
  const list = itemListSchema(
    faculty
      .filter((person) => person?.slug && person?.display_name)
      .map((person, index) => ({
        title: person.display_name,
        url: `/faculty/${encodeURIComponent(person.slug)}`,
        position: index + 1,
      })),
  );
  return list ? [{ key: "ItemList", schema: list }] : [];
}

/**
 * Small, truthful fallbacks for public discovery landings. React replaces
 * this content during hydration; the wording and H1 mirror the visible page.
 */
export function renderLandingBody(pathname, meta) {
  const pages = {
    "/": {
      heading: "Find the right lecture. Skip the noise.",
      description:
        "Thousands of free JEE, NEET and board-exam lectures from India's best YouTube teachers, organised by class, subject and chapter so you can compare teachers before choosing a course.",
      links: [["Find a course", "/explore"], ["Browse courses", "/browse"]],
    },
    "/browse": {
      heading: "All courses",
      description: meta.description,
      links: [["Home", "/"], ["Find a course", "/explore"]],
    },
    "/faculty": {
      heading: "Find courses by faculty",
      description: meta.description,
      links: [["Browse all courses", "/browse"], ["Search the library", "/search"], ["Home", "/"]],
    },
    "/explore": {
      heading: "What are you preparing for?",
      description:
        "Choose an exam or school curriculum, then narrow the free course library by class, subject and chapter.",
      links: [
        ["JEE", "/explore/jee"],
        ["NEET", "/explore/neet"],
        ["Olympiad", "/explore/olympiad"],
        ["School Boards", "/explore/school"],
        ["Home", "/"],
        ["Browse all courses", "/browse"],
      ],
    },
    "/materials": {
      heading: "Find study material by your syllabus.",
      description:
        "Short notes, formula sheets, full lecture notes and previous-year papers—organised by exam, class, subject and chapter.",
      links: [
        ["Find a course", "/explore"],
        ["Mock tests", "/tests"],
        ["How resources are curated", "/methodology"],
      ],
    },
    [JEE_MAIN_PAPERS_PATH]: {
      heading: JEE_MAIN_PAPERS_META.heading,
      description: JEE_MAIN_PAPERS_META.description,
      links: [
        ["All study material", "/materials"],
        ["Mock tests", "/tests"],
        ["How resources are curated", "/methodology"],
      ],
    },
    "/terms": {
      heading: "Terms of Service & Disclaimer",
      description: meta.description,
      links: [["Privacy Policy", "/privacy"], ["Home", "/"]],
    },
    "/privacy": {
      heading: "Privacy Policy",
      description: meta.description,
      links: [["Terms & Disclaimer", "/terms"], ["Home", "/"]],
    },
  };
  // /tests is a list, not a blurb: the useful facts for an extractive
  // crawler are which exams are covered and where each test actually lives.
  // Built from the same TEST_SECTIONS the React page renders, so the served
  // HTML can never claim a source the page does not show.
  if (pathname === "/tests") return renderTestsBody(meta);
  if (pathname === "/methodology") return renderMethodologyBody();
  if (pathname.startsWith("/tests/")) {
    const section = findTestSection(pathname.slice("/tests/".length));
    if (section) return renderExamTestsBody(section, meta);
    return "";
  }

  const page = pages[pathname];
  if (!page) return "";

  const links = page.links
    .map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join(" ");
  return [
    "<main>",
    `<h1>${escapeHtml(page.heading)}</h1>`,
    `<p>${escapeHtml(page.description)}</p>`,
    `<nav aria-label="Course discovery">${links}</nav>`,
    "</main>",
  ].join("");
}

export function renderMethodologyBody() {
  const sections = METHODOLOGY_SECTIONS.map((section) => [
    `<section><h2>${escapeHtml(section.title)}</h2>`,
    ...section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    "</section>",
  ].join(""));

  return [
    "<main>",
    '<nav aria-label="Breadcrumb"><a href="/">Home</a> - <span>How courses are curated</span></nav>',
    "<h1>How JEENEETARD curates courses</h1>",
    `<p>${escapeHtml(METHODOLOGY_INTRO)}</p>`,
    `<p>Last updated: ${escapeHtml(METHODOLOGY_UPDATED)}</p>`,
    ...sections,
    "<section><h2>Request a correction</h2>",
    `<p>Send the page URL, the field that appears wrong, and a public source to <a href="mailto:${escapeHtml(METHODOLOGY_CONTACT)}">${escapeHtml(METHODOLOGY_CONTACT)}</a>.</p></section>`,
    '<p><a href="/explore">Find a course</a> <a href="/browse">Browse all courses</a></p>',
    "</main>",
  ].join("");
}

/**
 * Canonical Browse fallback with real catalogue links. This is intentionally
 * plain HTML: React replaces it during hydration, while crawlers and students
 * without JavaScript still get a complete path to every public course and
 * faculty profile instead of a generic two-link shell.
 */
export function renderBrowseDirectoryBody(meta, { courses = [], faculty = [] } = {}) {
  const courseItems = courses
    .filter((course) => course?.id && course?.title)
    .map((course) =>
      `<li><a href="/course/${encodeURIComponent(course.id)}">` +
      `${escapeHtml(course.title)}</a></li>`,
    )
    .join("");
  const facultyItems = faculty
    .filter((person) => person?.slug && person?.display_name)
    .map((person) =>
      `<li><a href="/faculty/${encodeURIComponent(person.slug)}">` +
      `${escapeHtml(person.display_name)}</a></li>`,
    )
    .join("");

  return [
    "<main>",
    "<h1>All courses</h1>",
    `<p>${escapeHtml(meta.description)}</p>`,
    courseItems ? "<h2>Course directory</h2>" : "",
    courseItems ? `<ul>${courseItems}</ul>` : "",
    facultyItems ? "<h2>Faculty directory</h2>" : "",
    facultyItems ? `<ul>${facultyItems}</ul>` : "",
    '<nav aria-label="Course discovery"><a href="/">Home</a> ' +
      '<a href="/explore">Find a course</a> ' +
      '<a href="/tests">Mock tests</a> ' +
      '<a href="/terms">Terms</a> <a href="/privacy">Privacy</a></nav>',
    "</main>",
  ].join("");
}

/** Crawler-readable equivalent of the canonical React faculty directory. */
export function renderFacultyDirectoryBody(meta, faculty = []) {
  const items = faculty
    .filter((person) => person?.slug && person?.display_name)
    .map((person) => {
      const count = Number(person.course_count ?? 0);
      const institute = person.institutes ? ` — ${escapeHtml(person.institutes)}` : "";
      return `<li><a href="/faculty/${encodeURIComponent(person.slug)}">` +
        `${escapeHtml(person.display_name)}</a>${institute}` +
        ` (${count} linked course${count === 1 ? "" : "s"})</li>`;
    })
    .join("");

  if (!items) return renderLandingBody("/faculty", meta);
  return [
    "<main>",
    '<nav aria-label="Breadcrumb"><a href="/">Home</a> - <span>Faculty</span></nav>',
    "<h1>Find courses by faculty</h1>",
    `<p>${escapeHtml(meta.description)}</p>`,
    "<h2>Faculty directory</h2>",
    `<ul>${items}</ul>`,
    '<nav aria-label="Course discovery"><a href="/browse">Browse all courses</a> ' +
      '<a href="/search">Search the library</a></nav>',
    "</main>",
  ].join("");
}

/**
 * Crawler-readable body for /tests. Names every exam section, and for the
 * ones that have a source, the real outbound link — so an AI crawler can
 * answer "where can I take a free JEE Main mock test" from this HTML alone.
 *
 * Empty sections are stated as empty rather than omitted. A crawler that
 * inferred "this site covers NEET tests" from a heading with nothing under
 * it would be repeating a claim the page does not make.
 */
export function renderTestsBody(meta) {
  const items = TEST_SECTIONS.map((s) => {
    // The exam name is a real link to its own page: this is the hub, and a
    // crawler that cannot run JavaScript still needs a path to all six.
    const label =
      `<a href="/tests/${escapeHtml(s.id)}">${escapeHtml(s.label)}</a>`;
    if (!s.resources.length) {
      return `<li>${label}: no test source listed yet.</li>`;
    }
    const links = s.resources
      .map(
        (r) =>
          `<a href="${escapeHtml(r.url)}" rel="nofollow noopener">${escapeHtml(r.name)}</a>` +
          ` (${escapeHtml(r.provider)}` +
          // The cost travels with the link. A model answering "free JEE mock
          // test?" from this HTML must not recommend the paid series as free.
          `${ACCESS[r.access] ? ` — ${escapeHtml(ACCESS[r.access].label)}` : ""})`,
      )
      .join(", ");
    return `<li>${label}: ${links}</li>`;
  }).join("");

  return [
    "<main>",
    "<h1>Mock tests</h1>",
    `<p>${escapeHtml(meta.description)}</p>`,
    // Stated in the served HTML, not only after React runs: a model
    // summarising this page must not tell a student the tests are taken here.
    "<p>JEENEETARD does not conduct these tests or store marks, and is not" +
      " affiliated with the organisations listed. Each link opens the platform" +
      " that runs the test.</p>",
    `<ul>${items}</ul>`,
    '<nav aria-label="Course discovery">',
    '<a href="/">Home</a> <a href="/explore">Find a course</a> ',
    '<a href="/browse">Browse courses</a>',
    "</nav>",
    "</main>",
  ].join("");
}

/**
 * Crawler-readable body for ONE exam's page (/tests/:examId). Names the
 * exam, then every source with its provider, cost and real outbound link,
 * so a model can answer "where can I take a free NEET mock test" from this
 * HTML alone — the whole reason these pages were split per exam.
 */
export function renderExamTestsBody(section, meta) {
  const label = escapeHtml(section.label);
  const items = section.resources
    .map(
      (r) =>
        `<li><a href="${escapeHtml(r.url)}" rel="nofollow noopener">${escapeHtml(r.name)}</a>` +
        ` — ${escapeHtml(r.provider)}` +
        `${ACCESS[r.access] ? ` (${escapeHtml(ACCESS[r.access].label)})` : ""}` +
        `${r.official ? " (official)" : ""}. ${escapeHtml(r.description)}` +
        // The click path matters most to a model answering "where do I find
        // the JEE Advanced PYQs" — without it the answer stops at a dashboard.
        `${r.findIt ? ` Find it: ${escapeHtml(r.findIt)}` : ""}</li>`,
    )
    .join("");

  const others = TEST_SECTIONS.filter((s) => s.id !== section.id)
    .map(
      (s) =>
        `<a href="/tests/${escapeHtml(s.id)}">${escapeHtml(s.label)}</a>`,
    )
    .join(" ");

  return [
    "<main>",
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/tests">Mock tests</a> › <span>${label}</span></nav>`,
    `<h1>${label} mock tests</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    // No "each link opens the platform…" here: the description already ends
    // with that sentence, and repeating it verbatim two lines apart is the
    // kind of duplication a model will quote back as padding.
    "<p>JEENEETARD does not conduct these tests or store marks, and is not" +
      " affiliated with the organisations listed.</p>",
    items
      ? `<ul>${items}</ul>`
      : `<p>No ${label} test source is listed yet.</p>`,
    `<nav aria-label="Other exams">${others}</nav>`,
    "</main>",
  ].join("");
}

/** Honest crawler-readable content for responses that carry HTTP 404. */
export function renderNotFoundBody(pathname, heading = "Page not found") {
  return [
    "<main>",
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(`No page exists at ${pathname}. The link may be out of date or contain a typo.`)}</p>`,
    '<nav aria-label="Course discovery">',
    '<a href="/explore">Find a course</a> ',
    '<a href="/browse">Browse courses</a> ',
    '<a href="/search">Search the library</a>',
    "</nav>",
    "</main>",
  ].join("");
}

// ---------------------------------------------------------------------------
// Structured data + server-rendered content.
//
// WHY: the app is client-rendered, so a crawler that does not execute
// JavaScript receives `<div id="root">` containing only a loading skeleton —
// no text and no JSON-LD. Googlebot renders JS and copes; the AI crawlers
// (GPTBot, ClaudeBot, PerplexityBot, …) largely do not, so the catalogue was
// invisible to them. These helpers put the same facts into the served HTML.
//
// This is NOT cloaking: the identical HTML is served to every user agent, and
// it states exactly what the rendered page states. React's createRoot() clears
// the container on mount, so the block is replaced rather than duplicated.
// ---------------------------------------------------------------------------

/** Schemas for a course page, built with the SAME builders the client uses so
 *  server and client can never disagree. Returns [{key, schema}]. */
export function courseSchemas(course, meta) {
  const out = [];
  const schema = courseSchema({
    title: course.title,
    description: meta.description,
    institute: course.institutes_channels?.name ?? null,
    teacher: course.teacher ?? null,
    averageRating: course.average_rating,
    ratingsCount: course.ratings_count,
    url: meta.url,
  });
  if (schema) out.push({ key: "Course", schema });

  const crumbs = breadcrumbListSchema([
    { label: "Home", url: "/" },
    { label: "Browse courses", url: "/browse" },
    { label: course.title, url: meta.url },
  ]);
  if (crumbs) out.push({ key: "BreadcrumbList", schema: crumbs });
  return out;
}

const verifiedAliases = (profile) => (profile?.aliases ?? [])
  .map((item) => typeof item === "string" ? { alias: item, status: "verified" } : item)
  .filter((item) => item?.status === "verified")
  .map((item) => item.alias)
  .filter((alias) => alias && alias !== profile?.display_name);

export function facultySchemas(profile, meta, guide = getFacultyGuide(profile?.slug)) {
  const person = personSchema({
    name: profile?.display_name,
    url: meta?.canonicalPath,
    description: guide?.summary || profile?.bio,
    image: profile?.photo_url,
    aliases: verifiedAliases(profile),
    institutes: profile?.institutes,
    sameAs: guide?.sameAs,
  });
  const crumbs = breadcrumbListSchema([
    { label: "Home", url: "/" },
    { label: "Faculty", url: "/faculty" },
    { label: profile?.display_name, url: meta?.canonicalPath },
  ]);
  return [
    person && { key: "Person", schema: person },
    crumbs && { key: "BreadcrumbList", schema: crumbs },
  ].filter(Boolean);
}

export function exploreSchemas(crumbs, options, guide, url) {
  const breadcrumb = breadcrumbListSchema(crumbs);
  const list = itemListSchema((options ?? []).map((option, index) => ({
    title: option.name,
    url: option.url,
    position: index + 1,
  })));
  const learningResource = learningResourceSchema({ guide, url });
  return [
    breadcrumb && { key: "BreadcrumbList", schema: breadcrumb },
    list && { key: "ItemList", schema: list },
    learningResource && { key: "LearningResource", schema: learningResource },
  ].filter(Boolean);
}

/**
 * Insert JSON-LD before </head>. Each script carries the same
 * `data-schema-key` the client upserts on (PageMetadata.jsx keys by @type), so
 * on hydration the client REUSES these elements instead of adding duplicates.
 */
export function injectStructuredData(html, schemas = []) {
  if (!schemas.length) return html;
  const tags = schemas
    .map(({ key, schema }) =>
      `<script type="application/ld+json" data-schema-key="${escapeHtml(key)}">` +
      `${safeStructuredDataJson(schema)}</script>`)
    .join("\n    ");
  return html.replace(/<\/head>/, () => `    ${tags}\n  </head>`);
}

/** Plain, factual HTML for a course — what an extractive crawler should read. */
export function renderCourseBody(course, meta, lessons = []) {
  const t = escapeHtml(course.title);
  // The edge query intentionally caps the rendered lesson-title preview at
  // 60 rows, but playlist_videos(count) still carries the true course total.
  // Report that total instead of making a 75-lesson course look like it has
  // only the 60 titles included in the crawler-readable preview.
  const totalLessons = Number(course.playlist_videos?.[0]?.count ?? lessons.length);
  const rows = [
    course.subjects?.name ? ["Subject", course.subjects.name] : null,
    course.teacher ? ["Teacher", course.teacher] : null,
    course.institutes_channels?.name ? ["Channel", course.institutes_channels.name] : null,
    totalLessons > 0 ? ["Lessons", String(totalLessons)] : null,
  ].filter(Boolean);

  const lessonItems = lessons
    .map((l) => `<li>${escapeHtml(l)}</li>`)
    .join("");

  return [
    `<main>`,
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/browse">Browse courses</a> › <span>${t}</span></nav>`,
    `<h1>${t}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    rows.length
      ? `<dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>`
      : "",
    lessonItems ? `<h2>Lessons in this course</h2><ol>${lessonItems}</ol>` : "",
    `<p><a href="${escapeHtml(meta.url)}">Open this free course on JEENEETARD</a></p>`,
    `</main>`,
  ].join("");
}

export function renderFacultyBody(profile, meta, guide = getFacultyGuide(profile?.slug)) {
  const name = escapeHtml(profile.display_name);
  const aliases = verifiedAliases(profile);
  const institutes = (profile.institutes ?? []).filter(Boolean);
  const courses = (profile.courses ?? []).filter((course) => course?.playlist_id && course?.title);
  const courseItems = courses.map((course) => {
    const details = [course.subject, course.role && course.role !== "instructor" ? course.role : null]
      .filter(Boolean)
      .map(escapeHtml)
      .join(" - ");
    return `<li><a href="/course/${encodeURIComponent(course.playlist_id)}">` +
      `${escapeHtml(course.title)}</a>${details ? ` (${details})` : ""}</li>`;
  }).join("");
  const facts = (guide?.facts ?? []).map((fact) =>
    `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`,
  ).join("");
  const sources = (guide?.sources ?? []).map((source) =>
    `<li><a href="${escapeHtml(source.href)}" rel="noopener">` +
      `${escapeHtml(source.label)}</a></li>`,
  ).join("");
  const sourceBackedProfile = guide ? [
    '<section id="source-backed-profile">',
    "<h2>Source-backed profile</h2>",
    `<p>${escapeHtml(guide.summary)}</p>`,
    facts ? `<dl>${facts}</dl>` : "",
    sources ? `<h3>Primary sources</h3><ul>${sources}</ul>` : "",
    `<p>Sources checked ${escapeHtml(guide.sourceChecked)}.</p>`,
    "</section>",
  ].join("") : "";

  return [
    "<main>",
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> - ` +
      `<a href="/faculty">Faculty</a> - <span>${name}</span></nav>`,
    `<h1>${name}</h1>`,
    profile.verified ? "<p>Verified faculty profile.</p>" : "",
    aliases.length ? `<p>Also known as ${aliases.map(escapeHtml).join(", ")}</p>` : "",
    institutes.length ? `<p>Institutes: ${institutes.map(escapeHtml).join(", ")}</p>` : "",
    sourceBackedProfile || (profile.bio
      ? `<p>${escapeHtml(profile.bio)}</p>`
      : `<p>${escapeHtml(meta.description)}</p>`),
    `<h2>Courses taught by ${name}</h2>`,
    courseItems ? `<ul>${courseItems}</ul>` : "<p>No linked courses are currently listed.</p>",
    '<p><a href="/faculty">Browse all faculty</a> <a href="/browse">Browse all free courses</a></p>',
    "</main>",
  ].join("");
}

export function renderExploreBody({ heading, meta, crumbs, options, emptyMessage, guide }) {
  const breadcrumb = crumbs.map((crumb, index) => {
    const label = escapeHtml(crumb.label);
    return index === crumbs.length - 1
      ? `<span>${label}</span>`
      : `<a href="${escapeHtml(crumb.url)}">${label}</a>`;
  }).join(" - ");
  const items = options.map((option) => {
    const count = Number(option.count ?? 0);
    return `<li><a href="${escapeHtml(option.url)}">${escapeHtml(option.name)}</a>` +
      `${count > 0 ? ` (${count} course${count === 1 ? "" : "s"})` : ""}</li>`;
  }).join("");

  return [
    "<main>",
    breadcrumb ? `<nav aria-label="Breadcrumb">${breadcrumb}</nav>` : "",
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    items ? `<ul>${items}</ul>` : `<p>${escapeHtml(emptyMessage ?? "No courses are available for this selection yet.")}</p>`,
    guide ? renderSubjectGuide(guide) : "",
    '<p><a href="/browse">Browse all courses</a></p>',
    "</main>",
  ].join("");
}

export function renderSubjectGuide(guide) {
  const sections = guide.sections.map((section) => {
    const items = section.items
      ? `<ol>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
      : "";
    const paragraphs = (section.paragraphs ?? [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    return `<section><h3>${escapeHtml(section.title)}</h3>${items}${paragraphs}</section>`;
  }).join("");
  const sources = guide.sources.map((source) =>
    `<li><a href="${escapeHtml(source.href)}">${escapeHtml(source.label)}</a></li>`,
  ).join("");

  return [
    '<article id="subject-guide" aria-labelledby="subject-guide-title">',
    `<p>${escapeHtml(guide.label)}</p>`,
    `<h2 id="subject-guide-title">${escapeHtml(guide.title)}</h2>`,
    ...guide.introduction.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    sections,
    "<section><h3>Check the current official sources</h3>",
    `<ul>${sources}</ul><p>Sources checked ${escapeHtml(guide.sourceChecked)}.</p></section>`,
    '<p><a href="/methodology">How JEENEETARD classifies and checks courses</a></p>',
    "</article>",
  ].join("");
}

/**
 * Replace whatever the shell put inside `<div id="root">` (a loading skeleton)
 * with server-rendered content. Falls back to returning the html untouched if
 * the container is not found, so a shell change can never blank the page.
 */
export function injectRootContent(html, inner) {
  if (!inner) return html;
  // Index-based, not regex: the container holds NESTED divs (the boot
  // skeleton), so a lazy match would stop at the first inner </div>, and the
  // source shell has a <script> before </body> while the built one does not.
  // Taking the last </div> before </body> is correct for both.
  const open = html.match(/<div id="root"[^>]*>/);
  if (!open) return html;
  const start = html.indexOf(open[0]) + open[0].length;
  const bodyClose = html.lastIndexOf("</body>");
  if (bodyClose === -1) return html;
  const end = html.lastIndexOf("</div>", bodyClose);
  if (end === -1 || end < start) return html;
  return html.slice(0, start) + inner + html.slice(end);
}
