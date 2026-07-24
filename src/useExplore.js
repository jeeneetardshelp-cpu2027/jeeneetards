// useExplore.js — data for the guided Explore cascade, from the structured
// learning_goals / class_levels tables + the goal↔video junction.
//
//   useLearningGoals() — goals that actually have content (+ counts)
//   useClassLevels()   — the four stages (reference data)
//   useGoalCatalog(id) — the subjects and chapters that have content for one
//                        goal, so we never offer an empty branch (this is what
//                        makes "JEE hides Biology" fall out of real data).

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const MISSING_CATALOG_RPC = /PGRST202|could not find the function|schema cache|function .* does not exist/i;

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
      if (!isMissingCatalogRpc(rpc.error)) {
        console.error("browse curriculum goals:", rpc.error);
        setGoals([]);
        setError("We couldn't load the course guide.");
        setLoading(false);
        return;
      }

      // Compatibility only: production can keep browsing while v9 is rolled
      // out deliberately. This old path counts lectures, so it labels them as
      // lectures and never pretends they are distinct course counts.
      const [goalRows, links] = await Promise.all([
        supabase.from("learning_goals").select("id, name, slug").order("display_order"),
        supabase.from("video_learning_goals").select("learning_goal_id"),
      ]);
      if (!active) return;
      if (goalRows.error || links.error) {
        console.error("legacy browse curriculum goals:", goalRows.error ?? links.error);
        setGoals([]);
        setError("We couldn't load the course guide.");
      } else {
        const counts = new Map();
        for (const row of links.data ?? [])
          counts.set(row.learning_goal_id, (counts.get(row.learning_goal_id) ?? 0) + 1);
        setGoals((goalRows.data ?? []).map((row) => ({
          ...row,
          count: counts.get(row.id) ?? 0,
          countUnit: "lecture",
        })));
      }
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
// A failed query is NOT an empty board list. If either request errors we
// report the error, because "every board says Coming soon" and "the database
// is unreachable" look identical to a student otherwise.
export function useBoards() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setError("Supabase isn't configured.");
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from("boards").select("id, name, slug").order("display_order"),
      supabase.from("playlist_boards").select("board_id"),
    ])
      .then(([b, links]) => {
        if (!active) return;
        if (b.error || links.error) {
          if (/does not exist|schema cache|42P01/i.test((b.error ?? links.error)?.message || '')) {
            setUnavailable(true); setLoading(false); return;   // capability absent, not a failure
          }
          console.error("boards:", b.error ?? links.error);
          setError("Couldn't load boards.");
          setBoards([]);
          setLoading(false);
          return;
        }
        const counts = new Map();
        for (const r of links.data ?? [])
          counts.set(r.board_id, (counts.get(r.board_id) ?? 0) + 1);
        setBoards(
          (b.data ?? []).map((x) => ({ ...x, courseCount: counts.get(x.id) ?? 0 }))
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
  }, []);

  return { boards, loading, error, unavailable };
}

// The playlist ids belonging to one board.
//
// Returns { ids, loading, error } so callers can tell "still resolving" and
// "query failed" apart from "this board genuinely has nothing". Collapsing
// those three into a bare null (as this used to) makes a board-scoped page
// render "no playlists" while it is still loading, and again when the query
// fails — telling a student their board is empty on no evidence at all.
export function useBoardPlaylistIds(boardId) {
  const [state, setState] = useState({ ids: null, loading: false, error: null });

  useEffect(() => {
    let active = true;
    if (!boardId) { setState({ ids: null, loading: false, error: null }); return; }
    if (!isSupabaseConfigured) {
      setState({ ids: null, loading: false, error: "Supabase isn't configured." });
      return;
    }
    setState({ ids: null, loading: true, error: null });
    supabase
      .from("playlist_boards")
      .select("playlist_id")
      .eq("board_id", boardId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("board playlists:", error);
          setState({ ids: null, loading: false, error: "Couldn't load board information." });
          return;
        }
        setState({ ids: new Set((data ?? []).map((r) => r.playlist_id)), loading: false, error: null });
      });
    return () => { active = false; };
  }, [boardId]);

  return state;
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

// The bounded subject/chapter tree for one goal and class. v9 returns DISTINCT
// course counts in one or two small RPC calls; it never downloads the growing
// video junction into the browser.
export function useGoalCatalog({ goal, goalId, stage, subject } = {}) {
  const [subjects, setSubjects] = useState([]);
  const [chaptersBySubject, setChaptersBySubject] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !goal) {
      setSubjects([]);
      setChaptersBySubject({});
      setError(isSupabaseConfigured ? null : "The course guide isn't available right now.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const loadLegacy = async () => {
      if (!goalId) throw new Error("Legacy course guide needs a goal id.");
      const legacy = await supabase
        .from("videos")
        .select(
          "id, subject_id, subjects(name, slug), chapter_id, chapters(name, slug)," +
            " video_learning_goals!inner(learning_goal_id)"
        )
        .eq("video_learning_goals.learning_goal_id", goalId);
      if (legacy.error) throw legacy.error;
      const subs = new Map();
      const chaps = {};
      for (const video of legacy.data ?? []) {
        if (!video.subject_id) continue;
        if (!subs.has(video.subject_id)) subs.set(video.subject_id, {
          id: video.subject_id,
          name: video.subjects?.name ?? "Unknown subject",
          slug: video.subjects?.slug ?? String(video.subject_id),
          count: 0,
          countUnit: "lecture",
        });
        subs.get(video.subject_id).count += 1;
        if (video.chapter_id) {
          chaps[video.subject_id] ??= new Map();
          const byId = chaps[video.subject_id];
          if (!byId.has(video.chapter_id)) byId.set(video.chapter_id, {
            id: video.chapter_id,
            name: video.chapters?.name ?? "Unknown chapter",
            slug: video.chapters?.slug ?? String(video.chapter_id),
            count: 0,
            countUnit: "lecture",
          });
          byId.get(video.chapter_id).count += 1;
        }
      }
      const byName = (a, b) => a.name.localeCompare(b.name);
      return {
        subjects: [...subs.values()].sort(byName),
        chapters: Object.fromEntries(
          Object.entries(chaps).map(([id, rows]) => [id, [...rows.values()].sort(byName)])
        ),
      };
    };

    const load = async () => {
      const args = { p_goal: goal, p_class: stage ?? null, p_subject: null };
      const subjectResult = await supabase.rpc("get_browse_curriculum", args);
      if (!active) return;
      if (subjectResult.error) {
        if (!isMissingCatalogRpc(subjectResult.error)) throw subjectResult.error;
        const fallback = await loadLegacy();
        if (!active) return;
        setSubjects(fallback.subjects);
        setChaptersBySubject(fallback.chapters);
        setLoading(false);
        return;
      }

      const nextSubjects = (subjectResult.data ?? []).map(curriculumRow);
      let nextChapters = {};
      if (subject) {
        const chapterResult = await supabase.rpc("get_browse_curriculum", {
          ...args, p_subject: subject,
        });
        if (chapterResult.error) throw chapterResult.error;
        const selected = nextSubjects.find((row) => row.slug === subject);
        if (selected)
          nextChapters = { [selected.id]: (chapterResult.data ?? []).map(curriculumRow) };
      }
      if (!active) return;
      setSubjects(nextSubjects);
      setChaptersBySubject(nextChapters);
      setLoading(false);
    };

    load().catch((reason) => {
      if (!active) return;
      console.error("goal catalog:", reason);
      setSubjects([]);
      setChaptersBySubject({});
      setError("We couldn't load this part of the course guide.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [goal, goalId, stage, subject, nonce]);

  return {
    subjects, chaptersBySubject, loading, error,
    retry: () => setNonce((n) => n + 1),
  };
}
