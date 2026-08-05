import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { isMissingStudyMaterialsRpc } from "./useStudyMaterials.js";

const EMPTY = Object.freeze({
  goals: [], boards: [], classes: [], subjects: [], chapters: [],
});

function mapNode(row) {
  if (!row?.entity_id || !row?.level || !row?.slug || !row?.name) return null;
  return {
    id: Number(row.entity_id),
    slug: row.slug,
    name: row.name,
    count: Number(row.resource_count ?? 0),
  };
}

export function mapStudyMaterialCatalog(rows = []) {
  const result = {
    goals: [], boards: [], classes: [], subjects: [], chapters: [],
  };
  const keys = {
    goal: "goals", board: "boards", class: "classes",
    subject: "subjects", chapter: "chapters",
  };
  rows.forEach((row) => {
    const key = keys[row?.level];
    const node = mapNode(row);
    if (key && node) result[key].push(node);
  });
  return result;
}

export async function fetchStudyMaterialCatalog(client, filters = {}, { signal } = {}) {
  let query = client.rpc("get_study_material_curriculum", {
    p_goal_slug: filters.goal ?? null,
    p_board_slug: filters.board ?? null,
    p_class_slug: filters.stage ?? null,
    p_subject_slug: filters.subject ?? null,
  });
  if (signal && typeof query.abortSignal === "function") query = query.abortSignal(signal);
  const result = await query;
  if (result.error) {
    return {
      data: EMPTY,
      error: result.error,
      unavailable: isMissingStudyMaterialsRpc(result.error),
    };
  }
  return { data: mapStudyMaterialCatalog(result.data), error: null, unavailable: false };
}

export function useStudyMaterialCatalog(filters = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: null, unavailable: false });
  const generation = useRef(0);
  const request = useRef(null);
  const { goal = null, board = null, stage = null, subject = null } = filters;

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    request.current?.abort();
    request.current = null;
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, loading: false, error: "Study-material filters aren't available right now.", unavailable: false });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const result = await fetchStudyMaterialCatalog(supabase, {
        goal, board, stage, subject,
      }, { signal: controller.signal });
      if (currentGeneration !== generation.current) return;
      if (result.error) {
        if (!result.unavailable) console.error("study material curriculum:", result.error);
        setState({
          ...EMPTY,
          loading: false,
          unavailable: result.unavailable,
          error: result.unavailable ? null : "Couldn't load study-material filters.",
        });
        return;
      }
      setState({ ...result.data, loading: false, error: null, unavailable: false });
    } catch (reason) {
      if (currentGeneration !== generation.current || controller.signal.aborted) return;
      console.error("study material curriculum:", reason);
      setState({ ...EMPTY, loading: false, error: "Couldn't reach the study-material filters.", unavailable: false });
    }
  }, [board, goal, stage, subject]);

  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [load]);

  return { ...state, retry: load };
}
