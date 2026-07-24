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

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const EMPTY = { options: {}, loading: false, error: null };

export function useFilterOptions({ subjectId } = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, error: "Filters aren’t available right now." });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    // Explicit column lists — never select("*"). Ordered in the database so
    // the panel does no sorting of its own.
    const queries = [
      supabase.from("learning_goals").select("id, slug, name").order("display_order"),
      supabase.from("class_levels").select("id, slug, name").order("display_order"),
      supabase.from("subjects").select("id, slug, name").order("display_order"),
      supabase.from("institutes_channels").select("id, name").order("name"),
    ];

    // Chapters ONLY for the chosen subject. Without a subject there is no
    // chapter list at all — showing every chapter in the library would be both
    // unusable and unbounded.
    if (subjectId)
      queries.push(
        supabase.from("chapters").select("id, slug, name, subject_id")
          .eq("subject_id", subjectId).order("display_order")
      );

    Promise.all(queries).then((res) => {
      if (!active) return;
      const failed = res.find((r) => r.error);
      if (failed) {
        console.error("filter options:", failed.error);
        // A failed lookup is NOT "no options". Reporting it as an empty panel
        // would tell a student their subject has no chapters when the truth is
        // that we could not find out.
        setState({ ...EMPTY, error: "Filters couldn’t be loaded." });
        return;
      }
      const [goals, classes, subjects, institutes, chapters] = res;
      setState({
        loading: false, error: null,
        options: {
          // Keep ids as metadata while slugs remain the emitted URL values.
          // Dashboard can label an old ?sub=3 bookmark from these bounded
          // dimension rows without rebuilding a tree from every video.
          goal: goals.data.map((r) => ({ id: r.id, value: r.slug, label: r.name })),
          class: classes.data.map((r) => ({ id: r.id, value: shortClass(r.slug), label: r.name })),
          subject: subjects.data.map((r) => ({ id: r.id, value: r.slug, label: r.name })),
          channel: institutes.data.map((r) => ({ id: r.id, value: String(r.id), label: r.name })),
          chapter: (chapters?.data ?? []).map((r) => ({ id: r.id, value: r.slug, label: r.name })),
        },
      });
    });

    return () => { active = false; };
  }, [subjectId, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}

// class_levels.slug is "class-11"; the canonical URL uses the short "11".
const shortClass = (slug) => (slug === "dropper" ? "dropper" : slug.replace(/^class-/, ""));
