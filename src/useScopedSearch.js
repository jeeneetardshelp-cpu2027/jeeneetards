// useScopedSearch.js — search limited to the student's current Explore
// context (learning goal, and optionally subject/chapter), so a query for
// "rotation" inside JEE › Class 11 › Physics doesn't surface NEET or CBSE
// results. The caller offers a separate "search the entire library" action.
//
// Returns chapters + lectures scoped to the context. (Playlist scoping is
// indirect — playlists reach chapters only through their videos — so it's
// left to the global search for now.)

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const EMPTY = { chapters: [], lectures: [] };
const PER_GROUP = 8;

export function useScopedSearch(query, { goalId, subjectId, chapterId }) {
  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = (query ?? "").trim();
    if (!term || !isSupabaseConfigured || !goalId) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const tokens = term.split(/\s+/);

    // Chapters — scoped by subject when one is chosen.
    // Chapters have no direct learning-goal junction. Without a selected
    // subject, querying this table would surface chapters from another exam
    // while claiming the search is goal-scoped. Stay honest until the
    // goal-specific subject is known.
    let chapterQ = Promise.resolve({ data: [], error: null });
    if (subjectId) {
      chapterQ = supabase
        .from("chapters")
        .select("id, name, slug, subject_id, subjects(name, slug)")
        .eq("subject_id", subjectId)
        .limit(PER_GROUP);
      for (const tok of tokens) chapterQ = chapterQ.ilike("name", `%${tok}%`);
    }

    // Lectures — scoped by goal (junction) + subject + chapter as available.
    let lectureQ = supabase
      .from("videos")
      .select(
        "id, title, category_id, subject_id, chapter_id," +
          " video_learning_goals!inner(learning_goal_id)"
      )
      .eq("video_learning_goals.learning_goal_id", goalId)
      .limit(PER_GROUP);
    if (subjectId) lectureQ = lectureQ.eq("subject_id", subjectId);
    if (chapterId) lectureQ = lectureQ.eq("chapter_id", chapterId);
    for (const tok of tokens) lectureQ = lectureQ.ilike("title", `%${tok}%`);

    Promise.all([chapterQ, lectureQ])
      .then(([chapters, lectures]) => {
        if (!active) return;
        if (chapters.error || lectures.error) {
          console.error("scoped search:", chapters.error || lectures.error);
          setResults(EMPTY);
          setLoading(false);
          return;
        }
        setResults({
          chapters: (chapters.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            subject: c.subjects?.name ?? "",
            subjectSlug: c.subjects?.slug ?? null,
          })),
          lectures: (lectures.data ?? []).map((v) => ({
            id: v.id,
            title: v.title,
            categoryId: v.category_id,
            subjectId: v.subject_id,
            chapterId: v.chapter_id,
          })),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("scoped search:", err);
        setResults(EMPTY);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, goalId, subjectId, chapterId]);

  const total = results.chapters.length + results.lectures.length;
  return { results, loading, total };
}
