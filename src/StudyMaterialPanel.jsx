import { BookOpen, FileText, RefreshCw } from "lucide-react";
import { Link } from "react-router";
// Chapter names are catalogue text, sometimes Devanagari, under a document
// that declares lang="en". See lang.js.
import { langAttrs } from "./lang.js";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { PAPER_LANDINGS } from "./studyMaterialLandings.js";
import { useStudyMaterials } from "./useStudyMaterials.js";

// ---------------------------------------------------------------------------
// The exam-level way out of a chapter.
//
// Verified in production on 2026-09-02: study_material_scopes carries a
// chapter_id on 460 rows and NOT ONE of them belongs to a previous_year_paper.
// Every one of the 183 papers is scoped at goal level only. So the
// chapter-scoped query this panel runs can never return a paper, and a student
// who has just finished a lecture is offered no route to practice at all.
//
// What follows is an honest substitute, NOT a fix: one labelled link to the
// WHOLE exam's papers, worded so it cannot be read as "questions from this
// chapter". The real fix is tagging the paper corpus by chapter; until then
// this must never imply a chapter match it does not have.
//
// Goal → landing is an explicit table, never derived from the goal string.
// The catalogue's learning-goal vocabulary (jee / neet / school / olympiad,
// carried on a course as its NAME — "JEE", "NEET", "School Boards") does not
// line up with the landing ids, so each entry is written out:
//   * "jee" covers BOTH registered JEE landings. It is genuinely ambiguous
//     between Main and Advanced — the same ambiguity StudyMaterialCard refuses
//     to resolve for its mock-test pairing — so both are offered, each named
//     by its own exam, rather than one of them guessed at.
//   * "school" and "olympiad" are deliberately absent: no landing is
//     registered for either, and an unmapped or unknown goal renders nothing.
// ---------------------------------------------------------------------------
const PAPER_LANDING_IDS_BY_GOAL = Object.freeze({
  jee: ["jee-main", "jee-advanced"],
  "jee-main": ["jee-main"],
  "jee-advanced": ["jee-advanced"],
  neet: ["neet"],
});

const goalKey = (goal) => String(goal ?? "").trim().toLowerCase().replace(/\s+/g, "-");

/**
 * The registered paper landings for a course's learning goal(s). Accepts a
 * single goal or a list, of either the slug or the display name. Returns [] —
 * and so renders nothing — for a goal with no registered landing, and for a
 * missing, empty or unrecognised goal.
 */
export function paperLandingsForGoals(goals) {
  const list = Array.isArray(goals) ? goals : goals == null ? [] : [goals];
  const ids = [];
  for (const goal of list) {
    for (const id of PAPER_LANDING_IDS_BY_GOAL[goalKey(goal)] ?? []) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  // Resolved against the registry itself, so a landing that is retired from
  // PAPER_LANDINGS stops being linked here rather than 404ing.
  return ids
    .map((id) => PAPER_LANDINGS.find((landing) => landing.id === id) ?? null)
    .filter(Boolean);
}

export function StudyMaterialPanelView({
  chapterName, chapterId, goals = null,
  items = [], loading = false, error = null, retry = null,
}) {
  const examLandings = paperLandingsForGoals(goals);
  return (
    <section aria-labelledby="lesson-material-heading" className="mt-6 rounded-xl border border-hairline bg-surface-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Continue studying</p>
          {/* The heading mixes an English lead-in with the chapter name, and a
              mixed string is tagged as a whole rather than split into spans —
              the same call lang.js documents. Latin chapters leave no trace. */}
          <h2
            id="lesson-material-heading"
            {...langAttrs(chapterName)}
            className="mt-1 text-lg font-semibold text-ink"
          >
            Study material{chapterName ? ` for ${chapterName}` : ""}
          </h2>
        </div>
        <Link to={`/materials${chapterId ? `?chapterId=${encodeURIComponent(chapterId)}` : ""}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-accent">
          View all <BookOpen aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {loading && <p role="status" className="mt-4 text-sm text-ink-3">Loading reviewed material…</p>}
      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 text-sm text-ink-2">
          <span>{error}</span>
          {retry && <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Retry</button>}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-4 rounded-lg border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink-2">
          No reviewed material is linked to this chapter yet. The video is still available as usual.
        </p>
      )}
      {items.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((material) => <StudyMaterialCard key={material.id} material={material} compact />)}
        </div>
      )}

      {/* Exam level, below the chapter's own material and plainly separated
          from it. The sentence carries the whole claim: these are the exam's
          papers, and the reason they are not this chapter's.

          That reason is permanent, not a gap waiting to be filled. Every row
          here is a whole exam paper — 'covering Mathematics, Physics and
          Chemistry', as the catalogue's own descriptions put it — so scoping
          one to a chapter would be false: it would match nearly every chapter
          and tell a student a three-subject paper is about rotational motion.
          The chapter-scoped materials above are notes and formula sheets,
          which really are about one chapter. The unit that could honestly be
          chapter-scoped is a QUESTION, not a paper, and extracting questions
          is gated on docs/legal/question-bank-copyright-2026-09-02.md.

          Rendered at all only when the course's goal has a registered
          landing. */}
      {examLandings.length > 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          <p className="text-sm leading-relaxed text-ink-2">
            Papers aren’t tagged chapter by chapter: each one is a whole exam
            paper covering every subject. These are the whole exam’s papers,
            year by year — not a selection matching this lecture.
          </p>
          <ul className="mt-1">
            {examLandings.map((landing) => (
              <li key={landing.id}>
                <Link
                  to={landing.path}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
                >
                  <FileText aria-hidden="true" className="h-4 w-4" />
                  Previous-year papers for {landing.examLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function StudyMaterialPanel({ chapterId, chapterName, goals, videoId }) {
  const enabled = RELEASE_CAPABILITIES.studyMaterials && Boolean(chapterId || videoId);
  const state = useStudyMaterials({ chapterId, videoId, limit: 4 }, { enabled });
  if (!enabled || state.unavailable) return null;
  return (
    <StudyMaterialPanelView
      chapterId={chapterId}
      chapterName={chapterName}
      goals={goals}
      {...state}
    />
  );
}
