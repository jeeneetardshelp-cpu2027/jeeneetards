// middleware.js — Vercel Edge Middleware.
//
// The app is a client-rendered SPA: /course/:id serves a generic HTML shell,
// so link-preview crawlers (WhatsApp, Telegram, iMessage, Facebook, ...) and
// search engines see the homepage title/description on every course. This
// middleware rewrites the <head> for /course/:id to that course's own title
// and description before the HTML leaves the edge.
//
// Injected for EVERY visitor (not only bots): serving crawlers different
// content than users is cloaking and is penalised. The SPA simply hydrates
// over the same HTML.
//
// FAIL-THROUGH is absolute: any missing env, lookup miss, slow query, or error
// falls back to next() — the normal shell — so a course page can never break.

import { next } from "@vercel/edge";
import { metadataForLocation, SITE_NAME } from "./src/pageMetadata.js";
import { findTestSection } from "./src/testPlatforms.js";
import { CLASS_LEVELS_BY_GOAL } from "./src/classLevels.js";
import { canonicalBrowseUrl } from "./src/canonicalUrl.js";
import { exploreStepHeading } from "./src/exploreHeading.js";
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
  renderLandingBody,
  renderBrowseDirectoryBody,
  renderNotFoundBody,
} from "./ogInject.js";

// Inspect every application path so an unknown SPA URL can carry a real HTTP
// 404. Static assets bypass middleware entirely. Vercel matcher regex supports
// negative lookaheads; keep this list aligned with public/ and Vite's assets/.
export const config = {
  matcher: [
    "/((?!assets/|fonts/|favicon\\.svg|robots\\.txt|sitemap\\.xml|llms\\.txt|social-preview\\.(?:png|svg)|theme-init\\.js|index\\.html).*)",
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
const LOOKUP_TIMEOUT_MS = 1500;

const STATIC_APP_ROUTES = new Set([
  "/", "/admin", "/browse", "/compare", "/explore", "/privacy",
  "/reset", "/search", "/terms", "/tests",
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
  if (/^\/faculty\/[^/]+$/.test(path)) return true;
  if (/^\/chapter\/\d+$/.test(path)) return true;
  return /^\/course\/\d+(?:\/chapter\/\d+)?$/.test(path);
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

async function deepExploreResponse(url, route, supaUrl, supaKey) {
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
  const shell = await fetch(new URL("/index.html", url.origin));
  if (!shell.ok) return next();
  let html = injectRouteMeta(await shell.text(), meta);
  html = injectStructuredData(html, exploreSchemas(crumbs, options));
  html = injectRootContent(html, renderExploreBody({ heading, meta, crumbs, options }));
  return htmlResponse(html);
}

async function notFoundResponse(url, heading = "Page not found") {
  const shell = await fetch(new URL("/index.html", url.origin));
  if (!shell.ok) return next();
  const meta = {
    ...metadataForLocation(url.pathname, url.search),
    title: `${heading} | ${SITE_NAME}`,
    description:
      "This page does not exist. Browse free courses by exam, class, subject and chapter instead.",
    robots: "noindex, nofollow",
    type: "website",
  };
  let html = injectRouteMeta(await shell.text(), meta);
  html = injectRootContent(html, renderNotFoundBody(url.pathname, heading));
  return htmlResponse(html, 404);
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const courseMatch = url.pathname.match(/^\/course\/(\d+)(?:\/chapter\/(\d+))?\/?$/);
    const facultyMatch = url.pathname.match(/^\/faculty\/([^/]+)\/?$/);
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
    if (!isSupportedAppPath(url.pathname)) return notFoundResponse(url);

    const supaUrl = process.env.VITE_SUPABASE_URL;
    const supaKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (exploreRoute) {
      if (!supaUrl || !supaKey) return next();
      return deepExploreResponse(url, exploreRoute, supaUrl, supaKey);
    }

    // Non-course routes need no DB lookup. metadataForLocation is the SAME
    // function the client uses, so server and client never disagree.
    if (!courseMatch && !facultyMatch) {
      const routeMeta = metadataForLocation(url.pathname, url.search);
      if (!routeMeta) return next();
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
      const [shell, directory] = await Promise.all([
        fetch(new URL("/index.html", url.origin)),
        directoryPromise,
      ]);
      if (!shell.ok) return next();
      let html = injectRouteMeta(await shell.text(), routeMeta);
      const [courseResult, facultyResult] = directory ?? [];
      const hasDirectory = courseResult?.confirmed && facultyResult?.confirmed &&
        ((courseResult.data?.length ?? 0) > 0 || (facultyResult.data?.length ?? 0) > 0);
      html = injectStructuredData(html, [
        ...landingSchemas(url.pathname),
        ...(hasDirectory ? browseDirectorySchemas(courseResult.data) : []),
      ]);
      const body = hasDirectory
        ? renderBrowseDirectoryBody(routeMeta, {
            courses: courseResult.data,
            faculty: facultyResult.data,
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
        return notFoundResponse(url, "Faculty page not found");
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
        return notFoundResponse(url, "Faculty page not found");
      }
      if (!lookupConfirmed) return next();

      const shell = await fetch(new URL("/index.html", url.origin));
      if (!shell.ok) return next();
      const meta = {
        ...metadataForLocation(url.pathname, url.search),
        title: `${profile.display_name} faculty profile | ${SITE_NAME}`,
        description: `Browse verified aliases and free courses taught by ${profile.display_name}.`,
        canonicalPath: `/faculty/${profile.slug}`,
      };
      let html = injectRouteMeta(await shell.text(), meta);
      html = injectStructuredData(html, facultySchemas(profile, meta));
      html = injectRootContent(html, renderFacultyBody(profile, meta));
      return htmlResponse(html);
    }

    const id = courseMatch[1];
    const chapterId = courseMatch[2] ?? null;

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
      return notFoundResponse(url, "Course not found");
    }
    if (!lookupConfirmed) return next();

    // A real course can still be paired with a nonexistent or unrelated
    // chapter id. Confirm membership through the same playlist -> video
    // relationship the catalogue uses, without scanning or returning rows.
    if (chapterLookup) {
      if (chapterLookup.confirmed && !chapterLookup.exists) {
        return notFoundResponse(url, "Chapter not found in this course");
      }
      if (!chapterLookup.confirmed) return next();
    }

    // 2. Fetch the built shell (not matched by this middleware, so no loop)
    //    and swap its head tags.
    const shellRes = await fetch(new URL("/index.html", url.origin));
    if (!shellRes.ok) return next();

    const meta = courseMeta(course, id);
    const lessons = (course.lessons ?? [])
      .map((l) => l?.videos?.title)
      .filter((t) => typeof t === "string" && t.trim());

    // Meta first, then JSON-LD, then the crawler-readable body. Each step is
    // independent: if one pattern does not match the shell it leaves the HTML
    // unchanged rather than corrupting it.
    let html = injectCourseMeta(await shellRes.text(), meta);
    html = injectStructuredData(html, courseSchemas(course, meta));
    html = injectRootContent(html, renderCourseBody(course, meta, lessons));

    return htmlResponse(html);
  } catch {
    return next(); // never break a course page
  }
}
