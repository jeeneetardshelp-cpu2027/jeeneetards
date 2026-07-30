// structuredData.js — schema.org JSON-LD node builders for rich-result
// eligibility (Course, VideoObject, BreadcrumbList, ItemList, WebSite,
// Organization).
//
// A PURE module, on purpose: no DOM APIs, no React, no browser globals, and
// no imports at all — the same "no imports, no side effects, no runtime
// assumptions, just data in, plain object out" rule ogInject.js documents
// for itself, because ogInject.js (or the edge middleware it backs) may
// import THIS file later. That is a one-way dependency: this file must never
// import ogInject.js or anything that does. The site origin below is kept as
// a literal for the same reason, deliberately duplicating ogInject.js's own
// SITE constant rather than sharing an import.
//
// Every exported function takes the plain fields a caller (CourseVideoPage,
// PlaylistBrowse, Home) already has on hand and returns a plain schema.org
// node — or null when there is nothing honest to say yet. Nothing here
// touches the DOM; a separate DOM layer (not this file) is responsible for
// turning these nodes into <script type="application/ld+json"> tags, and
// MUST do so via safeStructuredDataJson (see its doc comment below).
//
// Anti-fabrication rules this module enforces on every caller's behalf:
//   - aggregateRating is emitted ONLY when ratingsCount > 0 — real reviews,
//     never a 0/0 placeholder rendered as if it were a rating.
//   - VideoObject never carries uploadDate. There is no real upload-date
//     column anywhere in the schema: last_verified_at is a verification
//     timestamp (when we last confirmed the embed still plays), not when
//     the video was uploaded, and a row's created_at is this DB's insert
//     time, not YouTube's.
//   - Course.provider is the teaching institute/channel (institutes_channels
//     .name), never this site. JEENEETARD embeds and indexes third-party
//     YouTube courses; it did not create them. The site's own identity
//     (organizationSchema) is a separate, honest node describing the SITE,
//     not any course, and belongs on the homepage only.

const SITE = "https://www.jeeneetard.com";

/** Absolute-ize a path against SITE. Already-absolute URLs pass through untouched. */
function toAbsoluteUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Seconds -> an ISO 8601 duration string ("PT1H5M30S"), the format
 * schema.org expects for VideoObject.duration. Fractional seconds are
 * floored — schema.org duration has no fractional-second convention worth
 * inventing here. Returns null (never "PT0S") for null/0/negative/non-finite
 * input, and also for a positive-but-sub-one-second input that floors to
 * all-zero components: a zero-length duration is worse than omitting the
 * field entirely.
 */
export function durationToIso8601(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours === 0 && minutes === 0 && secs === 0) return null;
  let out = "PT";
  if (hours) out += `${hours}H`;
  if (minutes) out += `${minutes}M`;
  if (secs) out += `${secs}S`;
  return out;
}

/**
 * Course node for a course/playlist page.
 *
 * `title` is assumed present (playlists.title is NOT NULL); every other
 * field is optional and its key is omitted — never emitted as `null` —
 * when falsy, because schema.org validators flag a null-valued property as
 * an error, not a warning.
 *
 * ratingsCount/averageRating come from playlists.ratings_count /
 * .average_rating (denormalised, trigger-maintained — see
 * community_schema.sql). aggregateRating is emitted ONLY when
 * ratingsCount > 0; site-wide today that is 0 everywhere (ratings
 * submission is feature-flagged off), so this must — and does — produce no
 * aggregateRating anywhere yet. bestRating/worstRating are 5/1, matching
 * playlist_ratings' real `check (rating between 1 and 5)` constraint.
 */
export function courseSchema({
  title,
  description,
  institute,
  teacher,
  averageRating,
  ratingsCount,
  url,
} = {}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: title,
  };
  if (description) schema.description = description;
  // Never invent "JEENEETARD" as provider — omit entirely rather than guess.
  if (institute) schema.provider = { "@type": "Organization", name: institute };

  const courseInstance = { "@type": "CourseInstance", courseMode: "online" };
  if (teacher) courseInstance.instructor = { "@type": "Person", name: teacher };
  schema.hasCourseInstance = courseInstance;

  if (url) schema.url = toAbsoluteUrl(url);

  if (Number(ratingsCount) > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      ratingCount: ratingsCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

/**
 * VideoObject node describing whichever lesson is ACTUALLY the page's
 * current activeLesson at the moment of emission — never "the whole
 * course" as one video. Returns null when there is no YouTube id to
 * describe (e.g. a course whose lesson sequence is still empty), since
 * there is nothing true to say without one.
 *
 * thumbnailUrl defaults to the YouTube `hqdefault` thumbnail when not
 * passed explicitly — hqdefault always exists for a valid video id,
 * unlike maxresdefault, which older uploads don't have.
 *
 * uploadDate is NEVER included — see the file banner above for why.
 */
export function videoObjectSchema({
  title,
  description,
  youtubeVideoId,
  durationSeconds,
  thumbnailUrl,
} = {}) {
  if (!youtubeVideoId) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    thumbnailUrl:
      thumbnailUrl || `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeVideoId}`,
  };
  if (description) schema.description = description;
  const duration = durationToIso8601(durationSeconds);
  if (duration) schema.duration = duration;
  return schema;
}

/**
 * BreadcrumbList node from an ordered [{label, url}] trail. `url` may be
 * null on any crumb (in practice, only the terminal current-page crumb) —
 * Google requires an item URL for every crumb except optionally the last,
 * so a null url simply omits that crumb's `item` key rather than emitting
 * a bad or invented one. A 0- or 1-item trail is not a breadcrumb, so it
 * returns null instead of a degenerate single-item list.
 */
export function breadcrumbListSchema(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => {
      const item = { "@type": "ListItem", position: index + 1, name: crumb.label };
      const absoluteUrl = toAbsoluteUrl(crumb.url);
      if (absoluteUrl) item.item = absoluteUrl;
      return item;
    }),
  };
}

/**
 * ItemList node for a catalogue listing page (e.g. PlaylistBrowse results).
 * `position` is trusted as-is and used unmodified — the caller has already
 * folded in the pagination offset, so this function never renumbers.
 * Returns null for an empty list.
 */
export function itemListSchema(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item) => {
      const node = { "@type": "ListItem", position: item.position, name: item.title };
      const absoluteUrl = toAbsoluteUrl(item.url);
      if (absoluteUrl) node.url = absoluteUrl;
      return node;
    }),
  };
}

/**
 * WebSite node advertising the homepage's real search behaviour: Home.jsx
 * already reads `?q=` on load and runs it as a search. Deliberately targets
 * `/?q=` and NOT `/search` — `/search` does not read a query param the same
 * way, and claiming otherwise here would make the markup itself dishonest.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: `${SITE}/`,
    name: "JEENEETARD",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Organization node describing the SITE itself — never a course provider
 * (that's courseSchema's `provider`, and it names the real teaching
 * institute). Description wording mirrors pageMetadata.js's
 * DEFAULT_DESCRIPTION verbatim; kept as a literal rather than an import so
 * this module stays import-free (see file banner).
 *
 * No `logo`: public/ has no real square/raster brand-mark asset today —
 * favicon.svg is a 64x64 app icon, not the logo Google's guidance wants.
 * Omitted rather than pointed at something that isn't actually a logo.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JEENEETARD",
    url: `${SITE}/`,
    description:
      "Browse free educational YouTube courses by exam, class, subject and chapter.",
  };
}

/**
 * Turn a schema.org node into safe <script type="application/ld+json">
 * text. This is the ONLY function the DOM layer may use to do that
 * conversion — never `JSON.stringify(schema)` directly and never
 * `script.textContent = JSON.stringify(...)`.
 *
 * Why: JSON.stringify does not escape "<", and the HTML parser closes a
 * <script> tag on a literal "</script>" in its text content regardless of
 * the tag's `type` attribute. A creator-controlled string (a lecture or
 * course title) that happens to contain "</script>" would otherwise break
 * out of the JSON-LD block and let arbitrary markup/script follow it. The
 * `<` JSON escape is lossless — it parses back to the identical "<"
 * character — so this changes nothing about the data, only how it's
 * embedded in HTML.
 */
export function safeStructuredDataJson(schema) {
  return JSON.stringify(schema, null, 0).replace(/</g, "\\u003c");
}
