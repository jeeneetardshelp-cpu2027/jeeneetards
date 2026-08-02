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
import { useVisibleReviews } from "./useVisibleReviews.js";
import { useTheme } from "./theme.jsx";
import {
  RATING_DIFFICULTY, RATING_BEST_FOR, RATING_DIFFICULTY_LABELS, RATING_BEST_FOR_LABELS,
} from "./metadata.js";
import { ratingDisplay } from "./ratingConfidence.js";
import StudentAuth from "./StudentAuth.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { BRAND_TEAL } from "./brandColors.js";

const ACCENT = { teal: BRAND_TEAL, star: "#f59e0b", red: "#dc2626" };

// Matches the `plr_review_length` CHECK constraint added in
// docs/sql/reviews_hardening_2026-07-31.sql, and the cap a content-report note
// has always had. The server is the real enforcement; this is so a student
// finds out while typing rather than after pressing submit.
const MAX_REVIEW = 1000;

// Students must never see a raw Postgres or fetch error. Mapped against the
// text the database ACTUALLY produces -- this project already shipped a set of
// mappings written against invented error strings that therefore never matched
// (see VideoReport.jsx), so these are keyed to the real constraint/trigger
// names in community_schema.sql and reviews_hardening_2026-07-31.sql.
export function ratingErrorMessage(error) {
  const text = String(error?.message ?? "").toLowerCase();
  if (/plr_review_length|too long|value too long/.test(text))
    return `Please keep your review under ${MAX_REVIEW} characters.`;
  if (/plr_clarity_range|plr_question_range|rating between|violates check/.test(text))
    return "Those ratings look out of range. Please pick 1 to 5 stars.";
  if (/jwt|not authorized|permission denied|row-level security/.test(text))
    return "Your session expired. Sign in again, then resubmit.";
  if (/duplicate key|already exists/.test(text))
    return "You've already rated this course — submitting again updates it.";
  if (/failed to fetch|network|timeout/.test(text))
    return "Couldn't reach the server. Check your connection and try again.";
  return "Couldn't save your rating. Please try again.";
}

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

function CourseRatingInteractive({
  playlistId, initialAverage = 0, initialCount = 0, reloadReviews = null,
}) {
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
      setStatus({ ok: false, message: ratingErrorMessage(error) });
      return;
    }
    setStatus({ ok: true, message: existing ? "Rating updated." : "Thanks for rating!" });
    setExisting(true);
    refreshAverage();
    // Pull the public list again so the student sees their own review appear
    // (or their edit take effect) immediately. Without this it only showed up
    // after a manual page reload, which reads as "my review didn't save".
    reloadReviews?.();
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
            <span className={`block text-xs font-medium ${t.muted}`}>
              Review (optional) — shown publicly
            </span>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              maxLength={MAX_REVIEW}
              aria-describedby="review-visibility-note"
              placeholder="What worked, what didn't…"
              className={`mt-1 w-full resize-none rounded-lg border ${t.border} ${t.input} ${t.text} p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
            />
            {/* Students were never told this text is public — not here, not on
                submit, not in the policy. For an audience of minors that is the
                notice that actually matters, because it is the one shown at the
                moment they decide what to type. */}
            <span id="review-visibility-note" className={`mt-1 block text-xs ${t.faint}`}>
              Anyone can read this on the course page, signed in or not. Your
              name and email are never shown. Please don&apos;t include your
              name, school, coaching batch, or contact details. To remove it
              later, clear this box and submit again.
            </span>
            <span className={`mt-1 block text-right text-xs ${t.faint}`}>
              {review.length}/{MAX_REVIEW}
            </span>
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

// Shown to everyone, signed in or not -- excludes anything an admin hid
// (see rating_review_moderation.sql). No reviewer name is shown: sign-up
// only collects an email and password, so there is no real display name to
// attach, and inventing one would violate this project's own "nothing is
// invented" rule (see the file header of PlaylistBrowse.jsx).
function ReviewsList({ reviews, loading, released = RELEASE_FEATURES.reviewDisplay }) {
  const { t } = useTheme();

  if (!released || loading || reviews.length === 0) return null;

  return (
    <div className={`mt-8 rounded-2xl border ${t.card} ${t.border} p-6`}>
      <h2 className={`text-base font-semibold ${t.text}`}>What students are saying</h2>
      <ul className="mt-4 space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className={`border-t pt-4 first:border-t-0 first:pt-0 ${t.border}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="h-3.5 w-3.5"
                    style={{ color: ACCENT.star }}
                    fill={n <= r.rating ? ACCENT.star : "none"}
                    aria-hidden="true"
                  />
                ))}
              </span>
              {r.difficulty && (
                <span className={`text-xs ${t.muted}`}>{RATING_DIFFICULTY_LABELS[r.difficulty] ?? r.difficulty}</span>
              )}
              {r.best_for && (
                <span className={`text-xs ${t.muted}`}>· {RATING_BEST_FOR_LABELS[r.best_for] ?? r.best_for}</span>
              )}
              <span className={`text-xs ${t.faint}`}>{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <p className={`mt-1.5 text-sm ${t.text}`}>{r.review}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CourseRating({
  playlistId,
  initialAverage = 0,
  initialCount = 0,
  released = RELEASE_FEATURES.courseRatingSubmission,
  displayReleased = RELEASE_FEATURES.reviewDisplay,
}) {
  // The reviews query lives HERE, not inside ReviewsList, so that submitting
  // the form can refresh the list beside it. As siblings they had no shared
  // handle, which is why a student's own review only appeared after a manual
  // page reload.
  const { reviews, loading, reload } = useVisibleReviews(
    displayReleased ? playlistId : null,
  );

  return (
    <>
      {released ? (
        <CourseRatingInteractive
          playlistId={playlistId}
          initialAverage={initialAverage}
          initialCount={initialCount}
          reloadReviews={reload}
        />
      ) : (
        <CourseRatingSummary
          initialAverage={initialAverage}
          initialCount={initialCount}
        />
      )}
      <ReviewsList reviews={reviews} loading={loading} released={displayReleased} />
    </>
  );
}
