import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { isMissingFacultyCapability } from "./useFaculty.js";

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
    setState({ groups: data ?? [], loading: false, error: null, unavailable: false });
  }, [status]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export async function runFacultyReviewAction(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message || "Faculty review failed.");
  return data;
}
