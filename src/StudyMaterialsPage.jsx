import { useEffect } from "react";
import { ArrowRight, BookOpen, FileCheck2, FileText, RefreshCw, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Page } from "./AppShell.jsx";
import { useStructuredData } from "./PageMetadata.jsx";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { JEE_MAIN_PAPERS_PATH } from "./studyMaterialLandings.js";
import {
  applyMaterialScopeChange,
  normalizeMaterialScopeParams,
  readMaterialScope,
} from "./studyMaterialScope.js";
import { studyMaterialsPageSchemas } from "./studyMaterialsStructuredData.js";
import { useStudyMaterialCatalog } from "./useStudyMaterialCatalog.js";
import {
  STUDY_MATERIAL_PAGE_SIZE,
  OFFERED_MATERIAL_TYPES,
  useStudyMaterials,
} from "./useStudyMaterials.js";

const FALLBACK_GOALS = [
  { slug: "jee", name: "JEE" },
  { slug: "neet", name: "NEET" },
  { slug: "school", name: "School / CBSE" },
  { slug: "olympiad", name: "Olympiad" },
];

const SELECT_CLASS = "min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent-line";

function Filter({ label, value, onChange, children, disabled = false, hint = null }) {
  const hintId = hint ? `material-filter-${label.toLowerCase()}-hint` : undefined;
  return (
    <div className="min-w-0">
      <label className="block min-w-0">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
        <select
          className={SELECT_CLASS}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-describedby={hintId}
        >
          {children}
        </select>
      </label>
      {/* A greyed-out control with no explanation reads as broken. Say what
          has to be chosen first instead of leaving the student tapping it.
          Outside the <label> on purpose: inside, it would be read as part of
          the control's name rather than as its description. */}
      {hint && <p id={hintId} className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

/**
 * The options for one level, with the active value guaranteed to be among
 * them.
 *
 * A selection that is no longer offered — ?subject=biology on a JEE link, a
 * chapter whose subject was just changed — would otherwise leave the <select>
 * showing "All subjects" while the query still filters by biology: a control
 * lying about what the page is doing. The slug is shown, never a made-up
 * name, because an unlisted value is one we could not resolve.
 */
function optionsFor(items, active) {
  if (!active || items.some((item) => item.slug === active)) return items;
  return [{ id: `active-${active}`, slug: active, name: active }, ...items];
}

export function StudyMaterialsDirectoryView({
  items = [], total = 0, loading = false, loadingMore = false,
  error = null, loadMoreError = null, unavailable = false,
  hasMore = false, loadMore = null, retry = null,
  heading = "Study material", eyebrow = "Reviewed resources",
  emptyTitle = "No reviewed material for these filters yet",
  emptyDescription = "Try a broader exam, subject or material type.",
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading study material" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl border border-hairline bg-surface" />
        ))}
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
        <BookOpen aria-hidden="true" className="mx-auto h-8 w-8 text-accent" />
        <h2 className="mt-4 text-lg font-semibold text-ink">Study material is being prepared</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          The reviewed material library is not connected yet. Course videos remain available while this section is prepared.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-hairline bg-surface p-8 text-center">
        <p className="font-semibold text-ink">{error}</p>
        {retry && (
          <button type="button" onClick={retry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent-line px-4 text-sm font-semibold text-accent">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Try again
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
        <SearchX aria-hidden="true" className="mx-auto h-8 w-8 text-ink-3" />
        <h2 className="mt-4 text-lg font-semibold text-ink">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-ink-2">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="material-results-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
          <h2 id="material-results-heading" className="mt-1 text-2xl font-semibold text-ink">{heading}</h2>
        </div>
        <p className="text-sm text-ink-3">{total} resource{total === 1 ? "" : "s"}</p>
      </div>
      <div id="study-material-results-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((material) => <StudyMaterialCard key={material.id} material={material} />)}
      </div>
      <div className="mt-7 flex flex-col items-center gap-3 border-t border-hairline pt-6 text-center">
        <p aria-live="polite" className="text-sm text-ink-3">
          Showing {items.length} of {total} resource{total === 1 ? "" : "s"}
        </p>
        {hasMore && loadMore && !loadMoreError && (
          <button
            type="button"
            aria-controls="study-material-results-grid"
            disabled={loadingMore}
            onClick={loadMore}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-accent-line bg-surface px-5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMore && <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {loadingMore
              ? "Loading more resources..."
              : `Load ${Math.min(STUDY_MATERIAL_PAGE_SIZE, total - items.length)} more resource${total - items.length === 1 ? "" : "s"}`}
          </button>
        )}
        {loadMoreError && (
          <div role="alert" className="text-sm text-danger">
            <p>{loadMoreError}</p>
            <button type="button" onClick={loadMore} className="mt-2 min-h-11 rounded-lg px-4 font-semibold text-accent">
              Try loading more again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function StudyMaterialsPage() {
  const [params, setParams] = useSearchParams();
  // The URL is the state: goal / class / subject / chapter / type are the same
  // keys /browse uses, so a scope carries between the two pages, a filtered
  // view is a link, refresh keeps it and Back walks it backwards. Everything
  // is validated first — see studyMaterialScope.js.
  const scope = readMaterialScope(params);
  const goal = scope.goal ?? "";
  const board = scope.board ?? "";
  const stage = scope.stage ?? "";
  const subject = scope.subject ?? "";
  const chapter = scope.chapter ?? "";
  const chapterId = scope.chapterId ?? "";
  const type = scope.type ?? "";
  const isSchool = goal === "school";

  // A link is allowed to be wrong: a typo, an old bookmark, a /browse scope
  // whose ?type= means something else here. Whatever we refused to act on
  // leaves the address bar too, so the controls and the URL cannot disagree
  // about what is being filtered. Replace, not push — a correction is not a
  // step the student took, and Back must not walk back into the bad URL.
  useEffect(() => {
    const normalized = normalizeMaterialScopeParams(params);
    if (normalized) setParams(normalized, { replace: true });
  }, [params, setParams]);

  const catalog = useStudyMaterialCatalog({
    goal: goal || null,
    board: isSchool ? board || null : null,
    stage: stage || null,
    subject: subject || null,
  });
  const catalogGoals = new Map(catalog.goals.map((item) => [item.slug, item]));
  const shownGoals = FALLBACK_GOALS.map((item) => catalogGoals.get(item.slug) ?? item);

  const materials = useStudyMaterials({
    goal: goal || null,
    board: isSchool ? board || null : null,
    stage: stage || null,
    subject: subject || null,
    chapter: chapter || null,
    chapterId: chapterId ? Number(chapterId) : null,
    type: type || null,
  });
  useStructuredData(studyMaterialsPageSchemas(materials.items), [materials.items]);

  // Push, not replace: each choice is a step the student took, so Back has to
  // undo it. The cascade (which dependent levels a change clears) lives in
  // studyMaterialScope.js so no control here can forget one.
  const update = (key, value) => setParams(applyMaterialScopeChange(params, key, value));

  return (
    <Page crumbs={[{ label: "Study material" }]}>
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface px-5 py-8 sm:px-8 sm:py-10">
        <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
            <FileText aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Learn beyond the video</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Find study material by your syllabus.</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
            Formula sheets, full lecture notes and previous-year papers—organised by exam, class, subject and chapter.
          </p>
        </div>
      </section>

      {/* The curated JEE Main paper landing, surfaced from the directory it
          belongs to instead of being orphaned. A slim banner on purpose: on a
          phone the filters below must stay within reach, not below the fold. */}
      <Link
        to={JEE_MAIN_PAPERS_PATH}
        className="mt-6 flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
      >
        <FileCheck2 aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 basis-52">
          <span className="block text-sm font-semibold text-ink">JEE Main previous-year papers, by year</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
            Official question papers and final answer keys, organised by year, session and shift.
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
          Browse papers
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </span>
      </Link>

      <section aria-label="Filter study material" className="my-8 rounded-xl border border-hairline bg-surface-2 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Filter
            label="Exam"
            value={goal}
            hint={goal ? null : "Start here — the class, subject and chapter lists follow your exam."}
            onChange={(event) => update("goal", event.target.value)}
          >
            <option value="">All exams</option>
            {shownGoals.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </Filter>
          {isSchool && (
            <Filter label="Board" value={board} onChange={(event) => update("board", event.target.value)}>
              <option value="">All boards</option>
              {optionsFor(catalog.boards, board).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Filter>
          )}
          <Filter
            label="Class"
            value={stage}
            disabled={!goal || catalog.loading}
            onChange={(event) => update("class", event.target.value)}
          >
            <option value="">All classes</option>
            {optionsFor(catalog.classes, stage).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
          <Filter
            label="Subject"
            value={subject}
            disabled={!goal || catalog.loading}
            onChange={(event) => update("subject", event.target.value)}
          >
            <option value="">All subjects</option>
            {optionsFor(catalog.subjects, subject).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
          {/* Chapters are listed for the chosen subject and nothing else. The
              list is scoped in useStudyMaterialCatalog.js, not merely hidden
              behind `disabled`, so an unscoped chapter can never reach this
              select — a chapter slug is only unique WITHIN a subject
              (chapters_subject_id_slug_key), so a chapter offered without one
              is not a filter the student can reason about. */}
          <Filter
            label="Chapter"
            value={chapter}
            disabled={!subject || catalog.loading}
            hint={subject ? null : "Choose a subject to see its chapters."}
            onChange={(event) => update("chapter", event.target.value)}
          >
            <option value="">All chapters</option>
            {optionsFor(catalog.chapters, chapter).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
        </div>

        {catalog.error && (
          <p role="alert" className="mt-4 text-sm text-danger">{catalog.error}</p>
        )}

        <fieldset className="mt-5 border-t border-hairline pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Material type</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={!type} onClick={() => update("type", "")} className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${!type ? "border-accent-line bg-accent-soft text-accent" : "border-hairline bg-surface text-ink-2"}`}>All material</button>
            {OFFERED_MATERIAL_TYPES.map((item) => (
              <button key={item.value} type="button" aria-pressed={type === item.value} onClick={() => update("type", type === item.value ? "" : item.value)} className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${type === item.value ? "border-accent-line bg-accent-soft text-accent" : "border-hairline bg-surface text-ink-2"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {chapterId && !chapter && (
        <p className="mb-5 rounded-lg border border-accent-line bg-accent-soft px-4 py-3 text-sm text-accent">
          Showing material linked to the chapter you were watching.
        </p>
      )}
      <StudyMaterialsDirectoryView {...materials} />
    </Page>
  );
}
