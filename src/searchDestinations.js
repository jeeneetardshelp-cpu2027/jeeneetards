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

import { JEE_MAIN_PAPERS_PATH, landingForPaperTitle } from "./studyMaterialLandings.js";

/**
 * Where a study-material result goes on THIS site. /materials reads exactly
 * these query keys (StudyMaterialsPage.jsx) and hands them to
 * get_study_materials as p_goal_slug / p_class_slug / p_subject_slug /
 * p_chapter_slug / p_material_type.
 *
 * The RPC satisfies those four slugs from a SINGLE study_material_scopes row,
 * and universal_search built this row's slugs from one such row, so the
 * combination is guaranteed to list the material the student just clicked —
 * never a filter set we have not verified renders content. Anything the RPC
 * did not send is simply left out, which only widens the page.
 */
function materialsHref(extra) {
  const params = new URLSearchParams();
  if (extra.goal_slug) params.set("goal", extra.goal_slug);
  if (extra.class_slug) params.set("class", extra.class_slug);
  if (extra.subject_slug) params.set("subject", extra.subject_slug);
  if (extra.chapter_slug) params.set("chapter", extra.chapter_slug);
  if (extra.material_type) params.set("type", extra.material_type);
  const query = params.toString();
  return query ? `/materials?${query}` : "/materials";
}

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
    case "material":
      // Notes, formula sheets and full lecture notes: the /materials directory
      // is the only page that lists them, narrowed to this material's own
      // syllabus scope.
      return materialsHref(extra);
    case "paper": {
      // A previous-year paper belongs on its curated landing — organised by
      // year (and session/shift where the exam has them) — not the flat
      // directory. The RPC's jee_main_landing flag predates the NEET and
      // JEE Advanced landings, so the registry's own title-prefix test
      // decides (it is the same test the landing pages query with, so a
      // match is never a dead end). Unrecognised papers fall back to the
      // directory.
      const landing = landingForPaperTitle(row?.title);
      if (landing) return landing.path;
      return extra.jee_main_landing ? JEE_MAIN_PAPERS_PATH : materialsHref(extra);
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
