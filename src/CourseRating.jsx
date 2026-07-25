// =====================================================================
//  CourseRating.jsx  —  the structured rating panel on the watch page.
//
//  • Shows a numeric average only after the confidence threshold is met.
//  • Signed out: a compact sign-in / create-account form (rating requires
//    an account — one per person, editable later).
//  • Signed in: a structured form — overall + clarity + question quality
//    (1–5 stars each), difficulty, "best for", and an optional review.
//    Loads the student's existing rating so they can edit it.
//
//  RLS enforces "own rating only"; the unique(playlist_id,user_id) makes
//  submitting again an EDIT (upsert), which is the built-in rate-limit —
//  a student can't stack multiple ratings on one course.
// =====================================================================

import { useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useSession } from "./useSession.js";
import { useTheme } from "./theme.jsx";
import { RATING_DIFFICULTY, RATING_BEST_FOR } from "./metadata.js";
import { ratingDisplay } from "./ratingConfidence.js";
import StudentAuth from "./StudentAuth.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { BRAND_TEAL } from "./brandColors.js";

const ACCENT = { teal: BRAND_TEAL, star: "#f59e0b", red: "#dc2626" };

// A 1–5 star input.
function StarInput({ value, onChange, label }) {
  const { t } = useTheme();
  return (
    <div>
      <span className={`block text-xs font-medium ${t.muted}`}>{label}</span>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Star
              className="h-6 w-6"
              style={{ color: ACCENT.star }}
              fill={n <= value ? ACCENT.star : "none"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipRow({ label, options, value, onChange }) {
  const { t } = useTheme();
  return (
    <div>
      <span className={`block text-xs font-medium ${t.muted}`}>{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(on ? "" : o.value)}
              className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                on ? "text-white" : `${t.muted} ${t.hover}`
              }`}
              style={{
                borderColor: ACCENT.teal,
                backgroundColor: on ? ACCENT.teal : "transparent",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CourseRatingInteractive({ playlistId, initialAverage = 0, initialCount = 0 }) {
  const { t } = useTheme();
  const { session, loading: authLoading } = useSession();
  const user = session?.user;
  const [authOpen, setAuthOpen] = useState(false);

  const [avg, setAvg] = useState({ average: initialAverage, count: initialCount });
  const [existing, setExisting] = useState(null);
  const [overall, setOverall] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [question, setQuestion] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const publicRating = ratingDisplay(avg.average, avg.count);

  // Refresh the course average (kept fresh by the DB trigger).
  const refreshAverage = useCallback(async () => {
    const { data } = await supabase
      .from("playlists")
      .select("average_rating, ratings_count")
      .eq("id", playlistId)
      .maybeSingle();
    if (data) setAvg({ average: Number(data.average_rating), count: data.ratings_count });
  }, [playlistId]);

  useEffect(() => {
    refreshAverage();
  }, [refreshAverage]);

  // Load this student's existing rating so they can edit it.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setExisting(null);
      return;
    }
    let active = true;
    supabase
      .from("playlist_ratings")
      .select("*")
      .eq("playlist_id", playlistId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setExisting(data);
        setOverall(data.rating ?? 0);
        setClarity(data.clarity_rating ?? 0);
        setQuestion(data.question_rating ?? 0);
        setDifficulty(data.difficulty ?? "");
        setBestFor(data.best_for ?? "");
        setReview(data.review ?? "");
      });
    return () => {
      active = false;
    };
  }, [userId, playlistId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!overall) {
      setStatus({ ok: false, message: "Give an overall rating first." });
      return;
    }
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.from("playlist_ratings").upsert(
      {
        playlist_id: Number(playlistId),
        user_id: user.id,
        rating: overall,
        clarity_rating: clarity || null,
        question_rating: question || null,
        difficulty: difficulty || null,
        best_for: bestFor || null,
        review: review.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "playlist_id,user_id" }
    );
    setBusy(false);
    if (error) {
      setStatus({ ok: false, message: error.message });
      return;
    }
    setStatus({ ok: true, message: existing ? "Rating updated." : "Thanks for rating!" });
    setExisting(true);
    refreshAverage();
  };

  return (
    <div className={`mt-8 rounded-2xl border ${t.card} ${t.border} p-6`}>
      <div className="flex items-center justify-between">
        <h2 className={`text-base font-semibold ${t.text}`}>Rate this course</h2>
        <span className={`text-sm ${t.muted}`}>
          {publicRating?.kind === "scored" ? (
            <>
              <Star
                className="mr-1 inline h-4 w-4"
                style={{ color: ACCENT.star }}
                fill={ACCENT.star}
              />
              {publicRating.score.toFixed(1)} · {publicRating.count} ratings
            </>
          ) : publicRating?.kind === "low" ? (
            publicRating.text
          ) : (
            "Not yet rated"
          )}
        </span>
      </div>

      {authLoading ? null : !user ? (
        <div className="mt-3">
          <p className={`text-sm ${t.muted}`}>Sign in to rate this course.</p>
          {!authOpen ? (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="mt-3 min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-teal-500"
              style={{ backgroundColor: ACCENT.teal }}
            >
              Sign in to rate
            </button>
          ) : (
            <div>
              <StudentAuth enabled />
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className={`mt-2 min-h-11 rounded-lg px-2 text-xs ${t.faint} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <StarInput label="Overall helpfulness" value={overall} onChange={setOverall} />
          <div className="grid gap-5 sm:grid-cols-2">
            <StarInput label="Explanation clarity" value={clarity} onChange={setClarity} />
            <StarInput label="Question quality" value={question} onChange={setQuestion} />
          </div>
          <ChipRow
            label="Difficulty"
            options={RATING_DIFFICULTY}
            value={difficulty}
            onChange={setDifficulty}
          />
          <ChipRow
            label="Best for"
            options={RATING_BEST_FOR}
            value={bestFor}
            onChange={setBestFor}
          />
          <label className="block">
            <span className={`block text-xs font-medium ${t.muted}`}>Review (optional)</span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              placeholder="What worked, what didn't…"
              className={`mt-1 w-full resize-none rounded-lg border ${t.border} ${t.input} ${t.text} p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: ACCENT.teal }}
            >
              {busy ? "Saving…" : existing ? "Update rating" : "Submit rating"}
            </button>
            {status && (
              <span
                className="text-sm"
                style={{ color: status.ok ? ACCENT.teal : ACCENT.red }}
              >
                {status.message}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export function CourseRatingSummary({ initialAverage = 0, initialCount = 0 }) {
  const { t } = useTheme();
  const publicRating = ratingDisplay(initialAverage, initialCount);
  return (
    <section
      className={`mt-8 rounded-2xl border ${t.card} ${t.border} p-6`}
      aria-labelledby="student-ratings-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="student-ratings-title" className={`text-base font-semibold ${t.text}`}>
          Student ratings
        </h2>
        <span className={`text-sm ${t.muted}`}>
          {publicRating?.kind === "scored" ? (
            <>
              <Star
                className="mr-1 inline h-4 w-4"
                style={{ color: ACCENT.star }}
                fill={ACCENT.star}
              />
              {publicRating.score.toFixed(1)} · {publicRating.count} ratings
            </>
          ) : publicRating?.kind === "low" ? publicRating.text : "Not yet rated"}
        </span>
      </div>
    </section>
  );
}

export default function CourseRating({
  playlistId,
  initialAverage = 0,
  initialCount = 0,
  released = RELEASE_FEATURES.courseRatingSubmission,
}) {
  if (!released) {
    return (
      <CourseRatingSummary
        initialAverage={initialAverage}
        initialCount={initialCount}
      />
    );
  }
  return (
    <CourseRatingInteractive
      playlistId={playlistId}
      initialAverage={initialAverage}
      initialCount={initialCount}
    />
  );
}
