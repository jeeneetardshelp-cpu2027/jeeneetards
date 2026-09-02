// useExplore.js — bounded data for the guided Explore cascade.
//
//   useLearningGoals() — goals with distinct course counts
//   useClassLevels()   — the four stages (reference data)
//   useGoalCatalog(id) — the subjects and chapters that have content for one
//                        goal, so we never offer an empty branch (this is what
//                        makes "JEE hides Biology" fall out of real data).

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { CLASS_LEVELS_BY_GOAL } from "./classLevels.js";

const MISSING_CATALOG_RPC = /PGRST202|could not find the function|schema cache|function .* does not exist/i;
const MISSING_BOARD_CAPABILITY = /PGRST200|PGRST205|42P01|does not exist|schema cache/i;

export const isMissingCatalogRpc = (error) =>
  Boolean(error && (error.code === "PGRST202" || MISSING_CATALOG_RPC.test(error.message ?? "")));

const curriculumRow = (row) => ({
  id: row.entity_id,
  name: row.name,
  slug: row.slug,
  count: Number(row.course_count ?? 0),
  countUnit: "course",
});

export function useLearningGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setError("The course guide isn't available right now.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const load = async () => {
      const rpc = await supabase.rpc("get_browse_curriculum", {
        p_goal: null, p_class: null, p_subject: null,
      });
      if (!active) return;
      if (!rpc.error) {
        setGoals((rpc.data ?? []).map(curriculumRow));
        setLoading(false);
        return;
      }
      // Catalogue navigation is a verified production capability. Falling
      // back to video_learning_goals would download a junction that grows with
      // the entire catalogue and silently turn a server-bounded route into an
      // unbounded browser query. Fail honestly and let the student retry.
      console.error("browse curriculum goals:", rpc.error);
      setGoals([]);
      setError("We couldn't load the course guide.");
      setLoading(false);
    };

    load().catch((reason) => {
      if (!active) return;
      console.error("browse curriculum goals:", reason);
      setGoals([]);
      setError("We couldn't reach the course guide.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [nonce]);

  return { goals, loading, error, retry: () => setNonce((n) => n + 1) };
}

// The boards a School Boards student can pick, with how many courses each
// actually has — so an empty board is shown as "Coming soon" rather than
// leading to a dead end, exactly like goals.
// A failed query is NOT an empty board list. If the request errors we report
// the error, because "every board says Coming soon" and "the database is
// unreachable" look identical to a student otherwise.
export function useBoards(enabled = true) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setBoards([]);
      setLoading(false);
      setError(null);
      setUnavailable(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase isn't configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);

    supabase
      .from("boards")
      .select("id, name, slug, playlist_boards(count)")
      .order("display_order")
      .then((result) => {
        if (!active) return;
        if (result.error) {
          if (MISSING_BOARD_CAPABILITY.test(
            `${result.error.code ?? ""} ${result.error.message ?? ""}`,
          )) {
            setUnavailable(true); setLoading(false); return;   // capability absent, not a failure
          }
          console.error("boards:", result.error);
          setError("Couldn't load boards.");
          setBoards([]);
          setLoading(false);
          return;
        }
        setBoards(
          (result.data ?? []).map(({ playlist_boards: counts, ...board }) => ({
            ...board,
            courseCount: Number(counts?.[0]?.count ?? 0),
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("boards:", err);
        setError("Couldn't reach the database.");
        setLoading(false);
      });

    return () => { active = false; };
  }, [enabled]);

  return { boards, loading, error, unavailable };
}

export function useClassLevels() {
  const [classLevels, setClassLevels] = useState([]);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    supabase
      .from("class_levels")
      .select("id, name, slug")
      .order("display_order")
      .then(({ data }) => active && setClassLevels(data ?? []));
    return () => { active = false; };
  }, []);

  return { classLevels };
}

// Class levels are reference data, but not every valid class has catalogue
// content. Resolve the small, fixed set in parallel so the guided journey
// never links a student (or a JS-capable crawler) into an honest-empty branch.
export function usePopulatedClasses(goal, enabled = true) {
  const [classSlugs, setClassSlugs] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && goal));
  const [error, setError] = useState(null);
  const [loadedGoal, setLoadedGoal] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    if (!enabled || !goal) {
      setClassSlugs([]);
      setLoading(false);
      setError(null);
      setLoadedGoal(null);
      return;
    }
    if (!isSupabaseConfigured) {
      setClassSlugs([]);
      setLoading(false);
      setError("The course guide isn't available right now.");
      setLoadedGoal(null);
      return;
    }

    const candidates = CLASS_LEVELS_BY_GOAL[goal] ?? [];
    setLoading(true);
    setError(null);
    setLoadedGoal(null);

    Promise.all(candidates.map(async (classSlug) => {
      const result = await supabase.rpc("get_browse_curriculum", {
        p_goal: goal,
        p_class: classSlug,
        p_subject: null,
      });
      if (result.error) throw result.error;
      return { classSlug, populated: (result.data ?? []).length > 0 };
    })).then((results) => {
      if (!active) return;
      setClassSlugs(results.filter((item) => item.populated).map((item) => item.classSlug));
      setLoadedGoal(goal);
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      console.error("browse curriculum classes:", reason);
      setClassSlugs([]);
      setError("We couldn't load the available stages.");
      setLoadedGoal(null);
      setLoading(false);
    });

    return () => { active = false; };
  }, [goal, enabled, nonce]);

  return {
    classSlugs,
    loading,
    error,
    ready: enabled && loadedGoal === goal,
    retry: () => setNonce((value) => value + 1),
  };
}

// The bounded subject/chapter tree for one goal and class. v9 returns DISTINCT
// course counts in one or two small RPC calls; it never downloads the growing
// video junction into the browser.
export function useGoalCatalog({ goal, stage, subject } = {}) {
  const [subjects, setSubjects] = useState([]);
  const [chaptersBySubject, setChaptersBySubject] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  // Which {goal, stage, subject} the data in state belongs to. State survives
  // param-only navigations (the component instance is preserved), and `loading`
  // only flips inside this effect — so on the FIRST render after such a
  // navigation the consumer sees loading=false with another scope's data.
  // Consumers that must not act on stale data check `ready` instead.
  const [loadedKey, setLoadedKey] = useState(null);
  const requestKey = `${goal ?? ""}|${stage ?? ""}|${subject ?? ""}`;

  useEffect(() => {
    let active = true;
    const key = `${goal ?? ""}|${stage ?? ""}|${subject ?? ""}`;
    if (!isSupabaseConfigured || !goal) {
      setSubjects([]);
      setChaptersBySubject({});
      setError(isSupabaseConfigured ? null : "The course guide isn't available right now.");
      setLoading(false);
      setLoadedKey(null);
      return;
    }
    setLoading(true);
    setError(null);

    const load = async () => {
      const args = { p_goal: goal, p_class: stage ?? null, p_subject: null };
      // Both calls together, not one after the other. The chapter call's
      // arguments come from `subject` — a prop — so it never depended on the
      // subject response; that response is only needed afterwards, to map the
      // chosen subject to its id.
      const [subjectResult, chapterResult] = await Promise.all([
        supabase.rpc("get_browse_curriculum", args),
        subject
          ? supabase.rpc("get_browse_curriculum", { ...args, p_subject: subject })
          : Promise.resolve(null),
      ]);
      if (!active) return;
      if (subjectResult.error) throw subjectResult.error;
      if (chapterResult?.error) throw chapterResult.error;

      const nextSubjects = (subjectResult.data ?? []).map(curriculumRow);
      let nextChapters = {};
      if (subject && chapterResult) {
        const selected = nextSubjects.find((row) => row.slug === subject);
        if (selected)
          nextChapters = { [selected.id]: (chapterResult.data ?? []).map(curriculumRow) };
      }
      if (!active) return;
      setSubjects(nextSubjects);
      setChaptersBySubject(nextChapters);
      setLoadedKey(key);
      setLoading(false);
    };

    load().catch((reason) => {
      if (!active) return;
      console.error("goal catalog:", reason);
      setSubjects([]);
      setChaptersBySubject({});
      setError("We couldn't load this part of the course guide.");
      setLoading(false);
      setLoadedKey(null);
    });

    return () => { active = false; };
  }, [goal, stage, subject, nonce]);

  return {
    subjects, chaptersBySubject, loading, error,
    // True only when the data in state was loaded for exactly the current
    // request — never true for another scope's leftovers.
    ready: !loading && !error && loadedKey === requestKey,
    retry: () => setNonce((n) => n + 1),
  };
}
