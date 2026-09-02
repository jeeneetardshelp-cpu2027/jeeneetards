import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  metadataForCourse,
  metadataForLocation,
  pollMetadataForQuestion,
} from "./pageMetadata.js";
// Only the serializer, never the schema builders: this file's job is DOM
// upsert/cleanup, not deciding what a Course or VideoObject looks like.
import { safeStructuredDataJson } from "./structuredData.js";

const SOCIAL_IMAGE_PATH = "/social-preview.png";

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", url);
}

export function applyPageMetadata({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  robots = "index, follow",
  canonicalPath = window.location.pathname,
  type = "website",
} = {}) {
  const canonicalUrl = new URL(canonicalPath || "/", window.location.origin).href;
  const socialImageUrl = new URL(SOCIAL_IMAGE_PATH, window.location.origin).href;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", robots);
  upsertCanonical(canonicalUrl);

  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", socialImageUrl);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta(
    "property",
    "og:image:alt",
    "JEENEETARD - a free educational YouTube course directory",
  );

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", socialImageUrl);
}

export default function RouteMetadata() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    applyPageMetadata(metadataForLocation(pathname, search));
  }, [pathname, search]);

  return null;
}

/**
 * Upgrade a chapter view once the catalogue has CONFIRMED it exists.
 *
 * RouteMetadata re-applies metadataForLocation on every navigation, and a URL
 * alone cannot prove a chapter is real — so the shared rule defaults a chapter
 * view to noindex. Without this hook the client would then overwrite the edge
 * good head and every real chapter page would ask not to be indexed on
 * Google rendered pass, which is the pass that decides.
 *
 * Mirrors useCourseMetadata: the page that has the real data re-states the
 * head from it. Waits for a settled, non-null count — mid-load this is null,
 * and re-stating the head from an unsettled number would flicker the page
 * between indexable and not.
 */
export function useChapterMetadata({ chapterName, courseCount, ready }) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!ready || courseCount == null) return;
    const metadata = metadataForLocation(pathname, search, {
      chapterName, courseCount,
    });
    if (metadata) applyPageMetadata(metadata);
  }, [pathname, search, chapterName, courseCount, ready]);
}

export function useCourseMetadata(course) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const metadata = metadataForCourse(course);
    if (!metadata) return;
    // The course ROOT of this path — id plus the keyword slug when the URL
    // carries one — because that is the address the edge declares canonical.
    //
    // This used to stop at /^\/course\/\d+/, which was right when the bare id
    // was the canonical shape and is wrong now that /course/398/kinematics is.
    // On a slugged URL the edge-served HTML said /course/398/kinematics and
    // hydration replaced it with /course/398: self-healing, because the id form
    // 308s to the slug form, but two layers stating different canonicals for
    // the same page is exactly the drift the one-address rule exists to stop.
    // Keeping the slug segment makes the client agree with the edge.
    //
    // The slug is kept, never invented: this reads what is already in the URL
    // the edge sent the student to. Nothing here mints a slug from a title, so
    // a stale slug still declares itself — and still resolves, since the id
    // decides the course (canonicalUrl.js).
    //
    // "chapter" is excluded, so a chapter sub-URL (/course/5/chapter/2) still
    // collapses to /course/5 exactly as it always has — courseSlug() refuses
    // "chapter" as a slug for this reason, so no real course can be shadowed by
    // the exclusion. A combined /course/5/kinematics/chapter/2 keeps
    // /course/5/kinematics, which is the same course root by another spelling.
    const courseRoot =
      pathname.match(/^\/course\/\d+(?:\/(?!chapter(?:\/|$))[^/]+)?/)?.[0] ?? pathname;
    applyPageMetadata({
      ...metadata,
      canonicalPath: courseRoot,
      robots: "index, follow",
    });
  }, [course, pathname, search]);
}

/**
 * Refine a poll page's title and description once the row arrives.
 *
 * RouteMetadata has already applied the slug-derived metadata on navigation —
 * lowercased, punctuation stripped, cut at 60 characters — and without this
 * the tab kept that degraded text even though the edge had served the real
 * question in the HTML. Same shape as useCourseMetadata: the route's own
 * canonical, robots and og:type stay, only the two human-readable strings
 * change, and they come from the builder the edge uses.
 */
export function usePollMetadata(poll) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const pollMeta = pollMetadataForQuestion(poll?.question);
    if (!pollMeta) return;
    applyPageMetadata({ ...metadataForLocation(pathname, search), ...pollMeta });
  }, [poll, pathname, search]);
}

const STRUCTURED_DATA_ATTR = "data-schema-key";
const STRUCTURED_DATA_SELECTOR = `script[type="application/ld+json"][${STRUCTURED_DATA_ATTR}]`;
const structuredDataSelectorForKey = (key) =>
  `script[type="application/ld+json"][${STRUCTURED_DATA_ATTR}="${key}"]`;

// A JS-created <script type="application/ld+json"> is not a JavaScript MIME
// type, so it is not subject to CSP `script-src` enforcement in Chrome or
// Firefox even though vercel.json's script-src has no 'unsafe-inline' — this
// is standard practice (Google's own rich-results examples do it this way),
// but it is an assumption: verify there is no CSP console warning live.
function upsertStructuredDataElement(key, schema) {
  let element = document.head.querySelector(structuredDataSelectorForKey(key));
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.setAttribute(STRUCTURED_DATA_ATTR, key);
    document.head.appendChild(element);
  }
  // safeStructuredDataJson escapes "<" so a title/description containing a
  // literal "</script>" cannot break out of this tag — textContent alone
  // does not protect against that, the HTML parser closes on the substring
  // regardless of the element's type attribute.
  element.textContent = safeStructuredDataJson(schema);
}

/**
 * Upsert one <script type="application/ld+json"> per schema object into
 * document.head, keyed by the schema's own `@type` (e.g. "Course",
 * "VideoObject", "BreadcrumbList"). Any previously-written schema script
 * whose key is not present in this call is removed, so navigating between
 * pages never leaves a stale Course/VideoObject describing the old page.
 *
 * `schemas` is an array of plain schema.org objects (already built by
 * src/structuredData.js's schema-builder functions); null/undefined entries
 * are skipped so callers can pass conditional schemas inline. If a page ever
 * needs two schemas of the same `@type` at once, that collides on this key
 * and is the caller's bug, not this function's — split them or nest them
 * under a single schema instead (e.g. an ItemList of Courses).
 *
 * Returns the Set of keys written, for callers that need to track them.
 */
export function applyStructuredData(schemas) {
  const keys = new Set();

  for (const schema of schemas ?? []) {
    if (!schema) continue;
    const key = schema["@type"];
    upsertStructuredDataElement(key, schema);
    keys.add(key);
  }

  document.head.querySelectorAll(STRUCTURED_DATA_SELECTOR).forEach((element) => {
    if (!keys.has(element.getAttribute(STRUCTURED_DATA_ATTR))) {
      element.remove();
    }
  });

  return keys;
}

function removeStructuredDataElement(key) {
  document.head.querySelector(structuredDataSelectorForKey(key))?.remove();
}

/**
 * Hook form of applyStructuredData, run from a useEffect keyed on an
 * explicit `deps` array supplied by the caller (mirrors useCourseMetadata
 * above). Written keys are tracked in a ref so that on unmount — not on
 * every dep change, only when this component stops rendering entirely —
 * every schema script this hook is responsible for is removed rather than
 * left behind for whatever route renders next.
 */
export function useStructuredData(schemas, deps) {
  const writtenKeysRef = useRef(new Set());

  useEffect(() => {
    writtenKeysRef.current = applyStructuredData(schemas);
    // `deps` is the caller's explicit dependency list (schemas is rebuilt
    // fresh every render and would otherwise re-run this on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return () => {
      writtenKeysRef.current.forEach(removeStructuredDataElement);
      writtenKeysRef.current = new Set();
    };
  }, []);
}
