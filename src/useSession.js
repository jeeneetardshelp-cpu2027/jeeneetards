// useSession.js — the current Supabase auth session, app-wide.
// Used by the student rating flow (and reusable anywhere else that needs to
// know who, if anyone, is signed in).

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// Why a sign-in carried in the URL (#access_token=..., from Google sign-in, an
// email confirmation or a password-reset link) did not take. getSession()
// cannot say: a link auth-js could not verify saves nothing, so the page looks
// exactly like a visitor who never clicked one — or like whoever was already
// signed in on this device. auth.initialize() hands back the error.
//   "unreachable"  AuthRetryableFetchError: the check got no usable answer (the
//                  USER_LOOKUP_DEADLINE_MS deadline, a dropped connection, a
//                  5xx). auth-js leaves the link in the URL, so a reload checks
//                  the same link again.
//   "rejected"     any other error: the link was refused or unusable, so the
//                  remedy is a new link or a fresh sign-in, not the same link.
// It only means something on a page whose URL carried a link; callers check.
function urlSignInFailureOf(error) {
  if (!error) return null;
  return error.name === "AuthRetryableFetchError" ? "unreachable" : "rejected";
}

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [urlSignInFailure, setUrlSignInFailure] = useState(null);

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

    const settle = (result, failure = null) => {
      if (!active) return;
      setSession(result?.data?.session ?? null);
      setUrlSignInFailure(failure);
      setLoading(false);
    };

    // Read together, so `loading` never clears a render before the failure is
    // known: /reset would otherwise flash its new-password form for a link that
    // had already failed. Both wait on the same initialisation, so this costs
    // no time. A client without initialize() (test doubles) reads as before.
    if (typeof supabase.auth.initialize === "function") {
      Promise.all([supabase.auth.getSession(), supabase.auth.initialize()]).then(
        ([result, initialized]) => settle(result, urlSignInFailureOf(initialized?.error)),
      );
    } else {
      supabase.auth.getSession().then((result) => settle(result));
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { session, loading, urlSignInFailure };
}
