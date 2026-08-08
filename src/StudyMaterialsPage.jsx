import { BookOpen, FileText, RefreshCw, SearchX } from "lucide-react";
import { useSearchParams } from "react-router";
import { Page } from "./AppShell.jsx";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { useStudyMaterialCatalog } from "./useStudyMaterialCatalog.js";
import {
  STUDY_MATERIAL_PAGE_SIZE,
  STUDY_MATERIAL_TYPES,
  useStudyMaterials,
} from "./useStudyMaterials.js";

const FALLBACK_GOALS = [
  { slug: "jee", name: "JEE" },
  { slug: "neet", name: "NEET" },
  { slug: "school", name: "School / CBSE" },
  { slug: "olympiad", name: "Olympiad" },
];

const SELECT_CLASS = "min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-accent-line";

function Filter({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <select className={SELECT_CLASS} value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}

export function StudyMaterialsDirectoryView({
  items = [], total = 0, loading = false, loadingMore = false,
  error = null, loadMoreError = null, unavailable = false,
  hasMore = false, loadMore = null, retry = null,
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
        <h2 className="mt-4 text-lg font-semibold text-ink">No reviewed material for these filters yet</h2>
        <p className="mt-2 text-sm text-ink-2">Try a broader exam, subject or material type.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="material-results-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Reviewed resources</p>
          <h2 id="material-results-heading" className="mt-1 text-2xl font-semibold text-ink">Study material</h2>
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
  const goal = params.get("goal") ?? "";
  const board = params.get("board") ?? "";
  const stage = params.get("class") ?? "";
  const subject = params.get("subject") ?? "";
  const chapter = params.get("chapter") ?? "";
  const chapterId = params.get("chapterId") ?? "";
  const type = params.get("type") ?? "";
  const isSchool = goal === "school";

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

  const update = (key, value, clear = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    clear.forEach((name) => next.delete(name));
    setParams(next, { replace: true });
  };

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
            Short notes, formula sheets, full lecture notes and previous-year papers—organised by exam, class, subject and chapter.
          </p>
        </div>
      </section>

      <section aria-label="Filter study material" className="my-8 rounded-xl border border-hairline bg-surface-2 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Filter label="Exam" value={goal} onChange={(event) => update("goal", event.target.value, ["board", "class", "subject", "chapter", "chapterId"])}>
            <option value="">All exams</option>
            {shownGoals.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </Filter>
          {isSchool && (
            <Filter label="Board" value={board} onChange={(event) => update("board", event.target.value, ["class", "subject", "chapter", "chapterId"])}>
              <option value="">All boards</option>
              {catalog.boards.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </Filter>
          )}
          <Filter label="Class" value={stage} disabled={!goal || catalog.loading} onChange={(event) => update("class", event.target.value, ["subject", "chapter", "chapterId"])}>
            <option value="">All classes</option>
            {catalog.classes.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
          <Filter label="Subject" value={subject} disabled={!goal || catalog.loading} onChange={(event) => update("subject", event.target.value, ["chapter", "chapterId"])}>
            <option value="">All subjects</option>
            {catalog.subjects.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
          <Filter label="Chapter" value={chapter} disabled={!subject || catalog.loading} onChange={(event) => update("chapter", event.target.value, ["chapterId"])}>
            <option value="">All chapters</option>
            {catalog.chapters.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </Filter>
        </div>

        {catalog.error && (
          <p role="alert" className="mt-4 text-sm text-danger">{catalog.error}</p>
        )}

        <fieldset className="mt-5 border-t border-hairline pt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Material type</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={!type} onClick={() => update("type", "")} className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${!type ? "border-accent-line bg-accent-soft text-accent" : "border-hairline bg-surface text-ink-2"}`}>All material</button>
            {STUDY_MATERIAL_TYPES.map((item) => (
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
