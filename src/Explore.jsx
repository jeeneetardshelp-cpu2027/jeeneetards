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
import {
  useLearningGoals, useClassLevels, useGoalCatalog, useBoards, usePopulatedClasses,
} from "./useExplore.js";
import { CLASS_LEVELS_BY_GOAL } from "./classLevels.js";
// ONE search surface, ONE renderer. Explore used to run its own useScopedSearch
// hook (raw ilike against `chapters` and `videos`) through its own ScopedResults
// component. That meant a query the homepage answered — "projctile motin",
// "kabir ki sakhi" — silently returned nothing once the student was inside the
// guided journey, because the scoped hook had no typo tolerance, no
// Devanagari/Hinglish bridge and none of universal_search's filler-token work.
// Both the hook and the renderer are deleted; this box now calls the same
// component /search and the homepage hero call.
import UniversalSearch from "./UniversalSearch.jsx";
import { canonicalBrowseUrl } from "./canonicalUrl.js";
import { exploreStepHeading } from "./exploreHeading.js";
import { GlobalHeader, HeaderSearch, Container, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
// Step cards are labelled with catalogue names (goals, boards, classes,
// subjects, chapters), and chapter names in particular are sometimes
// Devanagari under a document that declares lang="en". See lang.js.
import { langAttrs } from "./lang.js";
import { useStructuredData } from "./PageMetadata.jsx";
import {
  breadcrumbListSchema,
  itemListSchema,
  learningResourceSchema,
} from "./structuredData.js";
import { getSubjectGuide } from "./subjectGuides.js";


const path = (...parts) => "/explore/" + parts.filter(Boolean).join("/");

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
  const classStepActive = Boolean(goalNode) && !cls && (!isSchool || Boolean(boardNode));
  const {
    classSlugs: populatedClassSlugs,
    loading: classesLoading,
    error: classesError,
    ready: classesReady,
    retry: retryClasses,
  } = usePopulatedClasses(goalNode?.slug, classStepActive);
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
  const subjectGuide = subjectNode && !chapter
    ? getSubjectGuide({
        goal: goalNode?.slug,
        cls: classNode?.slug,
        subject: subjectNode.slug,
      })
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

  // Context search. NOT scoped any more, and it says so on screen rather than
  // implying otherwise — see the note beside the results below and the
  // `universal_search` signature in
  // supabase/migrations/20260831140005_production_baseline.sql, which takes
  // (p_query, p_types, p_limit, p_offset) and nothing else.
  //
  // No local debounce: useUniversalSearch already debounces, cancels obsolete
  // responses and enforces the database's minimum length, so a second timer
  // here would only add ~250ms of lag before the first request.
  const [searchInput, setSearchInput] = useState("");
  const stepScope = crumbs.slice(1).map((c) => c.label);
  const scopeLabel = stepScope.join(" › ");
  const searching = Boolean(goalNode) && searchInput.trim().length > 0;

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
        : isSchool && boardNode && boardNode.courseCount === 0
          ? path(goal)
        : cls && classLevels.length > 0 &&
            (!classNode || !offeredClassSlugs.includes(cls))
          ? p()
          : classStepActive && classesReady && !classesError && populatedClassSlugs.length === 0
            ? isSchool ? path(goal) : "/explore"
          : cls && classNode && catalogReady && subjects.length === 0
            ? p()
          : subject && classNode && catalogReady &&
              subjects.length > 0 && !subjectNode
            ? p(cls)
            : subjectNode && catalogReady &&
                (chaptersBySubject[subjectNode.id] ?? []).length === 0
              ? p(cls)
            : chapter && subjectNode && catalogReady && !chapterNode
              ? p(cls, subject)
              : null;

  // One source for both the visible Step and its ItemList. Previously the
  // edge response described these options, but hydration registered only the
  // breadcrumb and removed the server ItemList from the document head.
  const stepOptions = !goalNode
    ? goals.map((g) => ({
        key: g.id,
        label: g.name,
        hint: g.slug === "school" && boardsUnavailable ? "Coming soon"
          : g.count > 0 ? countHint(g) : "Coming soon",
        disabled: g.count === 0 || (g.slug === "school" && boardsUnavailable),
        to: path(g.slug),
      }))
    : isSchool && !boardNode
      ? boards.map((b) => ({
          key: b.id,
          label: b.name,
          hint: b.courseCount > 0 ? `${b.courseCount} courses` : "Coming soon",
          disabled: b.courseCount === 0,
          to: path(goal, b.slug),
        }))
      : !classNode
        ? classLevels
            .filter((c) => populatedClassSlugs.includes(c.slug))
            .map((c) => ({ key: c.id, label: c.name, to: p(c.slug) }))
        : !subjectNode
          ? subjects.map((s) => ({
              key: s.id,
              label: s.name,
              hint: countHint(s),
              to: p(cls, s.slug),
            }))
          : !chapterNode
            ? (chaptersBySubject[subjectNode.id] ?? []).map((ch) => ({
                key: ch.id,
                label: ch.name,
                hint: countHint(ch),
                // The final choice links directly to the canonical result page.
                to: canonicalBrowseUrl({
                  goal: goalNode.slug,
                  cls: classNode.slug,
                  board: boardNode?.slug,
                  subject: subjectNode.slug,
                  chapter: ch.slug,
                }),
              }))
            : [];
  const navigableStepOptions = stepOptions.filter((option) =>
    !option.disabled && option.to);
  const stepOptionsKey = navigableStepOptions
    .map((option) => `${option.key}:${option.label}:${option.to}`)
    .join("|");
  // The SAME `crumbs` this component already builds for its own header — no
  // second derivation to drift from what students see. Skipped while
  // searching (a live query isn't a stable page identity worth marking up)
  // and — critically — computed AFTER unknownSlugTarget above: this render
  // is about to bail into a redirect for an unknown slug, and writing a
  // BreadcrumbList that names a URL the app itself has just decided is not
  // real would put invalid markup in the DOM for the render this component
  // never actually settles on.
  // `to` -> `url`: the breadcrumb builder returns null for the one-item root
  // trail, while its navigable goal choices still produce a useful ItemList.
  useStructuredData(
    searching || unknownSlugTarget
      ? []
      : [
          breadcrumbListSchema(crumbs.map((c) => ({ label: c.label, url: c.to ?? null }))),
          itemListSchema(navigableStepOptions.map((option, index) => ({
            title: option.label,
            url: option.to,
            position: index + 1,
          }))),
          learningResourceSchema({
            guide: subjectGuide,
            url: crumbs.at(-1)?.to,
          }),
        ],
    [searching, unknownSlugTarget, goalNode?.slug, boardNode?.slug, classNode?.slug, subjectNode?.slug, chapterNode?.slug, subjectGuide?.title, stepOptionsKey],
  );

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
              // It used to say "Search within JEE › Class 11 › Physics". It no
              // longer narrows to that, so it no longer claims to.
              placeholder="Search the library"
            />
          ) : null
        }
      />

      <main id={MAIN_CONTENT_ID} className="py-6 sm:py-8">
        <Container>
        {searching ? (
          <SearchWithin query={searchInput} scopeLabel={scopeLabel} />
        ) : !goalNode ? (
          <Step
            title="What are you preparing for?"
            loading={goalsLoading}
            error={goalsError}
            onRetry={retryGoals}
            options={stepOptions}
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
            title={exploreStepHeading("board", stepScope)}
            loading={boardsLoading}
            options={stepOptions}
          />
        ) : !classNode ? (
          <Step
            title={exploreStepHeading("class", stepScope)}
            loading={classesLoading || !classesReady}
            error={classesError}
            onRetry={retryClasses}
            options={stepOptions}
          />
        ) : !subjectNode ? (
          <Step
            title={exploreStepHeading("subject", stepScope)}
            loading={catLoading}
            error={catalogError}
            onRetry={retryCatalog}
            emptyMessage={`No ${classNode.name} courses are available yet.`}
            emptyAction={{
              label: "Choose another stage",
              to: p(),
            }}
            options={stepOptions}
          />
        ) : !chapterNode ? (
          <>
            <Step
              title={exploreStepHeading("chapter", stepScope)}
              loading={catLoading}
              error={catalogError}
              onRetry={retryCatalog}
              options={stepOptions}
            />
            {subjectGuide && !catLoading && !catalogError && (
              <SubjectGuide guide={subjectGuide} />
            )}
          </>
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

export function SubjectGuide({ guide }) {
  const { t } = useTheme();

  return (
    <article
      id="subject-guide"
      aria-labelledby="subject-guide-title"
      className={`mt-10 border-t ${t.border} pt-8`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${t.muted}`}>
        {guide.label}
      </p>
      <h2 id="subject-guide-title" className={`mt-2 text-xl font-bold tracking-tight ${t.text}`}>
        {guide.title}
      </h2>
      <div className={`mt-4 space-y-3 text-sm leading-relaxed ${t.faint}`}>
        {guide.introduction.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {guide.sections.map((section) => (
          <section key={section.title}>
            <h3 className={`font-semibold ${t.text}`}>{section.title}</h3>
            {section.items && (
              <ol className={`mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${t.faint}`}>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ol>
            )}
            {section.paragraphs && (
              <div className={`mt-2 space-y-3 text-sm leading-relaxed ${t.faint}`}>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
          </section>
        ))}
      </div>

      <section className={`mt-6 rounded-xl border ${t.border} ${t.card} p-4`}>
        <h3 className={`text-sm font-semibold ${t.text}`}>Check the current official sources</h3>
        <ul className="mt-2 space-y-2">
          {guide.sources.map((source) => (
            <li key={source.href}>
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className={`mt-2 text-xs ${t.muted}`}>Sources checked {guide.sourceChecked}.</p>
      </section>

      <p className={`mt-4 text-xs leading-relaxed ${t.muted}`}>
        Read{" "}
        <Link
          to="/methodology"
          className="font-medium text-accent underline underline-offset-4"
        >
          how JEENEETARD classifies and checks courses
        </Link>
        .
      </p>
    </article>
  );
}

// ---------------------------------------------------------------------
//  Context search — the ONE renderer, and an honest label above it.
//
//  This box USED to promise scoping: "Search within JEE › Class 11 › Physics",
//  a result count "in" that scope, and rows built from a goal/subject-filtered
//  ilike query. Two things were wrong with keeping that promise here.
//
//  1. universal_search() takes (p_query, p_types, p_limit, p_offset). There is
//     no scope parameter — see the function body in
//     supabase/migrations/20260831140005_production_baseline.sql. Chapter rows
//     come back carrying only a chapter_id, so there is nothing on a returned
//     row to filter a goal or a class against either.
//  2. Filtering the returned PAGE client-side would be worse than not scoping.
//     The RPC ranks, counts and pages on the server, so dropping rows after the
//     fact would print a group total the list does not contain, and would show
//     "nothing here" whenever the in-scope matches sat past the first page.
//     That is inventing a result the backend never gave us.
//
//  So the search is library-wide, and the copy says library-wide. The student
//  keeps the typo tolerance, the Devanagari/Hinglish bridge and the correct
//  destinations they get everywhere else — which is what they were actually
//  missing here. Restoring true scoping needs a scoped RPC parameter; that is
//  recorded for the owner, not faked in the client.
// ---------------------------------------------------------------------
function SearchWithin({ query, scopeLabel }) {
  const { t } = useTheme();
  return (
    <section>
      <h1 className={`text-sm ${t.muted}`}>
        Searching the whole library
        {scopeLabel ? (
          <>
            {" "}— not only{" "}
            <span className={`font-semibold ${t.text}`}>{scopeLabel}</span>
          </>
        ) : null}
        .
      </h1>

      <div className="mt-4">
        <UniversalSearch
          query={query}
          footer={
            <Link
              to={`/search?q=${encodeURIComponent(query.trim())}`}
              className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-accent"
            >
              Open this search on its own page →
            </Link>
          }
        />
      </div>
    </section>
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
            // The label span already exists in both branches, so the language
            // tag rides on it (lang.js); the Latin count hint stays outside.
            o.disabled ? (
              <button
                key={o.key}
                disabled
                className={`min-h-11 rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span {...langAttrs(o.label)} className={`block font-semibold ${t.text}`}>{o.label}</span>
                {o.hint && <span className={`mt-0.5 block text-xs ${t.muted}`}>{o.hint}</span>}
              </button>
            ) : (
              <Link
                key={o.key}
                to={o.to}
                className={`block min-h-11 rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span {...langAttrs(o.label)} className={`block font-semibold ${t.text}`}>{o.label}</span>
                {o.hint && <span className={`mt-0.5 block text-xs ${t.muted}`}>{o.hint}</span>}
              </Link>
            )
          )}
        </div>
      )}
    </section>
  );
}
