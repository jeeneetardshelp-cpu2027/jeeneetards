// PlaylistCard.jsx — the ONE course card (noSecondResultSystem guard).
//
// Moved out of PlaylistBrowse.jsx so the homepage (HomeSections.jsx) can
// import the card without dragging the whole ~32KB browse page into the
// eager entry chunk — on a cheap phone that module was being parsed before
// the student saw anything. It is still ONE card: catalogue and home render
// exactly this component, so they cannot drift.
//
// The rules from the catalogue still run through every line:
//   1. The CURATED title dominates — raw YouTube titles never appear here.
//   2. Nothing is invented. Anything unknown is simply absent — an absent
//      line reads as "no data", a placeholder reads as "broken product".

import { Link } from "react-router";
import { Star, Clock, Layers, Languages } from "lucide-react";
import { formatDuration } from "./usePlaylistBrowse.js";
import { COURSE_TYPES, DIFFICULTIES, LANGUAGES } from "./filterModel.js";
// ratingDisplay's real home is ratingConfidence.js — shared with course,
// comparison and faculty views so those screens cannot drift from the card.
import { ratingDisplay } from "./ratingConfidence.js";
import { langAttrs } from "./lang.js";
import { useTheme } from "./theme.jsx";
import { subjectColor, subjectInk, subjectTextColor } from "./brandColors.js";
import { courseCredit } from "./courseCredit.js";
import YouTubeThumbnail from "./YouTubeThumbnail.jsx";
import ChannelAvatar from "./ChannelAvatar.jsx";

// Labels come from the canonical filter vocabulary — a second copy here would
// drift, and the card would say "Advanced" while the filter said something else.
const COURSE_TYPE_LABEL = Object.fromEntries(COURSE_TYPES.map((c) => [c.id, c.label]));
const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));
const LANGUAGE_LABEL = Object.fromEntries(LANGUAGES.map((l) => [l.id, l.label]));

export function PlaylistCard({ course, onOpen, to, state, selected, onToggle, disabled, comparisonEnabled = true }) {
  const { t } = useTheme();
  const duration = formatDuration(course.durationSeconds);
  const rating = ratingDisplay(course.rating, course.ratingCount);
  // Three different jobs, three different values. `color` paints the spine and
  // the avatar (backgrounds, no contrast requirement against the page);
  // `textColor` is the theme token that is legible as small text; `ink` is what
  // is legible ON the avatar.
  const color = subjectColor(course.subject);
  const textColor = subjectTextColor(course.subject);
  const ink = subjectInk(course.subject);
  // When `teacher` is only the channel's own name, the card showed an
  // initials circle AND the channel logo AND the name twice. One credit.
  const credit = courseCredit({ teacher: course.teacher, institute: course.institute });
  const initials = (credit.teacher || "")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  // Subject leads the kicker; class levels ride alongside it instead of as a
  // separate chip row, so the card has one clear identity line.
  const kicker = [course.subject, ...(course.classLevels ?? [])].filter(Boolean).join(" · ");
  // LANGUAGE IS A BADGE, NOT A FACT. It used to sit mid-way through the row of
  // small grey facts, where a Hindi-medium student scanning a grid of cards had
  // no chance of spotting it — and for most of this catalogue's audience it is
  // the first thing they need to know. Unknown stays unknown: no badge at all
  // rather than a guessed "English" (rule 2).
  const language = course.language
    ? LANGUAGE_LABEL[course.language] ?? course.language
    : null;

  // Present facts only. Anything unknown is simply absent — repeating
  // "Teacher not recorded / Coverage not assessed / Not yet rated" on every
  // card made the whole catalogue read as broken (rule 2).
  const facts = [
    // On a chapter page this counts THIS chapter, not the whole course, so say
    // so — the bare number read as a course total and overstated the match.
    course.lectures != null && {
      icon: Layers,
      text: `${course.lectures} lecture${course.lectures === 1 ? "" : "s"}${course.chapterScoped ? " on this chapter" : ""}`,
    },
    duration && { icon: Clock, text: duration },
    // Language is deliberately absent here — it is the badge above the title.
    course.contentType && { text: COURSE_TYPE_LABEL[course.contentType] ?? course.contentType },
    course.difficulty && { text: DIFFICULTY_LABEL[course.difficulty] ?? course.difficulty },
    course.coverage != null && { text: `${course.coverage}% coverage` },
  ].filter(Boolean);

  // One quiet indicator instead of three apologies. Counted on the fields a
  // student actually decides with.
  const missing = [
    course.teacher == null, course.durationSeconds == null,
    course.coverage == null, course.contentType == null, course.difficulty == null,
  ].filter(Boolean).length;
  const limited = missing >= 3;

  return (
    <div className="edge-glow hover-lift flex h-full min-h-[15rem] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-e1">
      {/* subject colour spine */}
      <span className="h-1 w-full shrink-0" style={{ background: color }} />
      <YouTubeThumbnail
        videoId={course.coverVideoId}
        className="aspect-video w-full border-b border-hairline"
      />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {(kicker || language) && (
          <div className="flex min-w-0 items-start justify-between gap-2">
            {kicker && (
              <span className="min-w-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: textColor }}>
                {kicker}
              </span>
            )}
            {language && (
              <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${t.chip}`}>
                <Languages aria-hidden="true" className="h-3 w-3 shrink-0" />
                {/* Read as "Taught in Hindi": the bare word alone is ambiguous
                    to a screen reader arriving mid-card. */}
                <span className="sr-only">Taught in </span>
                {language}
              </span>
            )}
          </div>
        )}

        {/* curated title leads; clamped so every card is the same shape */}
        <h3
          {...langAttrs(course.title)}
          className="mt-2 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.015em] text-ink"
        >
          {course.title}
        </h3>

        {/* Faculty and institute. Omitted when unknown — an absent line reads
            as "no data", a placeholder reads as "broken product". */}
        {(credit.teacher || credit.institute) && (
          <div className={`mt-2.5 flex min-w-0 items-center gap-2 text-sm ${t.faint}`}>
            {credit.teacher && (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold"
                style={{ background: color, color: ink }} aria-hidden="true">
                {initials || "?"}
              </span>
            )}
            <span className="line-clamp-1 flex min-w-0 items-center gap-1">
              {credit.teacher}
              {credit.teacher && credit.institute && <span className={t.muted}>·</span>}
              {course.institute && (
                course.instituteId ? (
                <Link
                  to={`/browse?channel=${course.instituteId}`}
                  aria-label={`View all courses from ${course.institute}`}
                  className={`inline-flex min-w-0 items-center gap-1 rounded-sm ${t.muted} transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                >
                  <ChannelAvatar
                    url={course.instituteLogoUrl}
                    name={course.institute}
                    className="h-5 w-5"
                  />
                  <span className="truncate">{course.institute}</span>
                </Link>
                ) : (
                  <span className={`inline-flex min-w-0 items-center gap-1 ${t.muted}`}>
                    <ChannelAvatar
                      url={course.instituteLogoUrl}
                      name={course.institute}
                      className="h-5 w-5"
                    />
                    <span className="truncate">{course.institute}</span>
                  </span>
                )
              )}
            </span>
          </div>
        )}

        <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${t.faint}`}>
          {facts.map((f, i) => (
            <span key={i} className="flex items-center gap-1">
              {f.icon && <f.icon className="h-3.5 w-3.5 shrink-0" />}
              {f.text}
            </span>
          ))}
        </div>

        {(rating || limited) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {rating?.kind === "scored" && (
              <span className={`flex items-center gap-1 font-semibold ${t.text}`}
                style={{ fontVariantNumeric: "tabular-nums" }}>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating.score.toFixed(1)}
                <span className={`font-normal ${t.muted}`}>({rating.count})</span>
              </span>
            )}
            {/* neutral, unranked, no star — it is a count, not a score */}
            {rating?.kind === "low" && <span className={t.muted}>{rating.text}</span>}
            {limited && <span className={t.muted}>Limited metadata</span>}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          {/* A real link when the caller supplies `to` (crawlable, open-in-new-tab);
              the legacy onOpen button is kept for callers that haven't migrated. */}
          {to ? (
            <Link
              to={to}
              state={state}
              className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition duration-300 [transition-timing-function:var(--ease-out-expo)] hover:brightness-110"
            >
              View course
            </Link>
          ) : (
            <button
              onClick={() => onOpen(course)}
              className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition duration-300 [transition-timing-function:var(--ease-out-expo)] hover:brightness-110"
            >
              View course
            </button>
          )}
          {comparisonEnabled && (
            <label
              className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs transition-colors duration-200 ${
                selected
                  ? "border-accent-line bg-accent-soft font-medium text-accent"
                  : `${t.border} ${t.faint} hover:border-hairline-strong`
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <input type="checkbox" className="sr-only" checked={selected} disabled={disabled}
                     onChange={() => onToggle(course)} />
              Compare
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
