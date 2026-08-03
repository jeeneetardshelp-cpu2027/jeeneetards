// ogInject.js — pure helpers for per-course <head> metadata.
//
// Shared by the Vercel Edge middleware (middleware.js) and its local test
// (src/scripts/testCourseMeta.js). The helpers have no side effects or
// browser-only assumptions — just data and strings in, strings out — so the
// exact logic that ships can be exercised under plain Node first.

import {
  courseSchema,
  breadcrumbListSchema,
  websiteSchema,
  organizationSchema,
  safeStructuredDataJson,
} from "./src/structuredData.js";

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
      links: [["Home", "/"], ["Browse all courses", "/browse"]],
    },
  };
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
