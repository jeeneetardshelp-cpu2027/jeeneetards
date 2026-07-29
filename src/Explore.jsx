// =====================================================================
//  Explore.jsx  —  the guided, path-based curriculum cascade.
//
//  Route shape (all slugs, so links are shareable and Back works):
//    /explore                                  → pick a learning goal
//    /explore/jee                              → pick a stage (class)
//    /explore/jee/class-11                     → pick a subject
//    /explore/jee/class-11/physics             → pick a chapter
//    /explore/jee/class-11/physics/kinematics  → playlist results
//
//  School Boards inserts a Board stage, so its path is one segment longer:
//    /explore/school                           → pick a board
//    /explore/school/cbse/class-10/physics/motion
//  Board is part of the URL (not component state), so a board-scoped page is
//  linkable and survives a refresh, and results are filtered through
//  playlist_boards — CBSE and ICSE never bleed into each other.
//
//  Options at every level come from the database, and only branches that
//  actually have content are offered — that's why JEE never shows Biology.
//  Exam / stage / subject are single-select; picking a higher level drops
//  the deeper parts of the path automatically (the path IS the state).
//
//  The final step does NOT render results. It redirects to the one result
//  system at its canonical address, so guided and catalogue are the same page.
//  Class narrows results in the DATABASE via playlist_class_levels.
// =====================================================================

import { useState } from "react";
import { Link, useParams, Navigate } from "react-router";
import { BookOpen, PlayCircle } from "lucide-react";
import {
  useLearningGoals, useClassLevels, useGoalCatalog, useBoards,
} from "./useExplore.js";
import { CLASS_LEVELS_BY_GOAL } from "./classLevels.js";
import { useDebouncedValue } from "./useBrowse.js";
import { useScopedSearch } from "./useScopedSearch.js";
import { canonicalBrowseUrl } from "./canonicalUrl.js";
import { GlobalHeader, HeaderSearch, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_NAVY, BRAND_TEAL } from "./brandColors.js";

const BRAND = { navy: BRAND_NAVY, teal: BRAND_TEAL };

const path = (...parts) => "/explore/" + parts.filter(Boolean).join("/");

export function scopedChapterUrl(chapter, context) {
  return canonicalBrowseUrl({
    goal: context.goal,
    cls: context.cls,
    board: context.board,
    subject: chapter.subjectSlug ?? context.subject,
    chapter: chapter.slug,
  });
}

export default function Explore() {
  const { t } = useTheme();
  const { goal, s1, s2, s3, s4 } = useParams();

  // School Boards inserts a Board stage, so every later segment shifts by one.
  // Board lives in the URL, not in component state, so a board-scoped page is
  // linkable, shareable and survives a refresh.
  const isSchool = goal === "school";
  const board = isSchool ? s1 : undefined;
  const cls = isSchool ? s2 : s1;
  const subject = isSchool ? s3 : s2;
  const chapter = isSchool ? s4 : s3;

  const {
    goals, loading: goalsLoading, error: goalsError, retry: retryGoals,
  } = useLearningGoals();
  const { classLevels } = useClassLevels();
  const { boards, loading: boardsLoading, error: boardsError,
          unavailable: boardsUnavailable } = useBoards(isSchool);
  const boardNode = boards.find((x) => x.slug === board);
  // Path builder that knows about the extra stage.
  const p = (...rest) => path(goal, ...(isSchool ? [board, ...rest] : rest));

  const goalNode = goals.find((g) => g.slug === goal);
  const classNode = classLevels.find((c) => c.slug === cls);
  const {
    subjects, chaptersBySubject, loading: catLoading,
    error: catalogError, ready: catalogReady, retry: retryCatalog,
  } = useGoalCatalog({
    // Subjects are not needed until a real class has been selected. Waiting
    // also prevents a broad unclassified request during the class step.
    goal: classNode ? goalNode?.slug : null,
    stage: classNode?.slug,
    subject,
  });
  const subjectNode = subjects.find((s) => s.slug === subject);
  const chapterNode = subjectNode
    ? (chaptersBySubject[subjectNode.id] ?? []).find((c) => c.slug === chapter)
    : null;

  // Breadcrumb: Explore › JEE › Class 11 › Physics › Kinematics (each clickable)
  const crumbs = [
    { label: "Explore", to: "/explore" },
    goalNode && { label: goalNode.name, to: path(goal) },
    isSchool && boardNode && { label: boardNode.name, to: p() },
    classNode && { label: classNode.name, to: p(cls) },
    subjectNode && { label: subjectNode.name, to: p(cls, subject) },
    chapterNode && { label: chapterNode.name, to: p(cls, subject, chapter) },
  ].filter(Boolean);

  // Context search — scoped to whatever the student has selected so far.
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const scopeLabel = crumbs.slice(1).map((c) => c.label).join(" › ");
  const scoped = useScopedSearch(debouncedSearch, {
    goalId: goalNode?.id,
    subjectId: subjectNode?.id,
    chapterId: chapterNode?.id,
  });
  const searching = Boolean(goalNode) && debouncedSearch.trim().length > 0;

  // A slug that matches nothing must not render a lying step: /explore/boards
  // used to show the exam picker under an "Explore Boards courses" title — a
  // soft-404 with mismatched metadata. Once the relevant list has actually
  // loaded FOR THIS SCOPE, send the student to the nearest real step instead.
  // The subject/chapter guards gate on `catalogReady` — not just !loading —
  // because catalogue state survives param-only navigations, so the first
  // render after a Back-jump can hold another goal/class's subjects with
  // loading still false. The class guard mirrors the stage step's own
  // CLASS_LEVELS_BY_GOAL filter: a globally valid class the goal never offers
  // (JEE Class 10) is as unknown as a garbage slug.
  const offeredClassSlugs =
    CLASS_LEVELS_BY_GOAL[goal] ?? classLevels.map((x) => x.slug);
  const unknownSlugTarget =
    goal && !goalsLoading && !goalsError && goals.length > 0 && !goalNode
      ? "/explore"
      : isSchool && board && !boardsLoading && !boardsError && !boardsUnavailable &&
          boards.length > 0 && !boardNode
        ? path(goal)
        : cls && classLevels.length > 0 &&
            (!classNode || !offeredClassSlugs.includes(cls))
          ? p()
          : subject && classNode && catalogReady &&
              subjects.length > 0 && !subjectNode
            ? p(cls)
            : chapter && subjectNode && catalogReady && !chapterNode
              ? p(cls, subject)
              : null;
  if (unknownSlugTarget) return <Navigate to={unknownSlugTarget} replace />;

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader
        crumbs={crumbs}
        search={
          goalNode ? (
            <HeaderSearch
              value={searchInput}
              onChange={(ev) => setSearchInput(ev.target.value)}
              onClear={() => setSearchInput("")}
              placeholder={`Search within ${scopeLabel}`}
            />
          ) : null
        }
      />

      <main className="py-6 sm:py-8">
        <Container>
        {searching ? (
          <ScopedResults
            scoped={scoped}
            scopeLabel={scopeLabel}
            query={debouncedSearch.trim()}
            context={{
              goal: goalNode?.slug,
              cls: classNode?.slug,
              board: boardNode?.slug,
              subject: subjectNode?.slug,
            }}
          />
        ) : !goalNode ? (
          <Step
            title="What are you preparing for?"
            loading={goalsLoading}
            error={goalsError}
            onRetry={retryGoals}
            options={goals.map((g) => ({
              key: g.id,
              label: g.name,
              // School Boards needs public.boards, which is not deployed. Offer
              // it as "Coming soon" rather than letting a student walk into a
              // journey that dead-ends in a database error.
              hint: g.slug === "school" && boardsUnavailable ? "Coming soon"
                    : g.count > 0 ? countHint(g) : "Coming soon",
              disabled: g.count === 0 || (g.slug === "school" && boardsUnavailable),
              to: path(g.slug),
            }))}
          />
        ) : isSchool && boardsUnavailable ? (
          <div className={`mt-6 rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
            <p className={`text-sm font-semibold ${t.text}`}>School Boards is not available yet.</p>
            <p className={`mt-1 text-sm ${t.muted}`}>
              We are still preparing board-wise content. JEE and NEET are ready now.
            </p>
          </div>
        ) : isSchool && !boardNode && boardsError ? (
          <p className={`mt-6 text-sm ${t.muted}`}>{boardsError}</p>
        ) : isSchool && !boardNode ? (
          <Step
            title="Which board are you on?"
            loading={boardsLoading}
            options={boards.map((b) => ({
              key: b.id,
              label: b.name,
              hint: b.courseCount > 0 ? `${b.courseCount} courses` : "Coming soon",
              disabled: b.courseCount === 0,
              to: path(goal, b.slug),
            }))}
          />
        ) : !classNode ? (
          <Step
            title="Which stage are you in?"
            options={classLevels
              .filter((c) =>
                (CLASS_LEVELS_BY_GOAL[goal] ?? classLevels.map((x) => x.slug)).includes(
                  c.slug
                )
              )
              .map((c) => ({
                key: c.id,
                label: c.name,
                to: p(c.slug),
              }))}
          />
        ) : !subjectNode ? (
          <Step
            title="Choose a subject"
            loading={catLoading}
            error={catalogError}
            onRetry={retryCatalog}
            emptyMessage={`No ${classNode.name} courses are available yet.`}
            emptyAction={{
              label: "Choose another stage",
              to: p(),
            }}
            options={subjects.map((s) => ({
              key: s.id,
              label: s.name,
              hint: countHint(s),
              to: p(cls, s.slug),
            }))}
          />
        ) : !chapterNode ? (
          <Step
            title="Choose a chapter"
            loading={catLoading}
            error={catalogError}
            onRetry={retryCatalog}
            options={(chaptersBySubject[subjectNode.id] ?? []).map((ch) => ({
              key: ch.id,
              label: ch.name,
              hint: countHint(ch),
              to: p(cls, subject, ch.slug),
            }))}
          />
        ) : (
          // The guided journey does not render its own results. The last step
          // hands off to the ONE result system at its canonical address, so
          // guided and catalogue are the same page:
          //   /browse?goal=jee&class=11&subject=physics&chapter=kinematics
          <Navigate
            replace
            to={canonicalBrowseUrl({
              goal: goalNode.slug,
              cls: classNode.slug,
              board: boardNode?.slug,
              subject: subjectNode.slug,
              chapter: chapterNode.slug,
            })}
          />
        )}
        </Container>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Context search results — chapters + lectures within the current scope,
//  with an escape hatch to search the whole library.
// ---------------------------------------------------------------------
function ScopedResults({ scoped, scopeLabel, query, context }) {
  const { results, loading, total } = scoped;
  const { t } = useTheme();

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className={`text-sm ${t.muted}`}>
          {loading ? "Searching…" : `${total} result${total === 1 ? "" : "s"}`} in{" "}
          <span className={`font-semibold ${t.text}`}>{scopeLabel}</span>
        </h1>
        <Link
          to={`/?q=${encodeURIComponent(query)}`}
          className="inline-flex min-h-11 items-center px-2 text-xs font-medium"
          style={{ color: BRAND.teal }}
        >
          Search the entire library →
        </Link>
      </div>

      {!loading && total === 0 && (
        <p className={`mt-6 text-sm ${t.muted}`}>
          Nothing in this section matches “{query}”. Try the entire library.
        </p>
      )}

      {results.chapters.length > 0 && (
        <ResultGroup title="Chapters" icon={BookOpen}>
          {results.chapters.map((c) => (
            <ResultRow
              key={`ch-${c.id}`}
              title={c.name}
              subtitle={c.subject}
              // Scoped search already knows the goal and subject the student
              // is inside, so emit the full canonical URL, not a bare ?ch=.
              to={scopedChapterUrl(c, context)}
            />
          ))}
        </ResultGroup>
      )}

      {results.lectures.length > 0 && (
        <ResultGroup title="Lectures" icon={PlayCircle}>
          {results.lectures.map((v) => (
            <ResultRow
              key={`v-${v.id}`}
              title={v.title}
              subtitle="Lecture"
              // Browse's top level is a learning goal now. A search row
              // carries a category_id, not a goal, and inventing one would be
              // a guess — so link by subject/chapter and leave the goal
              // filter unset rather than pre-selecting the wrong branch.
              to={
                `/browse?sub=${v.subjectId}` +
                (v.chapterId ? `&ch=${v.chapterId}` : "")
              }
            />
          ))}
        </ResultGroup>
      )}
    </section>
  );
}

function ResultGroup({ title, icon: Icon, children }) {
  const { t } = useTheme();
  return (
    <div className="mt-6">
      <h2 className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${t.muted}`}>
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
      <ul className={`divide-y overflow-hidden rounded-xl border ${t.divider} ${t.border} ${t.card}`}>
        {children}
      </ul>
    </div>
  );
}

function ResultRow({ title, subtitle, to }) {
  const { t } = useTheme();
  return (
    <li>
      <Link
        to={to}
        className={`flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition ${t.hover}`}
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${t.text}`}>{title}</span>
          {subtitle && <span className={`block truncate text-xs ${t.muted}`}>{subtitle}</span>}
        </span>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------
//  A single cascade step: a heading + a grid of choices.
// ---------------------------------------------------------------------
const countHint = ({ count, countUnit = "course" }) =>
  `${count} ${countUnit}${count === 1 ? "" : "s"}`;

function Step({
  title,
  options,
  loading,
  error,
  onRetry,
  emptyMessage = "Nothing here yet.",
  emptyAction,
}) {
  const { t } = useTheme();
  return (
    <section>
      <h1 className={`text-xl font-bold tracking-tight ${t.text}`}>{title}</h1>
      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-16 animate-pulse rounded-xl ${t.input}`} />
          ))}
        </div>
      ) : error ? (
        <div className={`mt-6 rounded-xl border border-dashed ${t.border} ${t.card} p-6`}>
          <p className={`text-sm font-medium ${t.text}`}>{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className={`mt-3 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
            >
              Try again
            </button>
          )}
        </div>
      ) : options.length === 0 ? (
        <div className={`mt-6 rounded-xl border border-dashed ${t.border} ${t.card} p-6`}>
          <p className={`text-sm font-medium ${t.text}`}>{emptyMessage}</p>
          {emptyAction && (
            <Link
              to={emptyAction.to}
              className={`mt-3 inline-flex min-h-11 items-center rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
            >
              {emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {options.map((o) =>
            // Anchors cannot be disabled, so a "Coming soon" option stays a
            // real disabled <button>; only live options become crawlable links.
            o.disabled ? (
              <button
                key={o.key}
                disabled
                className={`min-h-11 rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`block font-semibold ${t.text}`}>{o.label}</span>
                {o.hint && <span className={`mt-0.5 block text-xs ${t.muted}`}>{o.hint}</span>}
              </button>
            ) : (
              <Link
                key={o.key}
                to={o.to}
                className={`block min-h-11 rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`block font-semibold ${t.text}`}>{o.label}</span>
                {o.hint && <span className={`mt-0.5 block text-xs ${t.muted}`}>{o.hint}</span>}
              </Link>
            )
          )}
        </div>
      )}
    </section>
  );
}
