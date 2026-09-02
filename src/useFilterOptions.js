// useFilterOptions.js — the option lists for the filter panel.
//
// These come from DIMENSION tables (learning_goals, class_levels, subjects,
// chapters, institutes_channels), not from the catalogue. That distinction is
// the whole point: dimension tables are small and bounded by curriculum, while
// playlists/videos grow without limit. Loading four small lookup tables is not
// "fetching the catalogue".
//
// Chapters are the exception that proves it — they grow with every subject, so
// they are ALWAYS scoped to the selected subject and never loaded whole.
//
// No counts are computed here. Contextual counts come from the verified v9
// browse_facet_counts RPC through useBrowseFacets; keeping lookup rows and
// result counts separate prevents an unbounded catalogue download.
//
// THE SUBJECT SPLIT. Only the chapter query depends on the subject, but all
// five used to share one effect keyed on [subjectId, nonce]. BrowsePage feeds
// it canonical.subjectId, which is null until useCanonicalFilters has resolved
// the URL's subject SLUG to an id — a round trip of its own. So every cold
// /browse load fetched learning_goals, class_levels, subjects and
// institutes_channels twice: once against null, then again when the id
// arrived. Four duplicate queries, four extra CORS preflights, and a second
// dependent wave before the first course card. They are two effects now: the
// subject-independent tables load once, chapters load per subject.

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const NOT_CONFIGURED = "Filters aren’t available right now.";
const LOAD_FAILED = "Filters couldn’t be loaded.";

export function useFilterOptions({ subjectId } = {}) {
  const [nonce, setNonce] = useState(0);
  const [dimensions, setDimensions] = useState({ data: null, error: null, loading: true });
  const [chapters, setChapters] = useState({ data: [], error: null, loading: false });

  // The four subject-independent lookups. Re-runs only on retry.
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setDimensions({ data: null, error: NOT_CONFIGURED, loading: false });
      return;
    }
    setDimensions((s) => ({ ...s, error: null, loading: true }));

    // Explicit column lists — never select("*"). Ordered in the database so
    // the panel does no sorting of its own.
    Promise.all([
      supabase.from("learning_goals").select("id, slug, name").order("display_order"),
      supabase.from("class_levels").select("id, slug, name").order("display_order"),
      supabase.from("subjects").select("id, slug, name").order("display_order"),
      supabase.from("institutes_channels").select("id, name, logo_url").order("name"),
    ]).then(([goals, classes, subjects, institutes]) => {
      if (!active) return;
      const failed = [goals, classes, subjects, institutes].find((r) => r.error);
      if (failed) {
        console.error("filter options:", failed.error);
        // A failed lookup is NOT "no options". Reporting it as an empty panel
        // would tell a student their subject has no chapters when the truth is
        // that we could not find out.
        setDimensions({ data: null, error: LOAD_FAILED, loading: false });
        return;
      }
      setDimensions({
        loading: false,
        error: null,
        data: {
          // Keep ids as metadata while slugs remain the emitted URL values.
          // BrowsePage can label an old ?sub=3 bookmark from these bounded
          // dimension rows without rebuilding a tree from every video.
          goal: goals.data.map((r) => ({ id: r.id, value: r.slug, label: r.name })),
          class: classes.data.map((r) => ({ id: r.id, value: shortClass(r.slug), label: r.name })),
          subject: subjects.data.map((r) => ({ id: r.id, value: r.slug, label: r.name })),
          channel: institutes.data.map((r) => ({
            id: r.id, value: String(r.id), label: r.name, logoUrl: r.logo_url ?? null,
          })),
        },
      });
    });

    return () => { active = false; };
  }, [nonce]);

  // Chapters ONLY for the chosen subject. Without a subject there is no
  // chapter list at all — showing every chapter in the library would be both
  // unusable and unbounded.
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !subjectId) {
      setChapters({ data: [], error: null, loading: false });
      return;
    }
    setChapters((s) => ({ ...s, error: null, loading: true }));

    supabase.from("chapters").select("id, slug, name, subject_id")
      .eq("subject_id", subjectId).order("display_order")
      .then((result) => {
        if (!active) return;
        if (result.error) {
          console.error("filter options:", result.error);
          setChapters({ data: [], error: LOAD_FAILED, loading: false });
          return;
        }
        setChapters({
          data: (result.data ?? []).map((r) => ({ id: r.id, value: r.slug, label: r.name })),
          error: null,
          loading: false,
        });
      });

    return () => { active = false; };
  }, [subjectId, nonce]);

  // An error in either half is an error for the panel, which renders one
  // message and a retry rather than a half-populated set of controls.
  const error = dimensions.error ?? chapters.error;
  const options = useMemo(
    () => (error || !dimensions.data ? {} : { ...dimensions.data, chapter: chapters.data }),
    [error, dimensions.data, chapters.data],
  );

  return {
    options,
    loading: dimensions.loading || chapters.loading,
    error,
    retry: () => setNonce((n) => n + 1),
  };
}

// class_levels.slug is "class-11"; the canonical URL uses the short "11".
const shortClass = (slug) => (slug === "dropper" ? "dropper" : slug.replace(/^class-/, ""));
