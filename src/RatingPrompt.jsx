// RatingPrompt — a one-tap "Was this course helpful?" ask, shown at the moment
// a student finishes a lesson.
//
// The full CourseRating panel sits at the very bottom of the watch page, so the
// only place to rate was below everything, asked of nobody in particular — and
// production has zero ratings on 454 courses. This surfaces the ask at peak
// intent (a lesson just ended) as a single star tap, reusing the exact same
// upsert. It never nags: it self-hides for a student who has already rated, and
// a dismiss is remembered by the parent for the rest of the visit.
//
// It does NOT lower the sign-up wall — that (one-tap / Google OAuth, dropping
// the email-confirm step) is a Supabase dashboard change only the owner can
// make, and is the other half of the cold-start fix.

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Star, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useSession } from "./useSession.js";
import { useTheme } from "./theme.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { ratingErrorMessage } from "./CourseRating.jsx";
import { BRAND_TEAL } from "./brandColors.js";

const STAR = "#f59e0b";
const RED = "#dc2626";

export default function RatingPrompt({ playlistId, onDismiss = null }) {
  const { t } = useTheme();
  const { session, loading } = useSession();
  const user = session?.user;
  const location = useLocation();
  const pid = Number(playlistId);

  const [checked, setChecked] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, message }

  // Signed in: don't nag someone who has already rated this course. One cheap
  // read of their own row (RLS scopes it to them) decides it.
  useEffect(() => {
    if (loading) return;
    if (!user) { setChecked(true); return; }
    let active = true;
    supabase
      .from("playlist_ratings")
      .select("rating")
      .eq("playlist_id", pid)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setAlreadyRated(Boolean(data));
        setChecked(true);
      });
    return () => { active = false; };
  }, [loading, user, pid]);

  // A saved rating shows a brief thanks, then the prompt bows out.
  useEffect(() => {
    if (!status?.ok || !onDismiss) return undefined;
    const id = setTimeout(() => onDismiss(), 1800);
    return () => clearTimeout(id);
  }, [status, onDismiss]);

  if (!RELEASE_FEATURES.courseRatingSubmission) return null;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (loading || !checked) return null;
  if (user && alreadyRated && !status) return null;

  const rate = async (n) => {
    setChosen(n);
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.from("playlist_ratings").upsert(
      { playlist_id: pid, user_id: user.id, rating: n, updated_at: new Date().toISOString() },
      { onConflict: "playlist_id,user_id" },
    );
    setBusy(false);
    if (error) {
      setStatus({ ok: false, message: ratingErrorMessage(error) });
      return;
    }
    setStatus({ ok: true, message: "Thanks — that helps other students choose." });
  };

  const next = encodeURIComponent(location.pathname + location.search);

  return (
    <section
      aria-labelledby="rating-prompt-heading"
      className={`mt-6 rounded-xl border ${t.border} ${t.card} p-4 sm:p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="rating-prompt-heading" className={`text-sm font-semibold ${t.text}`}>
            Was this course helpful?
          </h2>
          <p className={`mt-1 text-xs ${t.muted}`}>
            {user
              ? "One tap — you can change it anytime."
              : "Your rating helps other students pick the right teacher."}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className={`-mr-1 -mt-1 inline-flex min-h-8 items-center rounded-md p-1 ${t.faint} hover:${t.text}`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      {status?.ok ? (
        <p className="mt-3 text-sm font-medium" style={{ color: BRAND_TEAL }}>{status.message}</p>
      ) : user ? (
        <>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                onClick={() => rate(n)}
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
              >
                <Star className="h-7 w-7" style={{ color: STAR }} fill={n <= chosen ? STAR : "none"} />
              </button>
            ))}
          </div>
          {status && !status.ok && (
            <p className="mt-2 text-sm" style={{ color: RED }}>{status.message}</p>
          )}
        </>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            to={`/signin?next=${next}`}
            className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: BRAND_TEAL }}
          >
            Sign in to rate
          </Link>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={`text-xs ${t.faint} hover:underline`}>
              Not now
            </button>
          )}
        </div>
      )}
    </section>
  );
}
