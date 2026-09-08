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
import { courseCredit } from "./src/courseCredit.js";
// The exactly-one-slugged-teacher rule, shared with usePlaylistBrowse.js and
// usePlaylistVideos.js so every surface links, or refuses to link, the same set.
import { courseTeacherSlug } from "./src/courseTeacherSlug.js";
// Pure data, no React — safe to pull into the edge runtime.
import { TEST_SECTIONS, ACCESS, findTestSection } from "./src/testPlatforms.js";
import { buildCourseMetadata } from "./src/courseMetadata.js";
import { canonicalCoursePath } from "./src/canonicalUrl.js";
import { readablePathSegment } from "./src/pageMetadata.js";
import {
  paperYearSchemas,
  studyMaterialLandingSchemas,
  studyMaterialsPageSchemas,
} from "./src/studyMaterialsStructuredData.js";
import {
  PAPER_LANDINGS,
  findPaperLanding,
  paperYearMeta,
  paperYearPath,
  paperYears,
  parsePaperYearPath,
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
    // The canonical address carries the title as keywords: /course/398/kinematics.
    // canonicalUrl.js is the one place that decides that shape, so the og:url,
    // the <link rel="canonical">, the 308 the edge issues and the sitemap entry
    // are all the same string by construction. A title with no ASCII to slugify
    // (the catalogue's Devanagari courses) falls back to the bare /course/398.
    url: `${SITE}${canonicalCoursePath(id, course?.title)}`,
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
  const paperLanding = findPaperLanding(pathname);
  const paperYear = parsePaperYearPath(pathname);
  const schemas = pathname === "/materials"
    ? studyMaterialsPageSchemas(materials)
    : paperLanding
      ? studyMaterialLandingSchemas(materials, paperLanding)
      : paperYear
        ? paperYearSchemas(materials, paperYear)
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
const STUDY_RESOURCE_NAV =
  '<nav aria-label="Study resources"><a href="/materials">All study material</a> ' +
  '<a href="/explore">Find a course</a> ' +
  '<a href="/tests">Mock tests</a> ' +
  '<a href="/methodology">How resources are curated</a></nav>';

/** One <li> per reviewed material, linking the recorded source. */
function renderMaterialItems(collection) {
  return collection
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
}

/** Only approved records with an https source are ever rendered. */
const publicMaterials = (materials) => materials
  .filter((material) => material?.title &&
    /^https:\/\//i.test(material.sourceUrl ?? material.source_url ?? ""));

// Column-first, like the rest of the paper classification since the metadata
// migration was applied (2026-09-02): paper_year is the backfilled truth, the
// old examYear fields remain as fallback for rows that predate the columns.
const paperYearOf = (material) => {
  const year = Number(
    material?.paperYear ?? material?.paper_year ??
    material?.examYear ?? material?.exam_year,
  );
  return Number.isFinite(year) ? year : null;
};

export function renderStudyMaterialsBody(meta, materials = []) {
  const safeMaterials = publicMaterials(materials);
  const landing = findPaperLanding(meta.canonicalPath);
  // Group a paper collection by year, with each year's heading linking to that
  // year's own page — the landing's job is to send a crawler INTO its children,
  // not to be the only page on the site that ranks.
  const renderYearGroups = (collection) => {
    const byYear = new Map();
    for (const material of collection) {
      const year = paperYearOf(material);
      const label = year == null ? "Year not listed" : String(year);
      if (!byYear.has(label)) byYear.set(label, []);
      byYear.get(label).push(material);
    }
    return [...byYear.entries()]
      .sort(([yearA], [yearB]) => {
        if (yearA === "Year not listed") return 1;
        if (yearB === "Year not listed") return -1;
        return Number(yearB) - Number(yearA);
      })
      .map(([year, collectionForYear]) => {
        const heading = year === "Year not listed" || !landing
          ? escapeHtml(year)
          : `<a href="${escapeHtml(paperYearPath(landing, year))}">${escapeHtml(year)}</a>`;
        return `<section><h3>${heading}</h3>` +
          `<ul>${renderMaterialItems(collectionForYear)}</ul></section>`;
      })
      .join("");
  };

  if (!safeMaterials.length) return renderLandingBody(meta.canonicalPath || "/materials", meta);
  if (!landing) {
    return [
      "<main>",
      '<nav aria-label="Breadcrumb"><a href="/">Home</a> - <span>Study material</span></nav>',
      `<h1>${escapeHtml("Find study material by your syllabus.")}</h1>`,
      `<p>${escapeHtml(meta.description)}</p>`,
      "<h2>Reviewed resources</h2>",
      `<ul>${renderMaterialItems(safeMaterials)}</ul>`,
      STUDY_RESOURCE_NAV,
      "</main>",
    ].join("");
  }

  const exam = landing.examLabel;
  const groups = splitJeeMainPapers(safeMaterials);
  const years = paperYears(safeMaterials);
  const yearLinks = years
    .map((year) => `<a href="${escapeHtml(paperYearPath(landing, year))}">` +
      `${escapeHtml(`${exam} ${year}`)}</a>`)
    .join(" ");
  const answerKeyItems = renderYearGroups(groups.answerKeys);
  const solutionItems = renderYearGroups(groups.withSolutions);
  return [
    "<main>",
    '<nav aria-label="Breadcrumb"><a href="/">Home</a> - ' +
      `<a href="/materials">Study material</a> - <span>${escapeHtml(landing.crumbLabel)}</span></nav>`,
    `<h1>${escapeHtml(landing.meta.heading)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    yearLinks
      ? `<nav aria-label="${escapeHtml(`${exam} papers by year`)}">${yearLinks}</nav>`
      : "",
    `<h2>${escapeHtml(`${exam} question papers`)}</h2>`,
    renderYearGroups(groups.questionOnly),
    `<h2>${escapeHtml(`${exam} official answer keys`)}</h2>`,
    answerKeyItems ||
      "<p>No official final answer keys are listed yet. Provisional keys are excluded.</p>",
    `<h2>${escapeHtml(`${exam} papers with solutions`)}</h2>`,
    solutionItems ||
      "<p>No reviewed papers with worked solutions are listed yet. Official answer keys are not labelled as worked solutions.</p>",
    STUDY_RESOURCE_NAV,
    "</main>",
  ].join("");
}

/**
 * Crawler-readable body for ONE exam year, e.g. JEE Main 2024.
 *
 * The leaf of the paper tier: every reviewed paper for that year, grouped by
 * what it actually contains, with the recorded source link. The PDF is the
 * resource at this level, so this is where those outbound links belong.
 */
export function renderPaperYearBody(meta, { landing, year }, materials = []) {
  const safeMaterials = publicMaterials(materials);
  const groups = splitJeeMainPapers(safeMaterials);
  const exam = landing.examLabel;
  const section = (heading, collection, empty) => [
    `<h2>${escapeHtml(heading)}</h2>`,
    collection.length ? `<ul>${renderMaterialItems(collection)}</ul>` : `<p>${escapeHtml(empty)}</p>`,
  ].join("");

  return [
    "<main>",
    '<nav aria-label="Breadcrumb"><a href="/">Home</a> - ' +
      '<a href="/materials">Study material</a> - ' +
      `<a href="${escapeHtml(landing.path)}">${escapeHtml(landing.crumbLabel)}</a> - ` +
      `<span>${escapeHtml(String(year))}</span></nav>`,
    `<h1>${escapeHtml(paperYearMeta(landing, year).heading)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    section(
      `${exam} ${year} question papers`,
      groups.questionOnly,
      `No question-only ${exam} ${year} paper is listed yet.`,
    ),
    section(
      `${exam} ${year} official answer keys`,
      groups.answerKeys,
      `No official final answer key is listed for ${exam} ${year}. Provisional keys are excluded.`,
    ),
    section(
      `${exam} ${year} papers with solutions`,
      groups.withSolutions,
      "No reviewed paper with worked solutions is listed for this year. Official answer keys are not labelled as worked solutions.",
    ),
    `<nav aria-label="${escapeHtml(`All ${exam} papers`)}">` +
      `<a href="${escapeHtml(landing.path)}">${escapeHtml(`All ${exam} papers by year`)}</a> ` +
      '<a href="/materials">All study material</a> ' +
      '<a href="/tests">Mock tests</a></nav>',
    "</main>",
  ].join("");
}

/** The canonical Browse response already renders every course link as HTML.
 *  Describe that same ordered directory for non-JavaScript crawlers; the
 *  client replaces this ItemList with the currently visible page on hydrate. */
/**
 * Structured data for a chapter landing — /browse with a confirmed chapter.
 *
 * These are 204 of the 879 URLs in the sitemap and the only surface this site
 * has that YouTube does not: every free course covering one chapter, side by
 * side. They shipped with no structured data at all, so a crawler saw an
 * ordinary page at a URL that reads
 * "/browse?goal=jee&class=11&subject=physics&chapter=kinematics" — a raw query
 * string, which is what Google prints in the result unless a BreadcrumbList
 * tells it the hierarchy.
 *
 * WHAT IS NOT HERE, and why. No ItemList of the courses. The edge holds the
 * chapter's name and its verified count, but not the course titles: the
 * directory fetch runs only for a bare /browse. Listing them would need the
 * page's own goal/class/subject filter rebuilt at the edge, and a chapter-only
 * join is not that filter — measured against production, chapter "kinematics"
 * joins 22 distinct courses while the page for JEE Class 11 Physics says 13.
 * An ItemList of 22 under a title saying 13 is worse than no ItemList, so this
 * asserts only the count that was confirmed by the same row the title came
 * from.
 *
 * @param scope   { goal, board, cls, subject } straight off the URL
 * @param chapter { name, courseCount } the CONFIRMED row, never the slug
 * @param meta    the route metadata already computed for this page
 * @param canonicalPath the page's own canonical path, absolutised here
 */
export function chapterLandingSchemas({ scope, chapter, meta, canonicalPath } = {}) {
  const name = String(chapter?.name ?? "").trim();
  if (!scope?.goal || !name || !canonicalPath) return [];
  const canonicalUrl = `${SITE}${canonicalPath}`;

  const goalLabel = readablePathSegment(scope.board || scope.goal);
  const crumbs = [
    { label: "Home", url: "/" },
    { label: "Explore", url: "/explore" },
    { label: goalLabel, url: `/explore/${encodeURIComponent(scope.goal)}` },
  ];

  // The deeper explore taxonomy exists for the exam goals and not for school,
  // which is addressed by BOARD instead — /explore/school/class-10/science
  // redirects back up to /explore/school. A school chapter URL is exactly the
  // one carrying a board, so that is the test, rather than a hardcoded list of
  // goals that would drift the first time one is added.
  const deep = !scope.board;
  if (deep && scope.cls) {
    const stage = scope.cls === "dropper" ? "dropper" : `class-${scope.cls}`;
    crumbs.push({
      label: scope.cls === "dropper" ? "Dropper" : `Class ${scope.cls}`,
      url: `/explore/${encodeURIComponent(scope.goal)}/${encodeURIComponent(stage)}`,
    });
    if (scope.subject) {
      crumbs.push({
        label: readablePathSegment(scope.subject),
        url: `/explore/${encodeURIComponent(scope.goal)}/${encodeURIComponent(stage)}`
          + `/${encodeURIComponent(scope.subject)}`,
      });
    }
  }
  crumbs.push({ label: name, url: canonicalUrl });

  const breadcrumb = breadcrumbListSchema(crumbs);
  const count = Number(chapter?.courseCount ?? 0);

  const page = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: meta?.title ?? name,
    url: canonicalUrl,
    about: { "@type": "Thing", name },
  };
  if (meta?.description) page.description = meta.description;
  // numberOfItems without itemListElement is deliberate: the count is verified,
  // the titles are not available here. Saying how many without saying which is
  // the honest half.
  if (count > 0) {
    page.mainEntity = { "@type": "ItemList", numberOfItems: count };
  }

  const out = [];
  if (breadcrumb) out.push({ key: "BreadcrumbList", schema: breadcrumb });
  out.push({ key: "CollectionPage", schema: page });
  return out;
}

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
        "Formula sheets, full lecture notes and previous-year papers—organised by exam, class, subject and chapter.",
      links: [
        ["Find a course", "/explore"],
        ["Mock tests", "/tests"],
        ["How resources are curated", "/methodology"],
      ],
    },
    // One fallback body per registered paper landing (JEE Main, JEE Advanced,
    // NEET), built from the same registry the live page renders from, so the
    // crawler-visible heading and honest coverage wording can never drift.
    ...Object.fromEntries(PAPER_LANDINGS.map((landing) => [landing.path, {
      heading: landing.meta.heading,
      description: landing.meta.description,
      links: [
        ["All study material", "/materials"],
        ["Mock tests", "/tests"],
        ["How resources are curated", "/methodology"],
      ],
    }])),
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
    // The claim-free body for /polls. renderPollsBody falls back to this
    // whenever the poll feed was not confirmed, so the page still has a real
    // <h1> and a crawl path without asserting anything about what is open.
    "/polls": {
      heading: "Student polls",
      description: meta.description,
      links: [["Student forum", "/forum"], ["Browse courses", "/browse"], ["Home", "/"]],
    },
    // Sitemap-advertised as index, follow while serving the boot shell and
    // nothing else, exactly like /polls. A blurb rather than a list of threads
    // on purpose — but NOT because threads are private: ForumPublicNotice tells
    // every poster that posts "can be read by anyone and may be indexed by
    // search engines", and each thread already has its own indexable URL at
    // /forum/post/:id with its own title. The landing does not need to reprint
    // them. What it does need is the sentence the React page shows a visitor
    // who cannot post, so the served HTML never issues an invitation the app
    // will not honour (ForumFeedPage.jsx, readOnlyBeta).
    "/forum": {
      heading: "Student preparation forum",
      description: meta.description,
      note: "Closed beta: only invited student testers can publish."
        + " Everyone can still read visible discussions.",
      links: [["Browse courses", "/browse"], ["Student polls", "/polls"], ["Home", "/"]],
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
    // Optional second sentence for a page whose description alone would
    // promise more than the page delivers.
    page.note ? `<p>${escapeHtml(page.note)}</p>` : "",
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
  // The title is right here, so the link is the course's canonical slugged
  // address rather than the bare id a crawler would have to follow a 308 from.
  // canonicalCoursePath escapes the id and returns the id-only path for a title
  // with no ASCII, so this is exactly what the sitemap lists for the same row.
  const courseItems = courses
    .filter((course) => course?.id && course?.title)
    .map((course) =>
      `<li><a href="${escapeHtml(canonicalCoursePath(course.id, course.title))}">` +
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
 * Crawler-readable body for /polls.
 *
 * The page was in the sitemap as index, follow while serving the boot shell
 * and nothing else — 5,721 bytes with no <h1> — so every live poll had no
 * crawl path at all. Found by an audit on 2026-09-03; /browse, /materials and
 * /tests all had bodies and this one was simply never written.
 *
 * A list, like /tests, not a blurb: the useful fact is which questions are
 * open and where each one lives. Built from the rows the feed actually
 * returned, so this HTML cannot advertise a poll the page does not show.
 *
 * THREE states, not two, and the third is the one that bit us:
 *
 *   rows returned    -> list them
 *   confirmed empty  -> "No poll is open right now" is a fact we checked
 *   never confirmed  -> say NOTHING about what is open
 *
 * `polls` is an array ONLY when the lookup succeeded. Anything else — null
 * from a timeout, a 500, or an edge with no Supabase env — is unconfirmed, and
 * collapsing that into the empty state would state "no poll is open" on the
 * strength of a query that never ran, while polls are live. The edge caches
 * this HTML with s-maxage=3600 + stale-while-revalidate=86400, so one 1.5s
 * blip would pin that falsehood at the CDN for up to a day. The landing blurb
 * is true whatever the feed would have said, so that is what an unconfirmed
 * lookup gets — the rule renderStudyMaterialsBody and renderFacultyDirectoryBody
 * already follow, and the one middleware.js's own paperYearResponse follows
 * when it refuses to render at all on `!confirmed`.
 */
export function renderPollsBody(meta, polls) {
  if (!Array.isArray(polls)) return renderLandingBody("/polls", meta);

  const items = polls
    .filter((p) => p && p.slug && p.question)
    .map((p) => {
      const votes = Number(p.vote_count ?? 0);
      // The count travels with the question. A model summarising this page
      // should not present a poll nobody has answered as a settled result.
      const tally = votes === 1 ? "1 vote so far" : `${votes} votes so far`;
      // get_polls_feed returns status in ('live','closed'), and the status it
      // returns is the EFFECTIVE one — a poll past its closes_at already reads
      // "closed" — so closed polls sit in these rows indefinitely. The human
      // card shows a "Closed" pill and disables voting (src/polls/PollCard.jsx);
      // without this the crawler body would invite a student to answer a poll
      // that is over, and the two renderings of one row would disagree.
      const state = p.status === "closed" ? `${tally} (voting closed)` : tally;
      return `<li><a href="/polls/${escapeHtml(p.slug)}">${escapeHtml(p.question)}</a> — ${escapeHtml(state)}</li>`;
    })
    .join("");

  // Rows came back but none survived the slug/question filter: that is
  // malformed data, not an empty feed, so it cannot claim emptiness either.
  if (!items && polls.length > 0) return renderLandingBody("/polls", meta);

  return [
    "<main>",
    "<h1>Student polls</h1>",
    `<p>${escapeHtml(meta.description)}</p>`,
    // Said in the served HTML, not only after React runs: these are opinions
    // students volunteered, not a survey and not advice.
    "<p>Each poll is a question students answer about their own preparation." +
      " Reading a poll and its results never needs an account; voting and" +
      " commenting do. The results are what students chose, not a" +
      " recommendation from JEENEETARD.</p>",
    items
      ? `<ul>${items}</ul>`
      : "<p>No poll is open right now.</p>",
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

/** The one /faculty destination a course's teacher credit may carry, or null.
 *
 *  `faculty` is the LEFT-joined `playlist_teachers(teachers(slug))` embed the
 *  edge adds to the course lookup, and courseTeacherSlug is the SAME rule the
 *  /browse cards and the watch page apply to it — exactly one slugged teacher
 *  or nothing at all, so this body and those two surfaces can never disagree
 *  about playlist 91. Everything else it decides (why two is null, why zero is
 *  null, why a slug is never derived from a name) is documented there.
 *
 *  An ABSENT `faculty` key reads exactly like zero links, which is what lets
 *  the capability gate drop the embed from the select — or a deployment
 *  without the faculty tables never send it — without this file having to
 *  know either happened. */
const courseFacultySlug = (course) => courseTeacherSlug(course?.faculty);

/** The one address for a faculty slug, as this file writes it into HTML.
 *
 *  encodeURIComponent is the identity function for every slug the registry
 *  actually holds ([a-z0-9-]), so the crawler's <a href>, the JSON-LD
 *  instructor.url and the client's <Link to> stay character-identical and
 *  read as ONE identity — the whole point of linking at all. It only bites
 *  on a malformed slug, and there it is doing the right thing: a stray `/`
 *  or `?` cannot turn a faculty link into some other address. escapeHtml on
 *  top is what makes it safe as an attribute value. */
const facultyHref = (slug) => `/faculty/${encodeURIComponent(slug)}`;

/** Schemas for a course page, built with the SAME builders the client uses so
 *  server and client can never disagree. Returns [{key, schema}]. */
export function courseSchemas(course, meta) {
  const out = [];
  const schema = courseSchema({
    title: course.title,
    description: meta.description,
    institute: course.institutes_channels?.name ?? null,
    teacher: course.teacher ?? null,
    // Resolved upstream and passed in — courseSchema builds instructor.url
    // from it, so the Person node this page publishes stops being a dangling
    // second identity for a human whose /faculty page the site already owns.
    // Null (no link, or two) simply omits the key, exactly as `provider` does.
    teacherSlug: courseFacultySlug(course),
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
  // /faculty/<slug> already lists that person's courses and links OUT to each
  // one (renderFacultyBody, below); the course body linked back to nothing, so
  // a crawler — and a reader with JavaScript off — met the teacher's name as a
  // dead end on the very page the profile points at. Null whenever the course
  // did not resolve to exactly one registered teacher, which keeps the 128
  // free-text-only credits, and the 134 credited to two or more people, as the
  // plain text they are today.
  const teacherSlug = courseFacultySlug(course);
  // Rows are [label, value] — plus, for the teacher alone, an optional href.
  const rows = [
    course.subjects?.name ? ["Subject", course.subjects.name] : null,
    // A "teacher" that is only the channel's own name would print the same
    // string on both rows of the crawler-readable table.
    //
    // The href hangs off this branch on purpose: a credit suppressed as a
    // duplicate of the Channel produces no row at all, so it cannot come back
    // as a link. The text stays the CREDIT the student sees ("ABJ Sir"), not
    // the registry's display_name — the link changes where the words go, never
    // what they say.
    courseCredit({
      teacher: course.teacher, institute: course.institutes_channels?.name,
    }).teacher
      ? ["Teacher", course.teacher, teacherSlug ? facultyHref(teacherSlug) : null]
      : null,
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
    // Every value is still escaped, and so is the href — the anchor adds a
    // destination, never an escape hatch. Only the teacher row supplies a
    // third element, so for every other row `href` is undefined and the
    // output is byte-for-byte what it was before.
    rows.length
      ? `<dl>${rows.map(([k, v, href]) => `<dt>${escapeHtml(k)}</dt><dd>` +
          (href
            ? `<a href="${escapeHtml(href)}">${escapeHtml(v)}</a>`
            : escapeHtml(v)) +
          `</dd>`).join("")}</dl>`
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

/**
 * The crawler-readable body for one chapter landing:
 * /browse?goal=…&class=…&subject=…&chapter=…
 *
 * Before this, a chapter URL fell through to renderLandingBody and got the
 * generic shell: an <h1> of "All courses" and one templated sentence. 380 of
 * these URLs are in the sitemap, so a crawler saw 380 near-identical pages
 * whose only difference was a substituted chapter name — under a heading that
 * contradicted their own <title>.
 *
 * The count comes from get_browse_curriculum, which is already goal-scoped, so
 * the number here is the number the student sees on the same URL. It is
 * rendered only when it is greater than zero, and the caller falls back to the
 * old body when the lookup does not confirm: a generic heading is honest, an
 * invented count is not.
 *
 * Siblings are the other chapters in the same subject, linked to the same
 * canonical shape. They are what turns 380 orphans into a connected set.
 */
export function renderChapterLandingBody({ meta, chapterName, courseCount, siblings = [] }) {
  const count = Number(courseCount ?? 0);
  const items = siblings.map((option) => {
    const n = Number(option.count ?? 0);
    return `<li><a href="${escapeHtml(option.url)}">${escapeHtml(option.name)}</a>` +
      `${n > 0 ? ` (${n} course${n === 1 ? "" : "s"})` : ""}</li>`;
  }).join("");

  return [
    "<main>",
    `<h1>${escapeHtml(chapterName)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    count > 0
      ? `<p>${count} course${count === 1 ? "" : "s"} on this site cover${count === 1 ? "s" : ""} this chapter.</p>`
      : "",
    items ? `<h2>Other chapters in this subject</h2><ul>${items}</ul>` : "",
    '<p><a href="/browse">Browse all courses</a></p>',
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
