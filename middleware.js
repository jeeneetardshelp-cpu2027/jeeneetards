// middleware.js — Vercel Edge Middleware.
//
// The app is a client-rendered SPA: a course URL serves a generic HTML shell,
// so link-preview crawlers (WhatsApp, Telegram, iMessage, Facebook, ...) and
// search engines see the homepage title/description on every course. This
// middleware rewrites the <head> for a course URL to that course's own title
// and description before the HTML leaves the edge.
//
// It also owns the course's ADDRESS. A course lives at /course/:id/:slug, the
// slug being its title as keywords; the id is still the only part that resolves
// anything. Anything else — the bare /course/:id, a slug from an older title, a
// slug typed by hand — is permanently redirected here to that one address, so
// there is a single indexable URL per course and a link pasted into a WhatsApp
// group says what it is before the preview card loads.
//
// Injected for EVERY visitor (not only bots): serving crawlers different
// content than users is cloaking and is penalised. The SPA simply hydrates
// over the same HTML.
//
// FAIL-THROUGH is absolute: any missing env, lookup miss, slow query, or error
// falls back to next() — the normal shell — so a course page can never break.

import { next } from "@vercel/edge";
import { metadataForLocation, pollMetadataForQuestion, SITE_NAME } from "./src/pageMetadata.js";
import { findTestSection } from "./src/testPlatforms.js";
import { CLASS_LEVELS_BY_GOAL } from "./src/classLevels.js";
import {
  canonicalBrowseUrl,
  canonicalCoursePath,
  classSlugToStage,
  parseCoursePath,
} from "./src/canonicalUrl.js";
import { canonicalChapterView } from "./src/chapterLanding.js";
import { exploreStepHeading } from "./src/exploreHeading.js";
import { getSubjectGuide } from "./src/subjectGuides.js";
import {
  courseMeta,
  injectCourseMeta,
  injectRouteMeta,
  courseSchemas,
  injectStructuredData,
  renderCourseBody,
  facultySchemas,
  renderFacultyBody,
  exploreSchemas,
  renderExploreBody,
  injectRootContent,
  landingSchemas,
  browseDirectorySchemas,
  facultyDirectorySchemas,
  renderLandingBody,
  renderBrowseDirectoryBody,
  renderFacultyDirectoryBody,
  renderStudyMaterialsBody,
  renderNotFoundBody,
  renderPaperYearBody,
  renderChapterLandingBody,
} from "./ogInject.js";
import { getFacultyGuide } from "./src/facultyGuides.js";
import { RELEASE_CAPABILITIES } from "./src/releaseCapabilities.js";
import {
  PAPER_LANDINGS,
  findPaperLanding,
  parsePaperYearPath,
} from "./src/studyMaterialLandings.js";

// Inspect every application path so an unknown SPA URL can carry a real HTTP
// 404. Static assets bypass middleware entirely. Vercel matcher regex supports
// negative lookaheads; keep this list aligned with public/ and Vite's assets/.
export const config = {
  matcher: [
    "/((?!api/|assets/|fonts/|study-materials/|icons/|favicon\\.svg|robots\\.txt|sitemap\\.xml|llms\\.txt|social-preview\\.(?:png|svg)|theme-init\\.js|sw\\.js|manifest\\.webmanifest|index\\.html).*)",
  ],
};

/** One place for the HTML response shape (CDN caches the rendered variant). */
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": status === 404
        ? "public, max-age=0, s-maxage=60"
        : "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      ...(status === 404 ? { "x-robots-tag": "noindex, nofollow" } : {}),
    },
  });
}

const APP_SHELL_PATTERN = /<div\s+[^>]*id=["']root["'][^>]*>/i;

/**
 * Fetch the Vite shell from the same deployment without losing Vercel preview
 * authentication. Only same-origin protection context is forwarded; catalogue
 * credentials and unrelated request headers never leave their existing calls.
 *
 * A protected login page can still return HTTP 200. Treat any response without
 * the app's #root as untrusted shell HTML and fail through to Vercel's normal
 * routing rather than injecting metadata into the login page.
 */
export async function fetchAppShell(request) {
  const headers = new Headers();
  for (const name of ["cookie", "x-vercel-protection-bypass"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(new URL("/index.html", request.url), { headers });
  if (!response.ok) return null;
  const html = await response.text();
  return APP_SHELL_PATTERN.test(html) ? html : null;
}
const LOOKUP_TIMEOUT_MS = 1500;

const STATIC_APP_ROUTES = new Set([
  "/", "/admin", "/browse", "/compare", "/explore", "/privacy",
  "/faculty", "/forum", "/forum/submit", "/forum/username", "/materials", "/methodology", "/polls", "/polls/new", "/reset", "/search", "/signin", "/terms", "/tests",
  // Every registered paper landing (JEE Main, JEE Advanced, NEET) — the same
  // registry the router, sitemap and metadata read, so they cannot disagree.
  ...PAPER_LANDINGS.map((landing) => landing.path),
]);

/** Mirrors the route shapes in App.jsx. Resource existence is checked later. */
export function isSupportedAppPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (STATIC_APP_ROUTES.has(path)) return true;
  // Only REAL exam ids are supported. /tests/anything-else must carry a hard
  // 404 rather than render an empty page — TEST_SECTIONS is the same list the
  // router resolves against, so the two can never disagree.
  if (path.startsWith("/tests/")) {
    return Boolean(findTestSection(path.slice("/tests/".length)));
  }
  if (path.startsWith("/explore/")) return Boolean(parseExplorePath(path));
  // A per-year paper page, e.g. /materials/jee-main/previous-year-papers/2024.
  // Only a real four-digit year under a registered landing; whether that year
  // actually HAS papers is confirmed against the database further down.
  if (parsePaperYearPath(path)) return true;
  if (/^\/forum\/post\/\d+$/.test(path)) return true;
  // A poll slug is question-slug + "-" + id, so it always ends in a number.
  // Requiring that here means a mistyped or invented /polls/... link gets a
  // real 404 instead of an empty shell — and it keeps /polls/new, which has
  // no trailing id, resolving through STATIC_APP_ROUTES above.
  if (/^\/polls\/[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(path)) return true;
  if (/^\/faculty\/[^/]+$/.test(path)) return true;
  if (/^\/chapter\/\d+$/.test(path)) return true;
  // Every /course shape the site answers, including a slug that is wrong or
  // stale. Those are NOT 404s: the id resolves the course and the response
  // below is a 308 to the canonical address, so a mistyped or retitled share
  // lands on one indexable URL instead of a dead end. parseCoursePath caps the
  // slug's length, so the accepted space is still finite.
  return Boolean(parseCoursePath(path));
}

export function parseExplorePath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const raw = path.split("/").filter(Boolean);
  if (raw[0] !== "explore" || raw.length < 2) return null;
  let parts;
  try {
    parts = raw.slice(1).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
  if (parts.some((part) => !part || /[\\/]/.test(part))) return null;
  const [goal, s1, s2, s3, s4] = parts;
  const isSchool = goal === "school";
  if ((!isSchool && parts.length > 4) || (isSchool && parts.length > 5)) return null;
  return {
    goal,
    isSchool,
    board: isSchool ? s1 : null,
    cls: isSchool ? s2 : s1,
    subject: isSchool ? s3 : s2,
    chapter: isSchool ? s4 : s3,
  };
}

const explorePath = (...parts) => `/explore/${parts.filter(Boolean).join("/")}`;

function redirectResponse(url, path) {
  return new Response(null, {
    status: 308,
    headers: {
      location: new URL(path, url.origin).href,
      "cache-control": "public, max-age=0, s-maxage=3600",
    },
  });
}

// The exact canonical chapter shape, or null. canonicalChapterView is the one
// place that decides what counts — the same function the metadata, the React
// view and the sitemap builder agree on — so this cannot drift into indexing a
// facet the rest of the system considers unbounded.
//
// classSlugToStage maps the URL's short form to what the RPC speaks: "11" ->
// "class-11", and "dropper" -> "dropper" unchanged.
export function chapterLandingScope(url) {
  if (url.pathname !== "/browse") return null;
  const params = url.searchParams;
  if (!canonicalChapterView(params, (value) => value)) return null;
  const stage = classSlugToStage(params.get("class"));
  if (!stage) return null;
  return {
    goal: params.get("goal"),
    board: params.get("board"),
    cls: params.get("class"),
    stage,
    subject: params.get("subject"),
    chapter: params.get("chapter"),
  };
}

async function edgeJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) return { confirmed: false, data: null };
    return { confirmed: true, data: await response.json() };
  } catch {
    // A timeout, network reset or non-JSON upstream response is an
    // unconfirmed lookup, never a reason to break the public page.
    return { confirmed: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

const PAPER_SELECT = "id,title,description,material_type,source_name,source_url," +
  "preview_image_url,file_format,language,exam_year,page_count,is_downloadable,rights_status," +
  // The paper-metadata columns (migration applied 2026-09-02), so the edge
  // classifies papers with the same database-first rules the hydrated page
  // uses (paperMetadata in src/studyMaterialLandings.js).
  "paper_kind,paper_year,exam_session,exam_shift";

/**
 * Reviewed previous-year papers for one landing, optionally narrowed to a
 * single exam year. Same columns and ordering the React page selects, so the
 * served HTML and the hydrated page can never list different papers.
 */
function paperMaterialsEndpoint(supaUrl, landing, year = null) {
  const endpoint = new URL(`${supaUrl}/rest/v1/study_materials`);
  endpoint.searchParams.set("select", PAPER_SELECT);
  endpoint.searchParams.set("material_type", "eq.previous_year_paper");
  endpoint.searchParams.set("title", `ilike.${landing.titlePattern}`);
  if (year != null) endpoint.searchParams.set("exam_year", `eq.${year}`);
  endpoint.searchParams.set("order", "exam_year.desc.nullslast,title.asc");
  endpoint.searchParams.set("limit", "100");
  return endpoint;
}

function className(slug) {
  if (slug === "dropper") return "Dropper";
  const number = slug?.match(/^class-(\d+)$/)?.[1];
  return number ? `Class ${number}` : slug;
}

const GOAL_NAMES = Object.freeze({
  jee: "JEE",
  neet: "NEET",
  olympiad: "Olympiad",
  school: "School Boards",
});

async function deepExploreResponse(request, url, route, supaUrl, supaKey) {
  const headers = {
    apikey: supaKey,
    Authorization: `Bearer ${supaKey}`,
    "content-type": "application/json",
  };
  const curriculum = (args) => edgeJson(
    `${supaUrl}/rest/v1/rpc/get_browse_curriculum`,
    { method: "POST", headers, body: JSON.stringify(args) },
  );
  const goalName = GOAL_NAMES[route.goal];
  if (!goalName) return redirectResponse(url, "/explore");
  const validClasses = CLASS_LEVELS_BY_GOAL[route.goal] ?? [];
  if (!route.isSchool && route.cls && !validClasses.includes(route.cls)) {
    return redirectResponse(url, explorePath(route.goal));
  }

  const boardsPromise = route.isSchool
    ? edgeJson(
      `${supaUrl}/rest/v1/boards?select=id,name,slug,display_order,playlist_boards(count)` +
        "&order=display_order.asc",
      { headers },
    )
    : Promise.resolve({ confirmed: true, data: [] });
  const classIsValid = !route.cls || validClasses.includes(route.cls);
  const needsClassOptions = !route.cls && (!route.isSchool || Boolean(route.board));
  const classOptionsPromise = needsClassOptions
    ? Promise.all(validClasses.map(async (slug) => ({
        slug,
        result: await curriculum({ p_goal: route.goal, p_class: slug, p_subject: null }),
      })))
    : Promise.resolve([]);
  const subjectsPromise = route.cls && classIsValid
    ? curriculum({ p_goal: route.goal, p_class: route.cls, p_subject: null })
    : Promise.resolve({ confirmed: true, data: [] });
  const chaptersPromise = route.subject && classIsValid
    ? curriculum({ p_goal: route.goal, p_class: route.cls, p_subject: route.subject })
    : Promise.resolve({ confirmed: true, data: [] });

  const [boardsResult, classOptionResults, subjectsResult, chaptersResult] = await Promise.all([
    boardsPromise,
    classOptionsPromise,
    subjectsPromise,
    chaptersPromise,
  ]);
  if (![boardsResult, subjectsResult, chaptersResult,
    ...classOptionResults.map((item) => item.result)]
    .every((result) => result.confirmed)) return next();

  const boards = Array.isArray(boardsResult.data) ? boardsResult.data : [];
  const subjects = Array.isArray(subjectsResult.data) ? subjectsResult.data : [];
  const chapters = Array.isArray(chaptersResult.data) ? chaptersResult.data : [];
  const populatedClasses = classOptionResults
    .filter((item) => Array.isArray(item.result.data) && item.result.data.length > 0)
    .map((item) => item.slug);
  const goal = { name: goalName, slug: route.goal };

  const goalUrl = explorePath(route.goal);
  let board = null;
  if (route.isSchool) {
    board = route.board ? boards.find((item) => item.slug === route.board) : null;
    if (route.board && !board) return redirectResponse(url, goalUrl);
    if (board && Number(board.playlist_boards?.[0]?.count ?? 0) <= 0) {
      return redirectResponse(url, goalUrl);
    }
  }

  const scopeUrl = route.isSchool && board
    ? explorePath(route.goal, board.slug)
    : goalUrl;
  if (route.cls && !validClasses.includes(route.cls)) {
    return redirectResponse(url, scopeUrl);
  }
  if (route.cls && subjects.length === 0) {
    return redirectResponse(url, scopeUrl);
  }
  if (!route.cls && needsClassOptions && populatedClasses.length === 0) {
    return redirectResponse(url, route.isSchool ? goalUrl : "/explore");
  }

  const classUrl = route.cls ? `${scopeUrl}/${route.cls}` : null;
  const subject = route.subject
    ? subjects.find((item) => item.slug === route.subject)
    : null;
  if (route.subject && !subject) return redirectResponse(url, classUrl ?? scopeUrl);

  const subjectUrl = subject ? `${classUrl}/${subject.slug}` : null;
  if (subject && chapters.length === 0) {
    return redirectResponse(url, classUrl ?? scopeUrl);
  }
  const chapter = route.chapter
    ? chapters.find((item) => item.slug === route.chapter)
    : null;
  if (route.chapter && !chapter) {
    return redirectResponse(url, subjectUrl ?? classUrl ?? scopeUrl);
  }
  if (chapter) {
    return redirectResponse(url, canonicalBrowseUrl({
      goal: route.goal,
      cls: route.cls,
      board: board?.slug,
      subject: subject.slug,
      chapter: chapter.slug,
    }));
  }

  const crumbs = [
    { label: "Explore", url: "/explore" },
    { label: goal.name, url: goalUrl },
    board && { label: board.name, url: scopeUrl },
    route.cls && { label: className(route.cls), url: classUrl },
    subject && { label: subject.name, url: subjectUrl },
  ].filter(Boolean);
  const stepScope = crumbs.slice(1).map((crumb) => crumb.label);
  let heading;
  let options;
  if (route.isSchool && !board) {
    heading = exploreStepHeading("board", stepScope);
    options = boards
      .filter((item) => Number(item.playlist_boards?.[0]?.count ?? 0) > 0)
      .map((item) => ({
        name: item.name,
        url: explorePath(route.goal, item.slug),
        count: Number(item.playlist_boards?.[0]?.count ?? 0),
      }));
  } else if (!route.cls) {
    heading = exploreStepHeading("class", stepScope);
    options = populatedClasses.map((slug) => ({
      name: className(slug),
      url: `${scopeUrl}/${slug}`,
    }));
  } else if (!subject) {
    heading = exploreStepHeading("subject", stepScope);
    options = subjects.map((item) => ({
      name: item.name,
      url: `${classUrl}/${item.slug}`,
      count: Number(item.course_count ?? 0),
    }));
  } else {
    heading = exploreStepHeading("chapter", stepScope);
    options = chapters.map((item) => ({
      name: item.name,
      // Link the crawler-readable list directly to the same result URL React
      // opens. Deep chapter paths remain compatibility redirects only.
      url: canonicalBrowseUrl({
        goal: route.goal,
        cls: route.cls,
        board: board?.slug,
        subject: subject.slug,
        chapter: item.slug,
      }),
      count: Number(item.course_count ?? 0),
    }));
  }

  const meta = metadataForLocation(url.pathname, url.search);
  const guide = getSubjectGuide({
    goal: route.goal,
    cls: route.cls,
    subject: subject?.slug,
  });
  const shell = await fetchAppShell(request);
  if (!shell) return next();
  let html = injectRouteMeta(shell, meta);
  html = injectStructuredData(html, exploreSchemas(crumbs, options, guide, url.pathname));
  html = injectRootContent(html, renderExploreBody({
    heading,
    meta,
    crumbs,
    options,
    guide,
  }));
  return htmlResponse(html);
}

/**
 * One exam year of previous-year papers, e.g.
 * /materials/jee-main/previous-year-papers/2024.
 *
 * The landing lists every year at once, which is one page competing for every
 * "<exam> <year> question paper" search. This is the child that can win one.
 *
 * A year with no reviewed paper is a real 404, never an empty page: the URL
 * shape alone cannot tell us a year exists, so the catalogue does. An
 * unconfirmed lookup falls through to the normal shell, as everywhere else.
 */
async function paperYearResponse(request, url, route, supaUrl, supaKey) {
  const materials = await edgeJson(
    paperMaterialsEndpoint(supaUrl, route.landing, route.year),
    { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } },
  );
  if (!materials.confirmed) return next();
  const items = Array.isArray(materials.data) ? materials.data : [];
  if (!items.length) {
    return notFoundResponse(
      request,
      url,
      `${route.landing.examLabel} ${route.year} papers not found`,
    );
  }

  const shell = await fetchAppShell(request);
  if (!shell) return next();
  const meta = metadataForLocation(url.pathname, url.search);
  let html = injectRouteMeta(shell, meta);
  html = injectStructuredData(html, landingSchemas(url.pathname, items));
  html = injectRootContent(html, renderPaperYearBody(meta, route, items));
  return htmlResponse(html);
}

async function notFoundResponse(request, url, heading = "Page not found") {
  const shell = await fetchAppShell(request);
  if (!shell) return next();
  const meta = {
    ...metadataForLocation(url.pathname, url.search),
    title: `${heading} | ${SITE_NAME}`,
    description:
      "This page does not exist. Browse free courses by exam, class, subject and chapter instead.",
    robots: "noindex, nofollow",
    type: "website",
  };
  let html = injectRouteMeta(shell, meta);
  html = injectRootContent(html, renderNotFoundBody(url.pathname, heading));
  return htmlResponse(html, 404);
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);

    // Serverless functions are not app pages. Without this, /api/* fell
    // through to the isSupportedAppPath check below and every function —
    // including the admin's /api/youtube proxy — was intercepted and served
    // a 404 HTML shell before Vercel could route it (verified live:
    // GET /api/youtube returned text/html 404). The matcher also excludes
    // api/ so these requests stop invoking the middleware at all; this body
    // guard is the unit-testable belt-and-braces for both.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return next();
    }

    const courseRoute = parseCoursePath(url.pathname);
    const facultyMatch = url.pathname.match(/^\/faculty\/([^/]+)\/?$/);
    const forumPostMatch = url.pathname.match(/^\/forum\/post\/(\d+)\/?$/);
    // Set from the row fetched for the 404 check below, when there is one.
    let forumPostTitle = "";
    let pollQuestion = "";
    // Only a real poll slug shape (…-<id>); never /polls or /polls/new.
    const pollMatch = url.pathname.match(/^\/polls\/([a-z0-9]+(?:-[a-z0-9]+)*-\d+)\/?$/);
    const legacyChapterMatch = url.pathname.match(/^\/chapter\/(\d+)\/?$/);
    const exploreRoute = parseExplorePath(url.pathname);

    // Preserve the legacy route's direct hand-off even when an old link has a
    // trailing slash. Every other non-root slash form is a duplicate URL, so
    // collapse it before rendering or doing any catalogue lookup. Keep the
    // query string because campaign parameters must survive canonicalisation.
    if (legacyChapterMatch) {
      const chapterId = Number(legacyChapterMatch[1]);
      return redirectResponse(
        url,
        Number.isInteger(chapterId) && chapterId > 0
          ? `/browse?ch=${chapterId}`
          : "/browse",
      );
    }
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      const canonicalPath = url.pathname.replace(/\/+$/, "") || "/";
      return redirectResponse(url, `${canonicalPath}${url.search}`);
    }
    if (!isSupportedAppPath(url.pathname)) return notFoundResponse(request, url);

    const supaUrl = process.env.VITE_SUPABASE_URL;
    const supaKey = process.env.VITE_SUPABASE_ANON_KEY;

    // A thread URL whose database row is confirmed absent gets a real 404.
    // First ask for the forum mode: get_forum_post intentionally returns no
    // rows while mode is off, which must not make every valid pre-release URL
    // look deleted. Any unconfirmed lookup fails through to the normal shell.
    if (forumPostMatch && supaUrl && supaKey) {
      const headers = {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        "content-type": "application/json",
      };
      const mode = await edgeJson(`${supaUrl}/rest/v1/rpc/forum_mode`, {
        method: "POST", headers, body: "{}",
      });
      if (!mode.confirmed) return next();
      if (mode.data !== "off") {
        const found = await edgeJson(`${supaUrl}/rest/v1/rpc/get_forum_post`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_post_id: Number(forumPostMatch[1]) }),
        });
        if (!found.confirmed) return next();
        if (Array.isArray(found.data) && found.data.length === 0) {
          return notFoundResponse(request, url, "Forum post not found");
        }
        // We already paid for this row to decide the 404. Keeping its title
        // costs nothing and stops every thread sharing one generic card: without
        // it, N discussions look like N duplicate pages to a crawler and every
        // WhatsApp share of a thread shows only the site name.
        const row = Array.isArray(found.data) ? found.data[0] : null;
        const title = typeof row?.title === "string" ? row.title.trim() : "";
        if (title) forumPostTitle = title;
      }
    }

    // Same shape for polls: a syntactically valid /polls/<slug> that maps to no
    // live/closed poll (a fabricated id, or a rejected/taken-down poll) gets a
    // real 404 instead of a soft-200 shell with a slug-derived title. get_poll
    // returns no rows while polls are off, so gate on poll_mode first; any
    // unconfirmed lookup falls through to the normal shell.
    if (pollMatch && supaUrl && supaKey) {
      const headers = {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        "content-type": "application/json",
      };
      const mode = await edgeJson(`${supaUrl}/rest/v1/rpc/poll_mode`, {
        method: "POST", headers, body: "{}",
      });
      if (!mode.confirmed) return next();
      if (mode.data !== "off") {
        const found = await edgeJson(`${supaUrl}/rest/v1/rpc/get_poll`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_slug: pollMatch[1] }),
        });
        if (!found.confirmed) return next();
        if (Array.isArray(found.data) && found.data.length === 0) {
          return notFoundResponse(request, url, "Poll not found");
        }
        // Same reasoning as the forum row above: this row is already paid for.
        // Without it the card is built from the SLUG, which pageMetadata can
        // only guess at — it is lowercased, punctuation is gone, and a question
        // longer than the 60-char slug stem is cut mid-word, so
        // "…how JEE or NEET is run, what would it be?" unfurled as
        // "…how JEE or NEET is run w". The question is the one string a shared
        // poll has to get right.
        const row = Array.isArray(found.data) ? found.data[0] : null;
        const question = typeof row?.question === "string" ? row.question.trim() : "";
        if (question) pollQuestion = question;
      }
    }

    if (exploreRoute) {
      if (!supaUrl || !supaKey) return next();
      return deepExploreResponse(request, url, exploreRoute, supaUrl, supaKey);
    }

    // Per-year paper pages. Skipped entirely while the study-material
    // capability is off — the React route renders "coming soon" then, and
    // pageMetadata already marks it noindex, so there is nothing to render.
    const paperYearRoute = parsePaperYearPath(url.pathname);
    if (paperYearRoute && RELEASE_CAPABILITIES.studyMaterials) {
      if (!supaUrl || !supaKey) return next();
      return paperYearResponse(request, url, paperYearRoute, supaUrl, supaKey);
    }

    // Static routes share the client's metadata. Canonical Browse, Faculty,
    // root Explore, and Study material additionally fetch bounded public data
    // for crawler HTML.
    if (!courseRoute && !facultyMatch) {
      let routeMeta = metadataForLocation(url.pathname, url.search);
      if (!routeMeta) return next();
      // A thread describes itself. Everything else about the route's metadata —
      // canonical, robots, og:type "article" — is already right, so only the
      // two human-readable strings change.
      if (forumPostTitle) {
        routeMeta = {
          ...routeMeta,
          title: `${forumPostTitle} | Student forum | ${SITE_NAME}`,
          description: `A JEE and NEET preparation discussion on JEENEETARD: ${forumPostTitle}`,
        };
      }
      // A poll asks a question, so the card shows the question, punctuation and
      // all. The strings come from pageMetadata so the client applies exactly
      // the same ones once usePoll resolves. Only those two change; canonical,
      // robots and og:type "article" are already right for the route.
      const pollMeta = pollMetadataForQuestion(pollQuestion);
      if (pollMeta) routeMeta = { ...routeMeta, ...pollMeta };
      const directoryPromise = url.pathname === "/browse" && !url.search && supaUrl && supaKey
        ? Promise.all([
            edgeJson(
              `${supaUrl}/rest/v1/playlists?select=id,title&order=title.asc,id.asc&limit=1000`,
              { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } },
            ),
            edgeJson(`${supaUrl}/rest/v1/rpc/get_faculty_facets`, {
              method: "POST",
              headers: {
                apikey: supaKey,
                Authorization: `Bearer ${supaKey}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                p_chapter_id: null,
                p_subject_id: null,
                p_goal_id: null,
              }),
            }),
          ])
        : Promise.resolve(null);
      const exploreRootPromise = url.pathname === "/explore" && !url.search && supaUrl && supaKey
        ? edgeJson(`${supaUrl}/rest/v1/rpc/get_browse_curriculum`, {
            method: "POST",
            headers: {
              apikey: supaKey,
              Authorization: `Bearer ${supaKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ p_goal: null, p_class: null, p_subject: null }),
          })
        : Promise.resolve(null);
      const isMaterialsDirectory = url.pathname === "/materials" && !url.search;
      const paperLanding = url.search ? null : findPaperLanding(url.pathname);
      let materialsPromise = Promise.resolve(null);
      if (isMaterialsDirectory && supaUrl && supaKey) {
        materialsPromise = edgeJson(`${supaUrl}/rest/v1/rpc/get_study_materials`, {
            method: "POST",
            headers: {
              apikey: supaKey,
              Authorization: `Bearer ${supaKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              p_goal_slug: null,
              p_board_slug: null,
              p_class_slug: null,
              p_subject_slug: null,
              p_chapter_slug: null,
              p_chapter_id: null,
              p_video_id: null,
              p_material_type: null,
              p_limit: 60,
              p_offset: 0,
            }),
          });
      } else if (paperLanding && supaUrl && supaKey) {
        materialsPromise = edgeJson(paperMaterialsEndpoint(supaUrl, paperLanding), {
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        });
      }
      // One call. get_browse_curriculum returns every chapter in this
      // goal/class/subject with its real course_count, which is both the count
      // for THIS chapter and the sibling list — so the page costs a single
      // round trip rather than one lookup per section.
      const chapterScope = chapterLandingScope(url);
      const chapterPromise = chapterScope && supaUrl && supaKey
        ? edgeJson(`${supaUrl}/rest/v1/rpc/get_browse_curriculum`, {
            method: "POST",
            headers: {
              apikey: supaKey,
              Authorization: `Bearer ${supaKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              p_goal: chapterScope.goal,
              p_class: chapterScope.stage,
              p_subject: chapterScope.subject,
            }),
          })
        : Promise.resolve(null);
      const isFacultyDirectory = url.pathname === "/faculty" && !url.search;
      const facultyDirectoryPromise = isFacultyDirectory && supaUrl && supaKey
        ? edgeJson(`${supaUrl}/rest/v1/rpc/get_faculty_facets`, {
            method: "POST",
            headers: {
              apikey: supaKey,
              Authorization: `Bearer ${supaKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              p_chapter_id: null,
              p_subject_id: null,
              p_goal_id: null,
            }),
          })
        : Promise.resolve(null);
      const [shell, directory, exploreRoot, materials, facultyDirectory, chapterCurriculum] =
        await Promise.all([
          fetchAppShell(request),
          directoryPromise,
          exploreRootPromise,
          materialsPromise,
          facultyDirectoryPromise,
          chapterPromise,
        ]);
      if (!shell) return next();
      // Only a CONFIRMED lookup that actually contains this chapter produces a
      // chapter body. An unconfirmed fetch, or a slug the curriculum does not
      // know, falls through to the generic landing below — never to a page
      // asserting a count or a sibling list it could not verify.
      const chapterRows = chapterScope && chapterCurriculum?.confirmed &&
        Array.isArray(chapterCurriculum.data)
        ? chapterCurriculum.data.filter((row) => row?.level === "chapter" || row?.level == null)
        : [];
      const chapterRow = chapterScope
        ? chapterRows.find((row) => row?.slug === chapterScope.chapter)
        : null;

      // The HEAD is written from the same confirmed row as the body. It used to
      // be injected before this lookup, from the URL alone, with two results:
      // a fabricated slug came back "index, follow" under an invented title —
      // unlimited indexable soft-404s — and a REAL chapter shipped the
      // count-less fallback, so "Kinematics — 13 free courses for JEE Class 11
      // Physics" was computed and thrown away on every page Google reads.
      if (chapterScope) {
        const verifiedMeta = metadataForLocation(url.pathname, url.search, chapterRow
          ? { chapterName: chapterRow.name, courseCount: Number(chapterRow.course_count ?? 0) }
          : null);
        if (verifiedMeta) routeMeta = { ...routeMeta, ...verifiedMeta };
      }
      let html = injectRouteMeta(shell, routeMeta);
      const [courseResult, facultyResult] = directory ?? [];
      const hasDirectory = courseResult?.confirmed && facultyResult?.confirmed &&
        ((courseResult.data?.length ?? 0) > 0 || (facultyResult.data?.length ?? 0) > 0);
      const exploreRootOptions = exploreRoot?.confirmed
        ? (exploreRoot.data ?? [])
            .filter((goal) => GOAL_NAMES[goal.slug] && Number(goal.course_count ?? 0) > 0)
            .map((goal) => ({
              name: GOAL_NAMES[goal.slug],
              url: explorePath(goal.slug),
              count: Number(goal.course_count),
            }))
        : [];
      const materialItems = materials?.confirmed && Array.isArray(materials.data)
        ? materials.data
        : [];
      const facultyDirectoryItems = facultyDirectory?.confirmed && Array.isArray(facultyDirectory.data)
        ? facultyDirectory.data
        : [];
      const chapterSiblings = chapterRow
        ? chapterRows
            .filter((row) => row.slug && row.slug !== chapterScope.chapter)
            .map((row) => ({
              name: row.name,
              url: canonicalBrowseUrl({
                goal: chapterScope.goal,
                cls: chapterScope.cls,
                board: chapterScope.board,
                subject: chapterScope.subject,
                chapter: row.slug,
              }),
              count: Number(row.course_count ?? 0),
            }))
        : [];
      html = injectStructuredData(html, [
        ...landingSchemas(url.pathname, materialItems),
        ...(hasDirectory ? browseDirectorySchemas(courseResult.data) : []),
        ...facultyDirectorySchemas(facultyDirectoryItems),
        ...exploreSchemas([], exploreRootOptions),
      ]);
      const body = hasDirectory
        ? renderBrowseDirectoryBody(routeMeta, {
            courses: courseResult.data,
            faculty: facultyResult.data,
          })
        : exploreRootOptions.length > 0
          ? renderExploreBody({
              heading: "What are you preparing for?",
              meta: routeMeta,
              crumbs: [],
              options: exploreRootOptions,
            })
          : (isMaterialsDirectory || paperLanding)
            ? renderStudyMaterialsBody(routeMeta, materialItems)
          : isFacultyDirectory
            ? renderFacultyDirectoryBody(routeMeta, facultyDirectoryItems)
          : chapterRow
            ? renderChapterLandingBody({
                meta: routeMeta,
                chapterName: chapterRow.name,
                courseCount: Number(chapterRow.course_count ?? 0),
                siblings: chapterSiblings,
              })
          : renderLandingBody(url.pathname, routeMeta);
      html = injectRootContent(html, body);
      return htmlResponse(html);
    }

    if (!supaUrl || !supaKey) return next();

    if (facultyMatch) {
      let slug;
      try {
        slug = decodeURIComponent(facultyMatch[1]);
      } catch {
        return notFoundResponse(request, url, "Faculty page not found");
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      let profile;
      let lookupConfirmed = false;
      try {
        const res = await fetch(`${supaUrl}/rest/v1/rpc/get_faculty_profile`, {
          method: "POST",
          headers: {
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ p_slug: slug }),
          signal: controller.signal,
        });
        if (res.ok) {
          profile = await res.json();
          lookupConfirmed = true;
        }
      } finally {
        clearTimeout(timer);
      }
      if (lookupConfirmed && !profile) {
        return notFoundResponse(request, url, "Faculty page not found");
      }
      if (!lookupConfirmed) return next();

      const shell = await fetchAppShell(request);
      if (!shell) return next();
      const guide = getFacultyGuide(profile.slug);
      const meta = {
        ...metadataForLocation(url.pathname, url.search),
        title: `${profile.display_name} faculty profile | ${SITE_NAME}`,
        description: guide?.metaDescription || profile.bio ||
          `Browse verified aliases and free courses taught by ${profile.display_name}.`,
        canonicalPath: `/faculty/${profile.slug}`,
      };
      let html = injectRouteMeta(shell, meta);
      html = injectStructuredData(html, facultySchemas(profile, meta, guide));
      html = injectRootContent(html, renderFacultyBody(profile, meta, guide));
      return htmlResponse(html);
    }

    const id = courseRoute.id;
    const chapterId = courseRoute.chapterId;

    // 1. Look up the course (anon key, public catalogue data) with a hard
    //    timeout so a slow DB never delays the page. Chapter membership is an
    //    independent read, so start it at the same time instead of adding a
    //    second network round-trip to every chapter-scoped course response.
    const lookupCourse = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${supaUrl}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}` +
            `&select=title,teacher,average_rating,ratings_count,subjects(name)` +
            `,institutes_channels(name),playlist_videos(count),lessons:playlist_videos(position,videos(title))` +
            `&lessons.order=position.asc&lessons.limit=60`,
          {
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return { course: null, confirmed: false };
        const rows = await res.json();
        return {
          course: Array.isArray(rows) ? rows[0] : null,
          confirmed: true,
        };
      } finally {
        clearTimeout(timer);
      }
    };

    const lookupChapter = async () => {
      if (!chapterId) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${supaUrl}/rest/v1/playlist_videos` +
            `?playlist_id=eq.${encodeURIComponent(id)}` +
            `&select=playlist_id,videos!inner(chapter_id)` +
            `&videos.chapter_id=eq.${encodeURIComponent(chapterId)}` +
            `&limit=1`,
          {
            headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return { exists: false, confirmed: false };
        const rows = await res.json();
        return {
          exists: Array.isArray(rows) && rows.length > 0,
          confirmed: true,
        };
      } finally {
        clearTimeout(timer);
      }
    };

    const [courseLookup, chapterLookup] = await Promise.all([
      lookupCourse(),
      lookupChapter(),
    ]);
    const { course, confirmed: lookupConfirmed } = courseLookup;
    if (lookupConfirmed && (!course || !course.title)) {
      return notFoundResponse(request, url, "Course not found");
    }
    if (!lookupConfirmed) return next();

    // A real course can still be paired with a nonexistent or unrelated
    // chapter id. Confirm membership through the same playlist -> video
    // relationship the catalogue uses, without scanning or returning rows.
    if (chapterLookup) {
      if (chapterLookup.confirmed && !chapterLookup.exists) {
        return notFoundResponse(request, url, "Chapter not found in this course");
      }
      if (!chapterLookup.confirmed) return next();
    }

    // 2. One address per course. The bare /course/398 that every internal link
    //    and every already-shared link uses is not the canonical form any
    //    more — /course/398/kinematics is — so send it there permanently, and
    //    do the same for a slug that is wrong, mis-cased or left over from an
    //    older title. The id decided which course this is, so none of those
    //    are errors; they are just the wrong spelling of a working address.
    //
    //    This runs AFTER the lookups on purpose: the canonical slug comes from
    //    the title, and a redirect issued before the row was confirmed could
    //    point at a course that does not exist. An unconfirmed lookup has
    //    already fallen through to next() above, so this line is only reached
    //    when the course is known.
    //
    //    Chapter sub-URLs stay id-only. They are not the indexable address —
    //    they canonicalize to the course root — so giving them a slug would add
    //    a second shape for no gain. The query string always survives: ?ref=
    //    attribution, ?v= (the open lesson) and campaign parameters must not be
    //    dropped by canonicalisation.
    const canonicalPath = chapterId
      ? `/course/${id}/chapter/${chapterId}`
      : canonicalCoursePath(id, course.title);
    if (url.pathname !== canonicalPath) {
      return redirectResponse(url, `${canonicalPath}${url.search}`);
    }

    // 3. Fetch the built shell (not matched by this middleware, so no loop)
    //    and swap its head tags.
    const shell = await fetchAppShell(request);
    if (!shell) return next();

    const meta = courseMeta(course, id);
    const lessons = (course.lessons ?? [])
      .map((l) => l?.videos?.title)
      .filter((t) => typeof t === "string" && t.trim());

    // Meta first, then JSON-LD, then the crawler-readable body. Each step is
    // independent: if one pattern does not match the shell it leaves the HTML
    // unchanged rather than corrupting it.
    let html = injectCourseMeta(shell, meta);
    html = injectStructuredData(html, courseSchemas(course, meta));
    html = injectRootContent(html, renderCourseBody(course, meta, lessons));

    return htmlResponse(html);
  } catch {
    return next(); // never break a course page
  }
}
