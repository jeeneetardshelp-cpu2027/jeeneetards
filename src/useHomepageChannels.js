// The complete, bounded channel catalogue for the homepage.
//
// This intentionally does not derive channels from a page of course results:
// the first course page is ordered for curriculum discovery, so it can never
// prove which channels exist elsewhere in the library. The dimension table is
// small, and relation counts let us hide rows that have no uploaded content.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

const EMPTY = { channels: [], loading: false, error: null };

const relationCount = (value) => Number(value?.[0]?.count ?? 0);

export function mapHomepageChannels(rows) {
  return (rows ?? [])
    .map((row) => {
      const id = Number(row?.id);
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      const playlistCount = relationCount(row?.playlists);
      const videoCount = relationCount(row?.videos);
      if (!Number.isInteger(id) || id <= 0 || !name || (playlistCount <= 0 && videoCount <= 0)) {
        return null;
      }
      return {
        id,
        name,
        logoUrl: row.logo_url ?? null,
        playlistCount,
        videoCount,
        to: playlistCount > 0
          ? `/browse?channel=${id}`
          : `/browse?channel=${id}&tab=lectures`,
      };
    })
    .filter(Boolean);
}

export function useHomepageChannels() {
  const [state, setState] = useState({ ...EMPTY, loading: true });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    const current = () => currentGeneration === generation.current;
    if (!isSupabaseConfigured) {
      if (current()) setState({ ...EMPTY, error: "Channels aren’t available right now." });
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from("institutes_channels")
        .select("id, name, logo_url, playlists(count), videos(count)")
        .order("name");
      if (error) {
        console.error("homepage channels:", error);
        if (current()) setState({ ...EMPTY, error: "Channels couldn’t be loaded." });
        return;
      }
      if (current()) {
        setState({ channels: mapHomepageChannels(data), loading: false, error: null });
      }
    } catch (reason) {
      console.error("homepage channels:", reason);
      if (current()) setState({ ...EMPTY, error: "Channels couldn’t be reached." });
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  return { ...state, retry: load };
}
