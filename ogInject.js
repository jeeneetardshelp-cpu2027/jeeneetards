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
  personSchema,
  websiteSchema,
  organizationSchema,
  safeStructuredDataJson,
} from "./src/structuredData.js";
// Pure data, no React — safe to pull into the edge runtime.
import { TEST_SECTIONS, ACCESS, findTestSection } from "./src/testPlatforms.js";

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
  const subject = course?.subjects?.name || null;
  const lessons = course?.playlist_videos?.[0]?.count ?? null;
  const title = `${course.title} | JEENEETARD`;
  const parts = [
    "Free course",
    lessons ? `${lessons} lecture${lessons === 1 ? "" : "s"}` : null,
    subject,
    course.teacher ? `by ${course.teacher}` : null,
  ].filter(Boolean);
  const description = `${parts.join(" · ")}. No JEENEETARD advertisements or sponsored rankings; YouTube may show ads or same-channel recommendations.`;
  return {
    title,
    description,
    url: `${SITE}/course/${id}`,
    robots: "index, follow",
    type: "article",
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
  // Canonical: the shell deliberately ships WITHOUT one (a static canonical
  // would claim the homepage for every route). Replace it if an old shell
  // still has it, otherwise insert it next to <title> — which always exists.
  const canonicalTag = `<link rel="canonical" href="${u}" />`;
  return /<link rel="canonical"[^>]*>/.test(out)
    ? out.replace(/<link rel="canonical"[^>]*>/, () => canonicalTag)
    : out.replace(/<title>/, () => `${canonicalTag}\n    <title>`);
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
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta name="robots" content=")[^"]*(")/, (m, a, z) => `${a}${r}${z}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (m, a, z) => `${a}${u}${z}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, a, z) => `${a}${t}${z}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, a, z) => `${a}${d}${z}`);
  const canonicalTag = `<link rel="canonical" href="${u}" />`;
  return /<link rel="canonical"[^>]*>/.test(out)
    ? out.replace(/<link rel="canonical"[^>]*>/, () => canonicalTag)
    : out.replace(/<title>/, () => `${canonicalTag}\n    <title>`);
}

/** Homepage schemas use the same pure builders as Home.jsx. */
export function landingSchemas(pathname) {
  if (pathname !== "/") return [];
  return [
    { key: "WebSite", schema: websiteSchema() },
    { key: "Organization", schema: organizationSchema() },
  ];
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
        "Thousands of free lectures from India's best teachers, organised by syllabus so students can compare before choosing a course.",
      links: [["Find a course", "/explore"], ["Browse courses", "/browse"]],
    },
    "/browse": {
      heading: "All courses",
      description: meta.description,
      links: [["Home", "/"], ["Find a course", "/explore"]],
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
  };
  // /tests is a list, not a blurb: the useful facts for an extractive
  // crawler are which exams are covered and where each test actually lives.
  // Built from the same TEST_SECTIONS the React page renders, so the served
  // HTML can never claim a source the page does not show.
  if (pathname === "/tests") return renderTestsBody(meta);
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
        `${r.official ? " (official)" : ""}. ${escapeHtml(r.description)}</li>`,
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

export function facultySchemas(profile, meta) {
  const person = personSchema({
    name: profile?.display_name,
    url: meta?.canonicalPath,
    description: profile?.bio,
    image: profile?.photo_url,
    aliases: verifiedAliases(profile),
    institutes: profile?.institutes,
  });
  const crumbs = breadcrumbListSchema([
    { label: "Home", url: "/" },
    { label: "Browse courses", url: "/browse" },
    { label: profile?.display_name, url: meta?.canonicalPath },
  ]);
  return [
    person && { key: "Person", schema: person },
    crumbs && { key: "BreadcrumbList", schema: crumbs },
  ].filter(Boolean);
}

export function exploreSchemas(crumbs, options) {
  const breadcrumb = breadcrumbListSchema(crumbs);
  const list = itemListSchema((options ?? []).map((option, index) => ({
    title: option.name,
    url: option.url,
    position: index + 1,
  })));
  return [
    breadcrumb && { key: "BreadcrumbList", schema: breadcrumb },
    list && { key: "ItemList", schema: list },
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

export function renderFacultyBody(profile, meta) {
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

  return [
    "<main>",
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> - ` +
      `<a href="/browse">Browse courses</a> - <span>${name}</span></nav>`,
    `<h1>${name}</h1>`,
    profile.verified ? "<p>Verified faculty profile.</p>" : "",
    aliases.length ? `<p>Also known as ${aliases.map(escapeHtml).join(", ")}</p>` : "",
    institutes.length ? `<p>Institutes: ${institutes.map(escapeHtml).join(", ")}</p>` : "",
    profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : `<p>${escapeHtml(meta.description)}</p>`,
    `<h2>Courses taught by ${name}</h2>`,
    courseItems ? `<ul>${courseItems}</ul>` : "<p>No linked courses are currently listed.</p>",
    '<p><a href="/browse">Browse all free courses</a></p>',
    "</main>",
  ].join("");
}

export function renderExploreBody({ heading, meta, crumbs, options, emptyMessage }) {
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
    `<nav aria-label="Breadcrumb">${breadcrumb}</nav>`,
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    items ? `<ul>${items}</ul>` : `<p>${escapeHtml(emptyMessage ?? "No courses are available for this selection yet.")}</p>`,
    '<p><a href="/browse">Browse all courses</a></p>',
    "</main>",
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
