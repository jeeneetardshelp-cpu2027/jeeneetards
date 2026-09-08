// courseTeacherSlug.js — the ONE rule that turns a course's linked faculty
// rows into a /faculty destination, plus the embed that fetches them.
//
// What a course actually carries is two different things with similar names.
// `playlists.teacher` is free text an importer typed — the credit a student
// reads on the card ("ABJ Sir"), not a resolved identity; courseCredit.js
// owns how that string is displayed. Separately, playlist_teachers links the
// course to real `teachers` rows, which own a slug and a /faculty/<slug> page.
// Measured against production on 2026-09-08, identically under the anon key
// and the service_role key (so these are not an RLS artifact): 490 playlists,
// 284 with a link to a slugged teacher, 412 with free text, 128 with free text
// and NO link to a slugged teacher, and every linked course also has the free
// text. So the link is a destination for a name the page is already showing —
// never a replacement for it, and never something to invent when it is absent.
// Re-measure before reasoning from these; the registry moves under them. That
// is the same stance as the migration that created these links, whose header
// (supabase/migrations/20260902200000_link_verified_faculty_credits.sql)
// date-stamps its counts and RAISES rather than acts when they have drifted.
//
// EXACTLY ONE, OR NOTHING. A course credited to two people must not link to
// whichever row PostgREST happened to return first, so two or more resolved
// teachers give null and the credit stays plain text. Playlist 91 ("Biology |
// NEET - Vardaan Series") is the honest version of that case: two real humans,
// samapti-sinha and tarun-kumar. It is NOT the only multi-linked course. Of
// the 284 linked courses, 150 resolve exactly one slug and link; 134 resolve
// two or more and stay plain text. Most of that 134 is registry duplication
// rather than co-teaching — 51 link two rows carrying the IDENTICAL
// display_name, and others link two aliases of one person (playlist 5, credit
// "ABJ Sir", links both `amit-bijarnia` and `abj`; the teachers table now
// holds 131 slugged rows with 29 display_names appearing more than once).
// That is the registry's problem to fix by de-duplicating teachers, and those
// courses will link themselves once it is fixed. The rule here does not bend
// for it: the alternative is the page CHOOSING a destination. The house rule
// the rest of the catalogue already follows: render nothing rather than a
// placeholder or a guess. A slug is never derived from a name.
//
// This lives in one module because all THREE read paths need it — the /browse
// cards (usePlaylistBrowse.js), the watch page (usePlaylistVideos.js) and the
// edge-rendered crawler body (middleware.js, which builds the select, and
// ogInject.js, which applies the rule to what comes back). A second copy of
// the rule is how those surfaces would come to disagree about playlist 91.

import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";

// The select fragment the two hooks concatenate verbatim (middleware.js
// concatenates a whitespace-stripped copy, for the reason it states there),
// leading comma included so it drops out cleanly when the capability is off.
//
// A LEFT join, deliberately: `playlist_teachers!inner` would drop the 206
// production playlists that have no faculty link at all — the embed answers a
// question about a course, it does not filter which courses exist. (The
// conditional `pt:playlist_teachers!inner(teacher_id)` in usePlaylistBrowse is
// a different thing entirely: that one IS the faculty filter, which is why it
// is inner, and why this one carries its own alias.)
//
// Gated exactly like every other teachers_v7 surface: an environment that
// predates the faculty tables would 400 the whole course query on this embed,
// and a course page is not worth losing over an optional credit link.
//
// COST, in the terms the /browse payload is already measured in: one nested
// `{teachers:{slug}}` per linked course, on the ~half of rows that have one.
export const FACULTY_SLUG_EMBED = RELEASE_CAPABILITIES.facultyRegistry
  ? ", faculty:playlist_teachers(teachers(slug))"
  : "";

// PostgREST returns a to-many embed as an array and a to-one as a bare object
// (null when it resolves to nothing), so neither level of this shape is safe to
// index blindly. Same normalisation mapCourseDetail already applies to its own
// embeds — see relationRows in usePlaylistVideos.js.
const rowsOf = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * The single /faculty slug to link a course's credit to, or null.
 *
 * @param {unknown} facultyRows the `faculty:playlist_teachers(teachers(slug))`
 *   embed as PostgREST returned it — array, bare object, null or absent.
 * @returns {string|null} the slug when EXACTLY ONE slugged teacher resolves.
 */
export function courseTeacherSlug(facultyRows) {
  // A SET of slugs, not a count of rows. Two junction rows naming the SAME
  // teacher are one teacher: playlist_teachers carries role and position, so a
  // person can legitimately appear twice on a course (instructor and
  // co-instructor), and a re-import can leave a duplicate pair behind. The
  // exactly-one rule exists to stop the page CHOOSING between two destinations
  // — where there is only one destination there is nothing to choose, and
  // tallying rows instead of identities would unlink a correctly linked course
  // over a bookkeeping detail no student can see.
  const slugs = new Set();
  for (const row of rowsOf(facultyRows)) {
    // A teachers row that came back null (the link points at nothing readable
    // here) and one with no slug are the same case: no page to link to. Such a
    // row must not count toward the tally either, or a course with exactly one
    // real destination would silently lose its link to a row that never had
    // one. /faculty/ with an empty slug is not a page.
    for (const teacher of rowsOf(row?.teachers)) {
      const slug = typeof teacher?.slug === "string" ? teacher.slug.trim() : "";
      if (slug) slugs.add(slug);
    }
  }
  return slugs.size === 1 ? slugs.values().next().value : null;
}
