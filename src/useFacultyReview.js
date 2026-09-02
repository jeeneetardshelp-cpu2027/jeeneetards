import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { isMissingFacultyCapability } from "./useFaculty.js";
import { withProposalContext } from "./facultyProposalContext.js";

const INITIAL = { groups: [], loading: true, error: null, unavailable: false };

// PostgREST's own per-request ceiling. Asking for more in one call does not
// get more; it silently gets this.
const PAGE = 1000;

// 20,000 courses. A backstop against a paging loop that never terminates, not
// a limit on the catalogue — production holds 484. If it is ever reached the
// read is abandoned rather than truncated, for the reason below.
const MAX_PAGES = 20;

/**
 * Every (teacher, channel) pair in the catalogue, or null if that cannot be
 * established.
 *
 * WHY THIS PAGES. The previous version asked for `.limit(1000)` once. That
 * reads as "everything" and means "the first 1000", and PostgREST reports no
 * error and sets no flag when it truncates. With 484 courses today the two are
 * the same; past 1000 they diverge silently.
 *
 * WHY A PARTIAL READ RETURNS null RATHER THAN WHAT IT GOT. proposalContext
 * derives `isChannelName` as `channelNamed === total` — true only when EVERY
 * course carrying a name sits on a channel of that name. Drop some of a
 * teacher's rows and that equality can flip from false to TRUE, so a truncated
 * read does not merely undercount: it can tell a reviewer that a real person is
 * "very likely the channel itself" and steer them to reject a real teacher.
 * A sample is worse than nothing here, so an incomplete read is discarded.
 *
 * @param stillCurrent () => boolean — false once a newer load has superseded
 *   this one, so an abandoned read stops paging instead of finishing quietly.
 * @returns rows, or null if the catalogue could not be read in full
 */
async function readTeacherChannels(stillCurrent) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from("playlists")
      .select("teacher, institutes_channels(name)")
      .not("teacher", "is", null)
      // Required, not tidiness: .range() over an unordered result can hand back
      // the same row twice and never hand back another.
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (!stillCurrent()) return null;
    if (error) {
      console.error("faculty review context:", error);
      return null;
    }
    const batch = data ?? [];
    rows.push(...batch);
    // A short page is the end of the table. This is the only success exit.
    if (batch.length < PAGE) return rows;
  }
  console.error(
    `faculty review context: catalogue exceeds ${MAX_PAGES * PAGE} courses, so it was not read in full`,
  );
  return null;
}

export function useFacultyReview(status = "pending") {
  const [state, setState] = useState(INITIAL);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    if (!isSupabaseConfigured) {
      setState({ groups: [], loading: false, error: "Supabase isn't configured.", unavailable: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("get_faculty_review_groups", { p_status: status });
    if (gen !== generation.current) return;
    if (error) {
      if (isMissingFacultyCapability(error)) {
        setState({ groups: [], loading: false, error: null, unavailable: true });
        return;
      }
      console.error("get_faculty_review_groups:", error);
      setState({ groups: [], loading: false, error: "Couldn't load faculty proposals.", unavailable: false });
      return;
    }
    // Which channel a proposed name teaches on is the one fact that separates
    // "Magnet Brains, an organisation" from "Mohit Tyagi, a person whose
    // channel carries their name". get_faculty_review_groups does not return
    // it, so it is joined on here from the catalogue.
    //
    // Best effort on purpose: the queue is the point, the context is a help.
    // If this read fails the groups still render, just without it — an admin
    // screen that refuses to load because an annotation was unavailable would
    // be a worse tool than one that shows a little less. What it must never do
    // is render context computed from part of the catalogue.
    let rows = null;
    try {
      rows = await readTeacherChannels(() => gen === generation.current);
    } catch (reason) {
      console.error("faculty review context:", reason);
    }
    if (gen !== generation.current) return;
    setState({
      groups: withProposalContext(data ?? [], rows ?? []),
      loading: false,
      error: null,
      unavailable: false,
    });
  }, [status]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export async function runFacultyReviewAction(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message || "Faculty review failed.");
  return data;
}
