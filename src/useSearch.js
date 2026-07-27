// useSearch.js — grouped search across the catalogue for the homepage.
//
// Returns results split into the four things a student might be looking for:
//   chapters · playlists · lectures · teachers/channels
//
// Search is database-backed (ilike), token-AND on the main text field so
// "river problem" matches a title containing both words. True natural-language
// parsing (pulling "class 11" / "Hindi" / "one shot" out of the phrase) is a
// later slice — this is solid substring/keyword search.

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const EMPTY = { chapters: [], playlists: [], lectures: [], teachers: [] };
const PER_GROUP = 6;

export function useSearch(query) {
  const [results, setResults] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const term = (query ?? "").trim();
    if (!term || !isSupabaseConfigured) {
      setResults(EMPTY);
      setLoading(false);
      setError(!term || isSupabaseConfigured ? null : "Search isn't available right now.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    const tokens = term.split(/\s+/);
    const phrase = tokens.join(" ");

    // chapters + lectures: token-AND on the name/title.
    // videos!inner: only surface a chapter that actually has lessons mapped to
    // it. Parked/empty chapters (e.g. reference chapters created ahead of a
    // content import) would otherwise appear as suggestions and dead-end on
    // "No courses match this view".
    let chapterQ = supabase
      .from("chapters")
      .select("id, name, subject_id, subjects(name), videos!inner(id)")
      .limit(PER_GROUP);
    let lectureQ = supabase
      .from("videos")
      .select("id, title, category_id, subject_id, chapter_id")
      .limit(PER_GROUP);
    for (const tok of tokens) {
      chapterQ = chapterQ.ilike("name", `%${tok}%`);
      lectureQ = lectureQ.ilike("title", `%${tok}%`);
    }

    // playlists: match title OR teacher (PostgREST .or uses * as wildcard).
    const playlistQ = supabase
      .from("playlists")
      .select("id, title, teacher, class_levels, institutes_channels(name)")
      .or(`title.ilike.*${phrase}*,teacher.ilike.*${phrase}*`)
      .limit(PER_GROUP);

    const teacherQ = supabase
      .from("institutes_channels")
      .select("id, name")
      .ilike("name", `%${phrase}%`)
      .limit(PER_GROUP);

    Promise.all([chapterQ, lectureQ, playlistQ, teacherQ])
      .then(async ([chapters, lectures, playlists, teachers]) => {
        if (!active) return;

        const failed = [chapters, lectures, playlists, teachers].find((result) => result.error);
        if (failed) throw failed.error;

        // For each playlist, find a chapter it teaches so the result can
        // link straight to a watchable course page.
        let playlistRows = playlists.data ?? [];
        if (playlistRows.length) {
          const ids = playlistRows.map((p) => p.id);
          const { data: links, error: linksError } = await supabase
            .from("playlist_videos")
            .select("playlist_id, videos(chapter_id)")
            .in("playlist_id", ids)
            .order("position", { ascending: true });
          if (linksError) throw linksError;
          const firstChapter = new Map();
          for (const l of links ?? []) {
            const ch = l.videos?.chapter_id;
            if (ch && !firstChapter.has(l.playlist_id))
              firstChapter.set(l.playlist_id, ch);
          }
          playlistRows = playlistRows.map((p) => ({
            ...p,
            chapterId: firstChapter.get(p.id) ?? null,
          }));
        }

        if (!active) return;
        setResults({
          chapters: (chapters.data ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            subject: c.subjects?.name ?? "",
          })),
          lectures: (lectures.data ?? []).map((v) => ({
            id: v.id,
            title: v.title,
            categoryId: v.category_id,
            subjectId: v.subject_id,
            chapterId: v.chapter_id,
          })),
          playlists: playlistRows.map((p) => ({
            id: p.id,
            title: p.title,
            teacher: p.teacher,
            institute: p.institutes_channels?.name ?? "",
            classLevels: p.class_levels ?? [],
            chapterId: p.chapterId ?? null,
          })),
          teachers: (teachers.data ?? []).map((t) => ({
            id: t.id,
            name: t.name,
          })),
        });
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error("search:", err);
        setResults(EMPTY);
        setLoading(false);
        setError("Search is unavailable. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [query, nonce]);

  const total =
    results.chapters.length +
    results.playlists.length +
    results.lectures.length +
    results.teachers.length;

  return {
    results, loading, total, error,
    retry: () => setNonce((value) => value + 1),
  };
}
