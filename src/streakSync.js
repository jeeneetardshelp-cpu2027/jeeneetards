// streakSync.js — best-effort sync of study days (the streak) to Supabase for
// signed-in students. localStorage (streak.js, ll_streak_v1) stays the
// primary, synchronous read path; this pushes each study day up in the
// background and pulls the whole set back down once on sign-in, so the streak
// survives the deliberate sign-out wipe (AppShell clears ll_streak_v1 for
// shared school machines) and follows a student across devices.
//
// STAGED SERVER SIDE. The study_days table ships as
// supabase/migrations/20260901120000_study_days.sql and is NOT applied until
// the owner runs the migration gate. Until then PostgREST answers every
// study_days request with "relation does not exist" — this module treats
// that as "the feature is off", remembers the answer for the rest of the
// page's life, and goes quiet, so the site behaves exactly as it did before
// the sync existed.
//
// Same rules as progressSync.js: never block or throw into the UI path, and
// never pretend a failed push succeeded — a failed day is simply not marked
// as pushed, so the next recordStudyDay retries it.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const TABLE = "study_days";

const isDayKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

// Set after the server says the relation does not exist. One honest "not
// there" silences every later request this page load — retrying a missing
// table 25 times a session is noise, not resilience.
let tableMissing = false;

// PostgREST reports a missing relation as PGRST205 ("could not find the
// table ... in the schema cache"); raw Postgres calls it 42P01
// (undefined_table). Match the codes first, the message shapes as fallback.
function isMissingTableError(error) {
  const code = String(error?.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return /could not find the table|relation .* does not exist|schema cache/i
    .test(String(error?.message ?? ""));
}

// `${userId}:${day}` after a SUCCESSFUL upsert only — recordStudyDay fires on
// every genuine PLAYING event, so without this the same day would be pushed
// dozens of times a session; without the success requirement, one offline
// failure would silence the day for the whole session.
const pushedDays = new Set();

/**
 * Best-effort upsert of one (user_id, day) row, fire-and-forget. Safe to call
 * from the recordStudyDay hot path: it returns immediately, resolves the
 * session itself, and swallows every failure (localStorage already has the
 * day — the server copy is a bonus, not a dependency). Returns a promise that
 * never rejects, purely so tests can await it.
 */
export function queueStudyDaySync(day) {
  if (!isSupabaseConfigured || tableMissing || !isDayKey(day)) {
    return Promise.resolve();
  }
  return Promise.resolve()
    .then(async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId || pushedDays.has(`${userId}:${day}`)) return;
      const { error } = await supabase.from(TABLE).upsert(
        { user_id: userId, day },
        { onConflict: "user_id,day", ignoreDuplicates: true },
      );
      if (!error) {
        pushedDays.add(`${userId}:${day}`);
        return;
      }
      if (isMissingTableError(error)) tableMissing = true;
      // Any other failure: NOT marked as pushed, so the next study-day
      // record retries — same honesty progressSync applies to positions.
    })
    .catch(() => {
      /* signed out, offline, or a broken client — the day is safe locally */
    });
}

/**
 * The user's full set of study days, as YYYY-MM-DD strings, for the sign-in
 * union into ll_streak_v1 (streak.js mergeStudyDays — which only ever ADDS
 * days). Paginated like pullServerProgress: PostgREST caps a response at 1000
 * rows and says nothing about it, and a truncated set would silently shorten
 * a long-standing student's history. Returns [] on any failure — partial data
 * still beats none, and none still beats a thrown error in the header.
 */
export async function pullServerStudyDays(userId) {
  if (!isSupabaseConfigured || tableMissing || !userId) return [];
  const PAGE = 1000;
  const days = [];
  for (let from = 0; ; from += PAGE) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("day")
        .eq("user_id", userId)
        .order("day", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        if (isMissingTableError(error)) tableMissing = true;
        break; // partial data still beats none
      }
      if (!data) break;
      for (const row of data) {
        if (isDayKey(row?.day)) days.push(row.day);
      }
      if (data.length < PAGE) break;
    } catch {
      break; // network or client-shape failure — behave as "nothing known"
    }
  }
  return days;
}
