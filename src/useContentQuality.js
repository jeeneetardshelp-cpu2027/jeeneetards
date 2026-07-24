import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { isMissingFacultyCapability } from "./useFaculty.js";

const EMPTY = { rows: [], loading: true, error: null, unavailable: false };

export function useContentQualityCapability() {
  const [state, setState] = useState({ supported: false, loading: true, unavailable: false, error: null });
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState({ supported: false, loading: false, unavailable: false, error: "Supabase isn't configured." });
      return;
    }
    supabase.rpc("content_quality_capability").then(({ data, error }) => {
      if (!active) return;
      if (error) {
        if (isMissingFacultyCapability(error)) {
          setState({ supported: false, loading: false, unavailable: true, error: null });
        } else {
          setState({ supported: false, loading: false, unavailable: false, error: "Couldn't verify content-quality support." });
        }
        return;
      }
      setState({
        supported: data?.source_title_supported === true,
        loading: false, unavailable: false, error: null,
      });
    });
    return () => { active = false; };
  }, []);
  return state;
}

export function useContentQualityQueue(ready = false) {
  const [state, setState] = useState(EMPTY);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const gen = ++generation.current;
    if (!isSupabaseConfigured) {
      setState({ rows: [], loading: false, unavailable: false, error: "Supabase isn't configured." });
      return;
    }
    setState((old) => ({ ...old, loading: true, error: null }));
    const { data, error } = await supabase.rpc("get_content_quality_queue", {
      p_ready: ready, p_limit: 100, p_offset: 0,
    });
    if (gen !== generation.current) return;
    if (error) {
      if (isMissingFacultyCapability(error)) {
        setState({ rows: [], loading: false, unavailable: true, error: null });
      } else {
        console.error("get_content_quality_queue:", error);
        setState({ rows: [], loading: false, unavailable: false, error: "Couldn't load the content-quality queue." });
      }
      return;
    }
    setState({ rows: data ?? [], loading: false, unavailable: false, error: null });
  }, [ready]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export async function reviewPlaylistQuality(args) {
  const { data, error } = await supabase.rpc("review_playlist_quality", args);
  if (error) throw new Error(error.message || "Content review failed.");
  return data;
}

