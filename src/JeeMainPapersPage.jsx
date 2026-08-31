import { useMemo, useState } from "react";
import { FileCheck2, FileText, ListChecks, RefreshCw, Search, X } from "lucide-react";
import { Page } from "./AppShell.jsx";
import { useStructuredData } from "./PageMetadata.jsx";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { StudyMaterialsDirectoryView } from "./StudyMaterialsPage.jsx";
import { studyMaterialLandingSchemas } from "./studyMaterialsStructuredData.js";
import {
  JEE_MAIN_PAPERS_META,
  JEE_MAIN_PAPERS_PATH,
  splitJeeMainPapers,
} from "./studyMaterialLandings.js";
import { useJeeMainPapers } from "./useJeeMainPapers.js";

export function groupPapersByYear(items) {
  const groups = new Map();
  for (const item of items) {
    const year = Number(item.examYear);
    const label = Number.isFinite(year) ? String(year) : "Year not listed";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return [...groups.entries()].sort(([yearA], [yearB]) => {
    if (yearA === "Year not listed") return 1;
    if (yearB === "Year not listed") return -1;
    return Number(yearB) - Number(yearA);
  });
}

function PapersByYear({
  id,
  eyebrow,
  heading,
  items,
  emptyTitle,
  emptyDescription,
  itemNoun = "paper",
  typeLabel,
}) {
  const yearGroups = groupPapersByYear(items);

  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-heading`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2 id={`${id}-heading`} className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {heading}
      </h2>
      {yearGroups.length ? (
        <div className="mt-6 space-y-10">
          {yearGroups.map(([year, papers]) => (
            <div key={year} aria-labelledby={`${id}-${year}`}>
              <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
                <h3 id={`${id}-${year}`} className="text-xl font-semibold text-ink">{year}</h3>
                <p className="text-sm text-ink-3">
                  {papers.length} {itemNoun}{papers.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {papers.map((paper) => (
                  <StudyMaterialCard
                    key={paper.id}
                    material={typeLabel ? { ...paper, typeLabel } : paper}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-hairline bg-surface p-6">
          <p className="font-semibold text-ink">{emptyTitle}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

export default function JeeMainPapersPage() {
  const papers = useJeeMainPapers();
  const groups = splitJeeMainPapers(papers.items);
  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const years = useMemo(() => [...new Set(
    papers.items
      .map((paper) => Number(paper.examYear))
      .filter(Number.isFinite),
  )].sort((yearA, yearB) => yearB - yearA), [papers.items]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesFilters = (paper) => {
    if (selectedYear && String(paper.examYear) !== selectedYear) return false;
    if (!normalizedQuery) return true;
    return [paper.title, paper.description, paper.sourceName, paper.examYear]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  };
  const filteredQuestionOnly = groups.questionOnly.filter(matchesFilters);
  const filteredAnswerKeys = groups.answerKeys.filter(matchesFilters);
  const filteredWithSolutions = groups.withSolutions.filter(matchesFilters);
  const visibleCount = filteredQuestionOnly.length + filteredAnswerKeys.length + filteredWithSolutions.length;
  const filtersActive = Boolean(selectedYear || normalizedQuery);
  useStructuredData(studyMaterialLandingSchemas(papers.items, {
    label: "JEE Main papers, answer keys and solutions",
    path: JEE_MAIN_PAPERS_PATH,
  }), [papers.items]);

  return (
    <Page crumbs={[
      { label: "Study material", to: "/materials" },
      { label: "JEE Main papers" },
    ]}>
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface px-5 py-8 sm:px-8 sm:py-10">
        <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
            <FileCheck2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">JEE Main · Year-wise resources</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {JEE_MAIN_PAPERS_META.heading}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
            Browse question papers, official answer keys and reviewed worked solutions by year, session and shift.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
            Official answer keys are listed separately from worked solutions. Every card says exactly what the PDF contains and opens the recorded source.
          </p>
          <a
            href="#paper-filters"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-accent-line bg-accent-soft px-4 text-sm font-semibold text-accent"
          >
            Browse JEE Main resources by year
          </a>
        </div>
      </section>

      <nav aria-label="JEE Main resource collections" className="my-8 grid gap-4 sm:grid-cols-3">
        <a href="#question-papers" className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-accent-line">
          <FileText aria-hidden="true" className="h-5 w-5 text-accent" />
          <p className="mt-4 text-lg font-semibold text-ink">Question papers only</p>
          <p className="mt-1 text-sm text-ink-3">
            {papers.loading ? "Loading reviewed papers…" : `${groups.questionOnly.length} reviewed paper${groups.questionOnly.length === 1 ? "" : "s"}`}
          </p>
        </a>
        <a href="#official-answer-keys" className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-accent-line">
          <FileCheck2 aria-hidden="true" className="h-5 w-5 text-accent" />
          <p className="mt-4 text-lg font-semibold text-ink">Official answer keys</p>
          <p className="mt-1 text-sm text-ink-3">
            {papers.loading ? "Checking official answer keys…" : `${groups.answerKeys.length} official answer key${groups.answerKeys.length === 1 ? "" : "s"}`}
          </p>
        </a>
        <a href="#papers-with-solutions" className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-accent-line">
          <ListChecks aria-hidden="true" className="h-5 w-5 text-accent" />
          <p className="mt-4 text-lg font-semibold text-ink">Papers with solutions</p>
          <p className="mt-1 text-sm text-ink-3">
            {papers.loading ? "Checking reviewed solutions…" : `${groups.withSolutions.length} reviewed paper${groups.withSolutions.length === 1 ? "" : "s"}`}
          </p>
        </a>
      </nav>

      {!papers.loading && !papers.error && (
        <section id="paper-filters" aria-labelledby="paper-filters-heading" className="my-8 scroll-mt-24 rounded-xl border border-hairline bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Find a resource</p>
              <h2 id="paper-filters-heading" className="mt-1 text-xl font-semibold text-ink">Search by year, session, shift or resource type</h2>
            </div>
            <p className="text-sm text-ink-3" aria-live="polite">
              Showing {visibleCount} of {papers.items.length} resources
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Resource search</span>
              <span className="flex min-h-11 items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 focus-within:border-accent-line">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Example: 2025 Session 1 answer key"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-3"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Year</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-hairline bg-canvas px-3 text-sm text-ink outline-none focus:border-accent-line"
              >
                <option value="">All years</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <button
              type="button"
              disabled={!filtersActive}
              onClick={() => {
                setQuery("");
                setSelectedYear("");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg border border-hairline bg-canvas px-4 text-sm font-semibold text-ink disabled:cursor-default disabled:opacity-40"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Clear
            </button>
          </div>
        </section>
      )}

      {(papers.loading || papers.error) && (
        <div className="my-8">
          <StudyMaterialsDirectoryView
            {...papers}
            eyebrow="Official paper directory"
            heading="JEE Main papers"
          />
        </div>
      )}

      {!papers.loading && !papers.error && (
        <div className="my-8 space-y-12">
          <PapersByYear
            id="question-papers"
            items={filteredQuestionOnly}
            eyebrow="Questions only · Newest year first"
            heading="JEE Main question papers"
            emptyTitle={filtersActive ? "No question papers match these filters" : "No question-only papers are listed yet"}
            emptyDescription={filtersActive ? "Try another year, session or shift." : "Only reviewed official papers appear here."}
          />
          <PapersByYear
            id="official-answer-keys"
            items={filteredAnswerKeys}
            eyebrow="Official result-stage keys · Newest year first"
            heading="JEE Main official answer keys"
            itemNoun="answer key"
            typeLabel="Official answer key"
            emptyTitle={filtersActive ? "No official answer keys match these filters" : "No official answer keys are listed yet"}
            emptyDescription={filtersActive ? "Try another year, session or search term." : "Only result-stage answer keys published by NTA or CBSE appear here; challenge-stage provisional drafts are excluded."}
          />
          <PapersByYear
            id="papers-with-solutions"
            items={filteredWithSolutions}
            eyebrow="Questions and worked answers · Newest year first"
            heading="JEE Main papers with solutions"
            typeLabel="Paper with worked solutions"
            emptyTitle={filtersActive ? "No solved papers match these filters" : "No reviewed papers with worked solutions yet"}
            emptyDescription={filtersActive ? "Try another year, session or shift." : "Official answer keys are not labelled as worked solutions. This section will fill only when a paper includes explained answers and redistribution rights have been checked."}
          />
        </div>
      )}

      {papers.hasMore && !papers.loading && !papers.error && (
        <div className="mb-8 flex justify-center border-t border-hairline pt-6">
          <button
            type="button"
            disabled={papers.loadingMore}
            onClick={papers.loadMore}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent-line bg-surface px-5 text-sm font-semibold text-accent disabled:cursor-wait disabled:opacity-60"
          >
            {papers.loadingMore && <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {papers.loadingMore ? "Loading more papers…" : "Load more papers"}
          </button>
        </div>
      )}
    </Page>
  );
}
