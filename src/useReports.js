// useReports.js — pending content reports for the admin moderation view.
// Admin-only by RLS; resolves each report's target title for context.

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("content_reports")
      .select("id, target_type, target_id, reason, note, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setReports([]);
      setLoading(false);
      return;
    }

    // Resolve target titles so the admin sees WHAT was reported, not "video #12".
    const videoIds = data.filter((r) => r.target_type === "video").map((r) => r.target_id);
    const playlistIds = data.filter((r) => r.target_type === "playlist").map((r) => r.target_id);

    const [videos, playlists] = await Promise.all([
      videoIds.length
        ? supabase.from("videos").select("id, title").in("id", videoIds)
        : { data: [] },
      playlistIds.length
        ? supabase.from("playlists").select("id, title").in("id", playlistIds)
        : { data: [] },
    ]);
    const titleFor = (type, id) =>
      (type === "video" ? videos.data : playlists.data)?.find((x) => x.id === id)?.title ??
      `${type} #${id}`;

    setReports(data.map((r) => ({ ...r, title: titleFor(r.target_type, r.target_id) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Mark a report reviewed or dismissed.
  const setStatus = async (id, status) => {
    const { error } = await supabase
      .from("content_reports")
      .update({ status })
      .eq("id", id);
    if (!error) setReports((prev) => prev.filter((r) => r.id !== id));
    return error;
  };

  return { reports, loading, error, reload, setStatus };
}
