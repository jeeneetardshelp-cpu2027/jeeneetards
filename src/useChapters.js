// useChapters.js
// Looks up the REAL chapter ids from Supabase and returns them keyed by
// chapter name, e.g. { Kinematics: 1 }.
//
// The sidebar in Dashboard.jsx is built from names, not ids. This map is
// what lets a click on "Kinematics" navigate to /chapter/1 without
// hardcoding the number — add a chapter in Supabase and it just works.

import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useChapters() {
  const [chapterIds, setChapterIds] = useState({});   // name -> id
  const [chapterNames, setChapterNames] = useState({}); // id -> name
  // false until the lookup has come back, so callers can avoid flashing a
  // placeholder heading before the real chapter name is known.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }

    supabase
      .from("chapters")
      .select("id, name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setReady(true);
          return;
        }
        const byName = {};
        const byId = {};
        for (const row of data || []) {
          byName[row.name] = row.id;
          byId[row.id] = row.name;
        }
        setChapterIds(byName);
        setChapterNames(byId);
        setReady(true);
      })
      // A failure here just means no chapter navigates — the sidebar still
      // filters locally, so there's nothing to show the student.
      .catch(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return { chapterIds, chapterNames, ready };
}
