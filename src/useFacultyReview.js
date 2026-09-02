import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { isMissingFacultyCapability } from "./useFaculty.js";
import { withProposalContext } from "./facultyProposalContext.js";

const INITIAL = { groups: [], loading: true, error: null, unavailable: false };

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
    // be a worse tool than one that shows a little less.
    let rows = [];
    try {
      const catalogue = await supabase
        .from("playlists")
        .select("teacher, institutes_channels(name)")
        .not("teacher", "is", null)
        .limit(1000);
      if (gen !== generation.current) return;
      if (!catalogue.error) rows = catalogue.data ?? [];
      else console.error("faculty review context:", catalogue.error);
    } catch (reason) {
      console.error("faculty review context:", reason);
    }
    setState({
      groups: withProposalContext(data ?? [], rows),
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
