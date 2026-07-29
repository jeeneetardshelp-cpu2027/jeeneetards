import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  metadataForCourse,
  metadataForLocation,
} from "./pageMetadata.js";

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
