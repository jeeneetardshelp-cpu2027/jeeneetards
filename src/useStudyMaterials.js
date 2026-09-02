// Bounded study-material reads for both the directory and the watch page.
// The database owns review/rights filtering; this mapper only turns the RPC's
// snake_case contract into the small, predictable shape components consume.

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

export const STUDY_MATERIAL_PAGE_SIZE = 60;

// The full vocabulary — it mirrors the database's material_type check
// constraint. Every value stays here even when the library holds no rows of
// it, because two things need the whole set: materialTypeLabel() must still
// name a row of any type, and studyMaterialScope.js validates ?type= against
// these values, so a link that names a type must parse rather than be dropped.
export const STUDY_MATERIAL_TYPES = Object.freeze([
  // Zero rows in production (0 of 408 on 2026-09-01), so it is known but not
  // offered: the page must not hand a student a filter that can only ever
  // return nothing, and the copy must not promise it. Flip `offered` when the
  // first short note is approved — nothing else needs to change.
  { value: "short_notes", label: "Short notes", offered: false },
  { value: "formula_sheet", label: "Formula sheets" },
  { value: "full_notes", label: "Full lecture notes" },
  { value: "previous_year_paper", label: "Previous-year papers" },
]);

// What the page actually offers as a filter: the types a student can find
// something under. Derived, so the two lists cannot drift apart.
export const OFFERED_MATERIAL_TYPES = Object.freeze(
  STUDY_MATERIAL_TYPES.filter((item) => item.offered !== false),
);

const TYPE_LABELS = new Map(STUDY_MATERIAL_TYPES.map((item) => [item.value, item.label]));
const MISSING_RPC = /PGRST202|could not find the function|schema cache|does not exist/i;

const EMPTY = {
  items: [], total: 0, loading: false, loadingMore: false,
  error: null, loadMoreError: null, unavailable: false,
};

export function materialTypeLabel(value) {
  return TYPE_LABELS.get(value) ?? "Study material";
}

export function mapStudyMaterial(row) {
  if (!row?.id || !row?.title || !row?.source_url) return null;
  if (!/^https:\/\//i.test(row.source_url)) return null;
  const scopes = Array.isArray(row.scopes) ? row.scopes : [];
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description ?? null,
    type: row.material_type,
    typeLabel: materialTypeLabel(row.material_type),
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    previewImageUrl: /^https:\/\//i.test(row.preview_image_url ?? "")
      ? row.preview_image_url
      : null,
    fileFormat: row.file_format ?? "web",
    language: row.language ?? null,
    examYear: row.exam_year == null ? null : Number(row.exam_year),
    pageCount: row.page_count == null ? null : Number(row.page_count),
    downloadable: Boolean(row.is_downloadable),
    rightsStatus: row.rights_status,
    scopes,
  };
}

export const isMissingStudyMaterialsRpc = (error) => Boolean(
  error && (error.code === "PGRST202" || MISSING_RPC.test(error.message ?? "")),
);

export async function fetchStudyMaterials(client, filters = {}, { signal } = {}) {
  const args = {
    p_goal_slug: filters.goal ?? null,
    p_board_slug: filters.board ?? null,
    p_class_slug: filters.stage ?? null,
    p_subject_slug: filters.subject ?? null,
    p_chapter_slug: filters.chapter ?? null,
    p_chapter_id: filters.chapterId ?? null,
    p_video_id: filters.videoId ?? null,
    p_material_type: filters.type ?? null,
    p_limit: Math.min(Math.max(Number(filters.limit ?? STUDY_MATERIAL_PAGE_SIZE), 1), 100),
    p_offset: Math.max(Number(filters.offset ?? 0), 0),
  };
  let query = client.rpc("get_study_materials", args);
  if (signal && typeof query.abortSignal === "function") query = query.abortSignal(signal);
  const result = await query;
  if (result.error) return { data: null, error: result.error, unavailable: isMissingStudyMaterialsRpc(result.error) };
  const items = (result.data ?? []).map(mapStudyMaterial).filter(Boolean);
  return {
    data: {
      items,
      total: Number(result.data?.[0]?.total_count ?? items.length),
    },
    error: null,
    unavailable: false,
  };
}

export function useStudyMaterials(filters = {}, { enabled = true } = {}) {
  const [state, setState] = useState(() => ({ ...EMPTY, loading: Boolean(enabled) }));
  const generation = useRef(0);
  const request = useRef(null);
  const {
    goal = null, board = null, stage = null, subject = null, chapter = null,
    chapterId = null, videoId = null, type = null, limit = STUDY_MATERIAL_PAGE_SIZE,
    offset = 0,
  } = filters;

  const load = useCallback(async ({ append = false, pageOffset = offset } = {}) => {
    const currentGeneration = ++generation.current;
    const current = () => currentGeneration === generation.current;
    request.current?.abort();
    request.current = null;
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, error: "Study material isn't available right now." });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setState((previous) => append
      ? { ...previous, loadingMore: true, loadMoreError: null }
      : {
        ...previous, loading: true, loadingMore: false,
        error: null, loadMoreError: null,
      });
    try {
      const result = await fetchStudyMaterials(supabase, {
        goal, board, stage, subject, chapter, chapterId, videoId, type,
        limit, offset: pageOffset,
      }, { signal: controller.signal });
      if (!current()) return;
      if (result.error) {
        if (!result.unavailable) console.error("study materials:", result.error);
        if (append && !result.unavailable) {
          setState((previous) => ({
            ...previous,
            loadingMore: false,
            loadMoreError: "Couldn't load more study material.",
          }));
          return;
        }
        setState({
          ...EMPTY,
          unavailable: result.unavailable,
          error: result.unavailable ? null : "Couldn't load study material.",
        });
        return;
      }
      setState((previous) => {
        const items = append
          ? [...new Map([...previous.items, ...result.data.items].map((item) => [item.id, item])).values()]
          : result.data.items;
        return {
          ...result.data,
          items,
          loading: false,
          loadingMore: false,
          error: null,
          loadMoreError: null,
          unavailable: false,
        };
      });
    } catch (reason) {
      if (!current() || controller.signal.aborted) return;
      console.error("study materials:", reason);
      if (append) {
        setState((previous) => ({
          ...previous,
          loadingMore: false,
          loadMoreError: "Couldn't reach the next page of study material.",
        }));
        return;
      }
      setState({ ...EMPTY, error: "Couldn't reach the study-material library." });
    }
  }, [board, chapter, chapterId, enabled, goal, limit, offset, stage, subject, type, videoId]);

  useEffect(() => {
    load({ append: false, pageOffset: offset });
    return () => {
      generation.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [load, offset]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || state.items.length >= state.total) return undefined;
    return load({ append: true, pageOffset: offset + state.items.length });
  }, [load, offset, state.items.length, state.loading, state.loadingMore, state.total]);

  const retry = useCallback(
    () => load({ append: false, pageOffset: offset }),
    [load, offset],
  );

  return {
    ...state,
    hasMore: state.items.length < state.total,
    loadMore,
    retry,
  };
}
