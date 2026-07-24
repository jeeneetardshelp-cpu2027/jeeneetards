// usePlaylistBrowse.js — paged playlist listing for the catalogue.
//
// The old catalogue fetched every video (VIDEO_LIMIT 200) and rendered 40 raw
// YouTube thumbnails. This fetches PLAYLISTS, a page at a time, with the
// metadata a student actually decides on.
//
// Nothing is invented. A field the database does not have comes back null and
// the card says so ("Not yet rated", "Coverage not assessed") rather than
// showing a plausible-looking zero.

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { classSlugsForStage } from "./classLevels.js";
export { classSlugsForStage } from "./classLevels.js";

export const PAGE_SIZE = 12;

// One row -> the shape the card renders. Explicit nulls, never defaults.
function toCard(row) {
  const lectures = row.playlist_videos?.[0]?.count ?? null;
  const ratings = Number(row.ratings_count ?? 0);
  return {
    id: row.id,
    title: row.title,                       // curated title — dominates the card
    teacher: row.teacher ?? null,           // LEGACY free text. Not a resolved identity.
    institute: row.institutes_channels?.name ?? null,
    subject: row.subjects?.name ?? null,
    lectures,
    // NOTE: total duration is NOT a column on playlists — it is computed inside
    // get_chapter_courses(). Rather than invent a number here, it stays null and
    // the card omits the field. A database-side aggregate view is the correct
    // fix and is on the follow-up list.
    durationSeconds: null,
    language: row.language ?? null,
    contentType: row.content_type ?? null,
    difficulty: row.difficulty ?? null,
    classLevels: row.class_levels ?? [],
    rating: ratings > 0 ? Number(row.average_rating) : null,
    ratingCount: ratings,
    // no coverage column exists yet — the card must say "not assessed", not 0%
    coverage: null,
  };
}

/**
 * Which class_levels.slug values satisfy a chosen stage.
 *
 * Dropper is a SUPERSET: a dropper revises both years, so 11th and 12th
 * material counts. Class 11 and Class 12 are exact — Class 11 must never pick
 * up Class-12-only content. classLevels.js owns this rule for in-memory
 * checks; this is the same rule expressed as the set the DATABASE filters on,
 * and classFilter.test.js asserts the two agree.
 */
export function usePlaylistBrowse({
  goalId, boardId, subjectId, chapterId, stage, channelId, teacherId,
  language, contentType, difficulty, search, page = 0,
  // GATE. When false, no request is issued at all and the hook reports
  // loading. The caller sets this from useCanonicalFilters().ready, so a URL
  // carrying slugs cannot fire a catalogue query before those slugs are ids.
  //
  // The generation guard below would discard the early response, but it
  // cannot un-send the request — and for the moment before the real one
  // returns, an unfiltered result set is on screen under a filtered heading.
  // Not querying at all is the only correct behaviour.
  enabled = true,
}) {
  const classSlugs = classSlugsForStage(stage);
  const [state, setState] = useState({
    items: [], total: null, loading: true, error: null, hasMore: false,
  });

  // Discards obsolete responses. Filters resolve asynchronously (a slug has to
  // become an id), so this hook runs once with no chapter and again with one.
  // Without a generation guard the FIRST, unfiltered response can land last
  // and overwrite the filtered one — which is exactly what made /browse?ch=1
  // show all 7 courses while the correct 5-course request had already
  // returned. Same class of bug as a search box showing results for a prefix.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    if (!enabled) {
      // Hold the skeleton rather than showing a stale or unfiltered list.
      setState({ items: [], total: null, loading: true, error: null, hasMore: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ items: [], total: null, loading: false, error: "Supabase isn't configured.", hasMore: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    // Every filter runs IN THE DATABASE and the page is fetched with range().
    // The previous version pulled every playlist_videos row for a chapter into
    // the browser, deduped it, then passed the whole id list back as .in(...) —
    // unbounded work that grows with the catalogue.
    //
    // Inner joins are added ONLY when their filter is active: making them
    // unconditional would silently drop playlists that have no goal tag or no
    // videos from the unfiltered view.
    const cols =
      "id, title, teacher, average_rating, ratings_count, language, content_type," +
      " difficulty, class_levels, institutes_channels(name), subjects(name)," +
      " playlist_videos(count)" +
      (goalId ? ", playlist_learning_goals!inner(learning_goal_id)" : "") +
      // Board scoping lives in the QUERY, not in a post-filter. CBSE and ICSE
      // must never bleed into each other, and filtering after paging would
      // silently drop rows from an already-truncated page.
      (boardId ? ", playlist_boards!inner(board_id)" : "") +
      // CLASS runs in the database too, through the playlist_class_levels
      // junction — an indexed, importer-maintained store, not the denormalised
      // playlists.class_levels[] label array.
      //
      // The !inner join is what makes "untagged matches nothing" true for free:
      // a playlist with no junction row cannot satisfy an inner join, so it
      // drops out before LIMIT/OFFSET and before count. Filtering a fetched
      // page in React would give both a wrong count and a short page.
      (classSlugs ? ", pcl:playlist_class_levels!inner(class_levels!inner(slug))" : "") +
      // Faculty filtering is course-scoped and happens before range()/count.
      // It is included only when teachers_v7 capability has been confirmed.
      (teacherId ? ", pt:playlist_teachers!inner(teacher_id)" : "") +
      (chapterId ? ", pv:playlist_videos!inner(videos!inner(chapter_id))" : "");

    let q = supabase
      .from("playlists")
      .select(cols, { count: "exact" })
      // STABLE ORDER. Without a unique final key, rows that tie on
      // ratings_count AND title can come back in a different order per
      // request, so the same playlist can appear on page 1 and page 2 while
      // another never appears at all. id is unique, so it makes the total
      // order deterministic.
      .order("ratings_count", { ascending: false })
      .order("title")
      .order("id")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Learning goal was accepted as a prop and never applied, so a JEE view
    // also listed NEET courses. Goal isolation is the point of the journey.
    if (goalId) q = q.eq("playlist_learning_goals.learning_goal_id", goalId);
    if (boardId) q = q.eq("playlist_boards.board_id", boardId);
    if (classSlugs) q = q.in("pcl.class_levels.slug", classSlugs);
    if (subjectId) q = q.eq("subject_id", subjectId);
    // Scalar columns on playlists — no join needed, so these cost nothing extra.
    // Multi-select uses .in(); a single value still goes through .in() so the
    // AND-of-ORs shape is identical whether one or three values are chosen.
    if (channelId) q = q.eq("channel_id", channelId);
    if (teacherId) q = q.eq("pt.teacher_id", teacherId);
    if (language?.length) q = q.in("language", language);
    if (contentType?.length) q = q.in("content_type", contentType);
    if (difficulty?.length) q = q.in("difficulty", difficulty);
    if (chapterId) q = q.eq("pv.videos.chapter_id", chapterId);
    const term = (search ?? "").trim();
    if (term) q = q.ilike("title", `%${term}%`);

    const { data, error, count } = await q;
    if (!current()) return;                    // a newer query has superseded this one
    if (error) {
      // PostgREST answers a range past the end of the result set with 416
      // "Requested range not satisfiable" rather than an empty page. A stale
      // ?page=99 in a shared URL is a normal thing for a student to hit, and it
      // must read as an empty page, not as a failure. (Found by running the
      // real query against staging — the mocked builder could not surface it.)
      const outOfRange = error.code === "PGRST103" || /range not satisfiable/i.test(error.message || "");
      if (outOfRange) {
        setState({ items: [], total: count ?? null, loading: false, error: null, hasMore: false });
        return;
      }
      console.error("playlist browse:", error);
      setState({ items: [], total: null, loading: false, error: "Couldn't load courses.", hasMore: false });
      return;
    }
    const items = (data ?? []).map(toCard);
    setState({
      items, total: count ?? null, loading: false, error: null,
      hasMore: count != null ? (page + 1) * PAGE_SIZE < count : items.length === PAGE_SIZE,
    });
  }, [enabled, goalId, boardId, subjectId, chapterId, stage, channelId, teacherId,
      language?.join(","), contentType?.join(","), difficulty?.join(","),
      search, page]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// "1h 40m" / "45m". Returns null when unknown so the caller can omit the field
// entirely rather than printing "0m".
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
