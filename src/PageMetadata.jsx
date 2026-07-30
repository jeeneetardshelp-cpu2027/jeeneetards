import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  metadataForCourse,
  metadataForLocation,
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

export function useCourseMetadata(course) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const metadata = metadataForCourse(course);
    if (!metadata) return;
    // Chapter sub-URLs (/course/5/chapter/2) canonicalize to the course root:
    // the sitemap and the edge middleware both emit /course/5, and all three
    // signals must agree or crawlers pick one arbitrarily.
    const courseRoot = pathname.match(/^\/course\/\d+/)?.[0] ?? pathname;
    applyPageMetadata({
      ...metadata,
      canonicalPath: courseRoot,
      robots: "index, follow",
    });
  }, [course, pathname, search]);
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
