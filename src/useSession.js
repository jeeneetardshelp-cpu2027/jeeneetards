// useSession.js — the current Supabase auth session, app-wide.
// Used by the student rating flow (and reusable anywhere else that needs to
// know who, if anyone, is signed in).

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !supabase?.auth?.getSession ||
      !supabase?.auth?.onAuthStateChange
    ) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { session, loading };
}
