// useFaculty.js — faculty search, filters and profiles.
//
// IMPORTANT: there is no alias, honorific or normalisation logic in this file,
// and there must never be. "ABJ", "ABJ Sir" and "Amit Bijarnia" resolve to one
// record because search_teachers() in Postgres says so — behind indexes, using
// the aliases stored in teacher_aliases. Re-implementing any of that here would
// give the app a second, silently different definition of "same person".
//
//   useTeacherSearch(query)          -> ranked suggestions (RPC)
//   useFacultyFacets(scope)          -> filter options WITH counts (RPC)
//   useFacultyProfile(slug)          -> one faculty page (RPC)
//   useSimilarTeachers(name)         -> duplicate warnings for the admin (RPC)
//
// Every hook reports { loading, error } separately from "no results", so a
// failed query is never rendered as "this teacher has nothing".

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const NOT_CONFIGURED = "Supabase isn't configured.";
const MISSING_CAPABILITY = /does not exist|schema cache|PGRST202|42P01/i;

export function isMissingFacultyCapability(error) {
  return MISSING_CAPABILITY.test(`${error?.code ?? ""} ${error?.message ?? ""}`);
}

// Ranked faculty suggestions. Debounce upstream; this fires on every change.
export function useTeacherSearch(query, limit = 8) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({ results: [], loading: false, error: null });

  useEffect(() => {
    let active = true;
    const q = (query ?? "").trim();
    if (!q) { setState({ results: [], loading: false, error: null }); return; }
    if (!isSupabaseConfigured) { setState({ results: [], loading: false, error: NOT_CONFIGURED }); return; }

    setState((s) => ({ ...s, loading: true, error: null }));
    supabase
      .rpc("search_teachers", { p_query: q, p_limit: limit })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("search_teachers:", error);
          setState({ results: [], loading: false, error: "Couldn't search faculty." });
          return;
        }
        setState({ results: data ?? [], loading: false, error: null });
      });
    return () => { active = false; };
  }, [query, limit, generation]);

  return { ...state, retry: () => setGeneration((n) => n + 1) };
}

// Admin suggestions deliberately use the admin-only RPC. Unlike the public
// search, this includes proposed aliases so a curator can resolve old free-text
// values. It still returns EVERY tied candidate; the UI must never auto-pick.
export function useAdminTeacherSearch(query, limit = 8, enabled = true) {
  const [state, setState] = useState({
    results: [], loading: false, error: null, unavailable: false,
  });

  useEffect(() => {
    let active = true;
    const q = (query ?? "").trim();
    if (!enabled || q.length < 2) {
      setState({ results: [], loading: false, error: null, unavailable: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ results: [], loading: false, error: NOT_CONFIGURED, unavailable: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    supabase.rpc("search_teacher_candidates", { p_query: q, p_limit: limit })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (isMissingFacultyCapability(error)) {
            setState({ results: [], loading: false, error: null, unavailable: true });
            return;
          }
          console.error("search_teacher_candidates:", error);
          setState({
            results: [], loading: false,
            error: "Couldn't search the faculty registry.", unavailable: false,
          });
          return;
        }
        setState({ results: data ?? [], loading: false, error: null, unavailable: false });
      });
    return () => { active = false; };
  }, [query, limit, enabled]);

  return state;
}

// A separate capability RPC is important. teachers_v7 may be installed while
// the atomic import wrappers are not; seeing a working search box must never
// make the browser send teacher_ids to an importer that would silently ignore
// the unknown key.
export function useFacultyImportCapability() {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({
    supported: false, loading: true, error: null, unavailable: false,
  });

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState({ supported: false, loading: false, error: NOT_CONFIGURED, unavailable: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    supabase.rpc("faculty_import_capability")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (isMissingFacultyCapability(error)) {
            setState({ supported: false, loading: false, error: null, unavailable: true });
            return;
          }
          console.error("faculty_import_capability:", error);
          setState({
            supported: false, loading: false,
            error: "Couldn't verify faculty import support.", unavailable: false,
          });
          return;
        }
        setState({
          supported: data?.teacher_ids_supported === true,
          loading: false, error: null, unavailable: false,
        });
      });
    return () => { active = false; };
  }, [generation]);

  return { ...state, retry: () => setGeneration((n) => n + 1) };
}

// Filter options for the current context, counted BY THE DATABASE.
// Counting in the browser would mean paging the whole junction table.
export function useFacultyFacets({
  chapterId = null,
  subjectId = null,
  goalId = null,
  enabled = true,
} = {}) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({ facets: [], loading: true, error: null, unavailable: false });

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ facets: [], loading: true, error: null, unavailable: false });
      return;
    }
    if (!isSupabaseConfigured) { setState({ facets: [], loading: false, error: NOT_CONFIGURED }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));

    supabase
      .rpc("get_faculty_facets", {
        p_chapter_id: chapterId ?? null,
        p_subject_id: subjectId ?? null,
        p_goal_id: goalId ?? null,
      })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (isMissingFacultyCapability(error)) {
            // Capability absent (v7 not deployed) — hide the feature rather
            // than showing students an error about a table.
            setState({ facets: [], loading: false, error: null, unavailable: true });
            return;
          }
          console.error("get_faculty_facets:", error);
          setState({ facets: [], loading: false, error: "Couldn't load faculty filters." });
          return;
        }
        setState({ facets: data ?? [], loading: false, error: null });
      });
    return () => { active = false; };
  }, [chapterId, subjectId, goalId, enabled, generation]);

  return { ...state, retry: () => setGeneration((n) => n + 1) };
}

// Small, bounded dimension lists used by the faculty directory filters. The
// directory deliberately does not download courses to derive these options.
export function useFacultyDirectoryOptions() {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({
    goals: [], subjects: [], loading: true, error: null,
  });

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState({ goals: [], subjects: [], loading: false, error: NOT_CONFIGURED });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.all([
      supabase.from("learning_goals").select("id, slug, name").order("display_order"),
      supabase.from("subjects").select("id, slug, name").order("display_order"),
    ]).then(([goals, subjects]) => {
      if (!active) return;
      const failure = goals.error ?? subjects.error;
      if (failure) {
        console.error("faculty directory options:", failure);
        setState({
          goals: [], subjects: [], loading: false,
          error: "Couldn't load the faculty filters.",
        });
        return;
      }
      setState({
        goals: goals.data ?? [],
        subjects: subjects.data ?? [],
        loading: false,
        error: null,
      });
    });

    return () => { active = false; };
  }, [generation]);

  return { ...state, retry: () => setGeneration((n) => n + 1) };
}

// The playlist ids taught by a given teacher, for filtering a result list.
// Returns ids = null while unresolved or failed, so callers can tell "still
// working" apart from "this teacher has no courses here".
export function useTeacherPlaylistIds(teacherId) {
  const [state, setState] = useState({ ids: null, loading: false, error: null });

  useEffect(() => {
    let active = true;
    if (!teacherId) { setState({ ids: null, loading: false, error: null }); return; }
    if (!isSupabaseConfigured) { setState({ ids: null, loading: false, error: NOT_CONFIGURED }); return; }

    setState({ ids: null, loading: true, error: null });
    supabase
      .from("playlist_teachers")
      .select("playlist_id")
      .eq("teacher_id", teacherId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("playlist_teachers:", error);
          setState({ ids: null, loading: false, error: "Couldn't load this teacher's courses." });
          return;
        }
        setState({ ids: new Set((data ?? []).map((r) => r.playlist_id)), loading: false, error: null });
      });
    return () => { active = false; };
  }, [teacherId]);

  return state;
}

export function useFacultyProfile(slug) {
  const [state, setState] = useState({ profile: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    if (!slug) { setState({ profile: null, loading: false, error: null }); return; }
    if (!isSupabaseConfigured) { setState({ profile: null, loading: false, error: NOT_CONFIGURED }); return; }

    setState({ profile: null, loading: true, error: null });
    supabase
      .rpc("get_faculty_profile", { p_slug: slug })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("get_faculty_profile:", error);
          setState({ profile: null, loading: false, error: "Couldn't load this faculty page." });
          return;
        }
        setState({ profile: data ?? null, loading: false, error: null });
      });
    return () => { active = false; };
  }, [slug]);

  return state;
}

// Admin only: near-duplicate warning before creating a new faculty record.
export function useSimilarTeachers(name, enabled = true) {
  const [state, setState] = useState({ similar: [], loading: false, error: null });

  useEffect(() => {
    let active = true;
    const n = (name ?? "").trim();
    if (!enabled || n.length < 2 || !isSupabaseConfigured) {
      setState({ similar: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    supabase
      .rpc("similar_teachers", { p_name: n, p_limit: 5 })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("similar_teachers:", error);
          setState({ similar: [], loading: false, error: "Couldn't check for duplicates." });
          return;
        }
        setState({ similar: data ?? [], loading: false, error: null });
      });
    return () => { active = false; };
  }, [name, enabled]);

  return state;
}
