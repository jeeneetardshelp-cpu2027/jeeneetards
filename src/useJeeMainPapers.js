import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { mapStudyMaterial } from "./useStudyMaterials.js";
import {
  JEE_MAIN_PAPERS_PATH,
  JEE_MAIN_PAPERS_TITLE_PATTERN,
  findPaperLanding,
} from "./studyMaterialLandings.js";

// FLIPPED 2026-09-02 — the paper-metadata migration
// supabase/migrations/20260902093000_study_material_paper_metadata.sql was
// verified APPLIED to production the same day, so this SELECT reads the four
// real columns (paper_kind, paper_year, exam_session, exam_shift — populated
// for every previous_year_paper row) and the pages classify from them through
// paperMetadata() in studyMaterialLandings.js. The title grammar
// (parsePaperTitle) is now the FALLBACK for rows that lack the columns — an
// old cached edge response — not the authority.
const SELECT = [
  "id", "title", "description", "material_type", "source_name", "source_url",
  "preview_image_url", "file_format", "language", "exam_year", "page_count",
  "is_downloadable", "rights_status",
  "paper_kind", "paper_year", "exam_session", "exam_shift",
].join(",");

const EMPTY = {
  items: [], total: 0, loading: false, loadingMore: false,
  error: null, loadMoreError: null, unavailable: false,
};

// The registry entry this hook serves when the caller names none. Kept as a
// lookup rather than a literal so the default can never drift from the
// registered landing.
const DEFAULT_LANDING = findPaperLanding(JEE_MAIN_PAPERS_PATH);

export async function fetchJeeMainPapers(
  client,
  // `year` narrows the same query to one exam year for the per-year child
  // page. Null means the whole collection, which is what the landing shows.
  // `titlePattern` and `scopeGoal` come from the paper-landing registry so a
  // sibling exam (JEE Advanced, NEET) reuses this fetcher instead of growing
  // a near-identical copy.
  {
    limit = 100,
    offset = 0,
    year = null,
    titlePattern = JEE_MAIN_PAPERS_TITLE_PATTERN,
    scopeGoal = "jee-main",
  } = {},
  { signal } = {},
) {
  const start = Math.max(Number(offset), 0);
  const size = Math.min(Math.max(Number(limit), 1), 100);
  let query = client
    .from("study_materials")
    .select(SELECT, { count: "exact" })
    .eq("material_type", "previous_year_paper")
    .ilike("title", titlePattern);
  // Number(null) is 0, so the null check has to come first — otherwise the
  // landing would silently ask for exam_year = 0 and list nothing.
  if (year != null && Number.isInteger(Number(year))) {
    query = query.eq("exam_year", Number(year));
  }
  query = query
    .order("exam_year", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true })
    .range(start, start + size - 1);
  if (signal && typeof query.abortSignal === "function") query = query.abortSignal(signal);
  const result = await query;
  if (result.error) return { data: null, error: result.error };
  const items = (result.data ?? [])
    .map((row) => {
      const mapped = mapStudyMaterial({ ...row, scopes: [{ goal: scopeGoal }] });
      // The paper-metadata columns ride alongside the shared RPC shape so the
      // classifiers in studyMaterialLandings.js can trust the database: a
      // non-null paperKind marks a backfilled row, and its null examSession
      // genuinely means "no session".
      return mapped && {
        ...mapped,
        paperKind: row.paper_kind ?? null,
        paperYear: row.paper_year == null ? null : Number(row.paper_year),
        examSession: row.exam_session ?? null,
        examShift: row.exam_shift ?? null,
      };
    })
    .filter(Boolean);
  return {
    data: { items, total: Number(result.count ?? items.length) },
    error: null,
  };
}

/**
 * One paper landing's collection, optionally narrowed to ONE exam year for
 * the per-year child page. `landing` is a PAPER_LANDINGS entry and defaults
 * to JEE Main (the hook's original single job — the name stays for its
 * callers and tests). `year` is part of the load callback's identity, so
 * navigating between year pages re-queries instead of showing the last
 * year's papers under the new heading.
 */
export function useJeeMainPapers({ year = null, landing = null } = {}) {
  const resolved = landing ?? DEFAULT_LANDING;
  const { titlePattern, scopeGoal, examLabel } = resolved;
  const [state, setState] = useState(() => ({ ...EMPTY, loading: true }));
  const generation = useRef(0);
  const request = useRef(null);

  const load = useCallback(async ({ append = false, offset = 0 } = {}) => {
    const currentGeneration = ++generation.current;
    const current = () => currentGeneration === generation.current;
    request.current?.abort();
    request.current = null;
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, error: `${examLabel} papers aren't available right now.` });
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setState((previous) => append
      ? { ...previous, loadingMore: true, loadMoreError: null }
      : { ...previous, loading: true, error: null });
    try {
      const result = await fetchJeeMainPapers(
        supabase,
        { limit: 100, offset, year, titlePattern, scopeGoal },
        { signal: controller.signal },
      );
      if (!current()) return;
      if (result.error) {
        console.error(`${examLabel} papers:`, result.error);
        setState((previous) => append
          ? { ...previous, loadingMore: false, loadMoreError: `Couldn't load more ${examLabel} papers.` }
          : { ...EMPTY, error: `Couldn't load the ${examLabel} paper library.` });
        return;
      }
      setState((previous) => ({
        ...result.data,
        items: append
          ? [...new Map([...previous.items, ...result.data.items].map((item) => [item.id, item])).values()]
          : result.data.items,
        loading: false,
        loadingMore: false,
        error: null,
        loadMoreError: null,
        unavailable: false,
      }));
    } catch (reason) {
      if (!current() || controller.signal.aborted) return;
      console.error(`${examLabel} papers:`, reason);
      setState((previous) => append
        ? { ...previous, loadingMore: false, loadMoreError: `Couldn't reach the next page of ${examLabel} papers.` }
        : { ...EMPTY, error: `Couldn't reach the ${examLabel} paper library.` });
    }
  }, [year, titlePattern, scopeGoal, examLabel]);

  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [load]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || state.items.length >= state.total) return undefined;
    return load({ append: true, offset: state.items.length });
  }, [load, state.items.length, state.loading, state.loadingMore, state.total]);

  const retry = useCallback(() => load(), [load]);

  return {
    ...state,
    hasMore: state.items.length < state.total,
    loadMore,
    retry,
  };
}
