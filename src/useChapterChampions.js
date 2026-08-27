// useChapterChampions — per-chapter clarity/question rating champions.
//
// CourseRating has always collected clarity_rating ("was the explanation
// clear?") and question_rating ("are the solved questions good?") and no
// student-facing surface ever showed either. The reviews hardening
// deliberately keeps both columns out of anon's column grant, so the ONLY
// sanctioned read path is the get_chapter_champions RPC — a definer function
// returning per-course AGGREGATES for one chapter, each dimension's average
// already confidence-gated server-side (NULL below the 5-vote floor).
//
// Degrades exactly like the browse-search hooks: if the RPC is not deployed
// yet (isMissingCatalogRpc), the board simply does not exist — no error, no
// empty panel. The frontend is safe to ship in any order relative to the SQL.

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { isMissingCatalogRpc } from "./useExplore.js";

/**
 * Pure champion pick, exported for tests. For one dimension key
 * ("clarity" | "question"): the row with the highest confident average;
 * ties break on vote count, then on the stable playlist id. Rows whose
 * average is NULL (below the server-side floor) can never win.
 */
export function pickChampion(rows, dimension) {
  const avgKey = `${dimension}_avg`;
  const nKey = `${dimension}_n`;
  let best = null;
  for (const row of rows ?? []) {
    const avg = row?.[avgKey] == null ? null : Number(row[avgKey]);
    if (avg == null || !Number.isFinite(avg)) continue;
    if (
      !best
      || avg > best.avg
      || (avg === best.avg && Number(row[nKey]) > best.n)
      || (avg === best.avg && Number(row[nKey]) === best.n && row.playlist_id < best.row.playlist_id)
    ) {
      best = { row, avg, n: Number(row[nKey]) };
    }
  }
  return best
    ? { ...best.row, score: best.avg, count: best.n }
    : null;
}

export function useChapterChampions(chapterId) {
  const enabled = Number.isInteger(chapterId) && chapterId > 0;
  const [state, setState] = useState({ rows: [], loading: enabled });

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setState({ rows: [], loading: false });
      return undefined;
    }
    let active = true;
    setState({ rows: [], loading: true });
    supabase
      .rpc("get_chapter_champions", { p_chapter: chapterId })
      .then(({ data, error }) => {
        if (!active) return;
        // A missing RPC (not yet deployed) and any other failure both render
        // as silence — a champions board that might be wrong is worse than no
        // board, and the surrounding page loses nothing.
        if (error) {
          if (!isMissingCatalogRpc(error)) {
            console.error("chapter champions:", error);
          }
          setState({ rows: [], loading: false });
          return;
        }
        setState({ rows: Array.isArray(data) ? data : [], loading: false });
      });
    return () => {
      active = false;
    };
  }, [enabled, chapterId]);

  return {
    loading: state.loading,
    clarity: pickChampion(state.rows, "clarity"),
    question: pickChampion(state.rows, "question"),
  };
}
