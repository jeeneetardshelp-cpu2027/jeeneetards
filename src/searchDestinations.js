// searchDestinations.js — where a search result leads.
//
// ONE definition, shared by the homepage hero search and /search. It lived in
// Home.jsx first and UniversalSearch.jsx had its own copy, which is how the two
// pages drifted: the same lecture row sent you to the lesson from one and to a
// filtered catalogue from the other. It is a plain module rather than an export
// from Home.jsx so that /search does not pull Home's dependency graph
// (PlaylistBrowse, usePlaylistBrowse, the card) into its chunk.
//
// The rule: every group must land somewhere watchable or filtered. A row that
// navigates to a bare /browse throws away the very thing the student searched
// for, which was the original complaint.

export function resultHref(groupKey, row) {
  const extra = row?.extra ?? {};
  switch (groupKey) {
    case "chapter":
      // ?ch= is the legacy id key; the canonical ?chapter= form needs a slug,
      // which the RPC does not return.
      return `/browse?ch=${extra.chapter_id ?? row.id}`;
    case "playlist":
      // A course with no chapter context is still a real destination, so this
      // never has to disable the row.
      return extra.chapter_id
        ? `/course/${row.id}/chapter/${extra.chapter_id}`
        : `/course/${row.id}`;
    case "lecture": {
      // Prefer the lesson itself — a lecture result that lands on a filtered
      // catalogue makes the student hunt for what they already found. Falls
      // back to the chapter filter where the deployed RPC does not yet carry
      // playlist_id for lectures.
      if (!extra.playlist_id) {
        return extra.chapter_id
          ? `/browse?ch=${extra.chapter_id}`
          : `/browse${extra.subject_id ? `?sub=${extra.subject_id}` : ""}`;
      }
      const base = extra.chapter_id
        ? `/course/${extra.playlist_id}/chapter/${extra.chapter_id}`
        : `/course/${extra.playlist_id}`;
      // ?v= selects the lesson on the watch page (a YouTube id, not a row id).
      return extra.youtube_video_id
        ? `${base}?v=${encodeURIComponent(extra.youtube_video_id)}`
        : base;
    }
    case "institute":
      return `/browse?channel=${extra.institute_id ?? row.id}`;
    case "faculty":
      // The slug is the only safe handle; a display name is not unique.
      return row?.slug ? `/faculty/${row.slug}` : "/browse";
    default:
      return "/browse";
  }
}
