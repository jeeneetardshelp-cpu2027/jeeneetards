// FacultyDirectory.jsx — /faculty
//
// A public, crawlable directory over the reviewed faculty registry. The
// database remains the source of truth for identity, aliases, scope and course
// counts; this screen never guesses that two similar names are the same person.

import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowRight, BadgeCheck, BookOpen, Search, SlidersHorizontal, X,
} from "lucide-react";
import { GlobalHeader, Container } from "./AppShell.jsx";
import {
  useFacultyDirectoryOptions,
  useFacultyFacets,
  useTeacherSearch,
} from "./useFaculty.js";
import { useDebouncedValue } from "./useBrowse.js";
import { useStructuredData } from "./PageMetadata.jsx";
import { breadcrumbListSchema, itemListSchema } from "./structuredData.js";
import { Button, EmptyState, ErrorState, Pill, Skeleton, Surface } from "./ui.jsx";

function updateQuery(setParams, key, value) {
  setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });
}

function FacultyCard({ faculty }) {
  const courseCount = Number(faculty.course_count ?? 0);
  return (
    <Surface as="li" lift padded={false} className="group overflow-hidden">
      <Link
        to={`/faculty/${faculty.slug}`}
        className="flex min-h-40 h-full flex-col p-5 outline-none transition-colors hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent sm:p-6"
        aria-label={`View ${faculty.display_name} faculty profile`}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-soft text-base font-semibold text-accent"
          >
            {faculty.display_name?.trim()?.[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="text-base font-semibold leading-snug text-ink">
                {faculty.display_name}
              </h2>
              {faculty.verified && (
                <BadgeCheck
                  aria-label="Verified faculty"
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                />
              )}
            </div>
            {faculty.institutes && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-3">
                {faculty.institutes}
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
            {courseCount} linked course{courseCount === 1 ? "" : "s"}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent"
          />
        </div>
      </Link>
    </Surface>
  );
}

function DirectorySkeleton() {
  return (
    <div aria-label="Loading faculty directory" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-hairline bg-surface p-6">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 shrink-0" rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="mt-8 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function FacultyDirectory() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const goalSlug = params.get("goal") ?? "";
  const subjectSlug = params.get("subject") ?? "";
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const options = useFacultyDirectoryOptions();
  const goal = options.goals.find((item) => item.slug === goalSlug) ?? null;
  const subject = options.subjects.find((item) => item.slug === subjectSlug) ?? null;
  const directory = useFacultyFacets({
    goalId: goal?.id ?? null,
    subjectId: subject?.id ?? null,
    enabled: !options.loading && !options.error,
  });
  const shouldSearch = debouncedQuery.length >= 2;
  const facultySearch = useTeacherSearch(shouldSearch ? debouncedQuery : "", 50);

  const visibleFaculty = useMemo(() => {
    const facets = directory.facets ?? [];
    const normalized = debouncedQuery.toLocaleLowerCase("en-IN");
    if (!normalized) return facets;

    if (!shouldSearch || facultySearch.loading) {
      return facets.filter((item) =>
        `${item.display_name ?? ""} ${item.institutes ?? ""}`
          .toLocaleLowerCase("en-IN")
          .includes(normalized));
    }

    const byId = new Map(facets.map((item) => [Number(item.teacher_id), item]));
    return (facultySearch.results ?? [])
      .map((result) => {
        const scoped = byId.get(Number(result.teacher_id));
        return scoped ? { ...result, ...scoped } : null;
      })
      .filter(Boolean);
  }, [debouncedQuery, directory.facets, facultySearch.loading, facultySearch.results, shouldSearch]);

  const hasFilters = Boolean(query || goalSlug || subjectSlug);
  const resultLabel = `${visibleFaculty.length} facult${visibleFaculty.length === 1 ? "y member" : "y members"}`;
  const schemaRows = visibleFaculty.map((item, index) => ({
    title: item.display_name,
    url: `/faculty/${item.slug}`,
    position: index + 1,
  }));
  useStructuredData([
    breadcrumbListSchema([
      { label: "Home", url: "/" },
      { label: "Faculty", url: "/faculty" },
    ]),
    itemListSchema(schemaRows),
  ], [visibleFaculty.map((item) =>
    `${item.teacher_id}:${item.slug}:${item.display_name}:${item.course_count}`
  ).join("|")]);

  const clearFilters = () => setParams({}, { replace: true });
  const loading = options.loading || directory.loading || (shouldSearch && facultySearch.loading);
  const error = options.error ?? directory.error ?? (shouldSearch ? facultySearch.error : null);
  const retry = options.error
    ? options.retry
    : directory.error
      ? directory.retry
      : facultySearch.retry;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader crumbs={[{ label: "Faculty" }]} />

      <main id="main-content" className="pb-20 pt-10 sm:pt-14">
        <Container>
          <div className="max-w-3xl">
            <Pill tone="accent">Reviewed faculty registry</Pill>
            <h1 className="mt-5 text-display-lg text-ink">Find courses by faculty</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
              Search verified names and aliases, or narrow the directory by exam and
              subject. Every profile links to the free courses currently connected to
              that faculty record.
            </p>
          </div>

          <Surface as="section" aria-labelledby="faculty-filters" className="mt-10" padded={false}>
            <div className="flex items-center gap-2 border-b border-hairline px-5 py-4 sm:px-6">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-accent" />
              <h2 id="faculty-filters" className="text-sm font-semibold text-ink">Search and filters</h2>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_auto] lg:items-end">
              <label className="block sm:col-span-2 lg:col-span-1">
                <span className="text-xs font-medium text-ink-2">Faculty name or alias</span>
                <span className="relative mt-2 block">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => updateQuery(setParams, "q", event.target.value)}
                    placeholder="Try ABJ Sir or Mohit Tyagi"
                    className="min-h-11 w-full rounded-md border border-hairline-strong bg-surface-2 pl-10 pr-10 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => updateQuery(setParams, "q", "")}
                      aria-label="Clear faculty search"
                      className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-ink-2">Exam</span>
                <select
                  value={goal?.slug ?? ""}
                  disabled={options.loading}
                  onChange={(event) => updateQuery(setParams, "goal", event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-hairline-strong bg-surface-2 px-3 text-sm text-ink outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft disabled:opacity-50"
                >
                  <option value="">All exams</option>
                  {options.goals.map((item) => (
                    <option key={item.id} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-ink-2">Subject</span>
                <select
                  value={subject?.slug ?? ""}
                  disabled={options.loading}
                  onChange={(event) => updateQuery(setParams, "subject", event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-hairline-strong bg-surface-2 px-3 text-sm text-ink outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft disabled:opacity-50"
                >
                  <option value="">All subjects</option>
                  {options.subjects.map((item) => (
                    <option key={item.id} value={item.slug}>{item.name}</option>
                  ))}
                </select>
              </label>

              <Button
                variant="secondary"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full lg:w-auto"
              >
                Clear
              </Button>
            </div>
          </Surface>

          <div className="mt-10 flex items-center justify-between gap-4">
            <div>
              <p aria-live="polite" className="text-sm font-semibold text-ink">
                {loading ? "Loading faculty…" : resultLabel}
              </p>
              {goal || subject ? (
                <p className="mt-1 text-xs text-ink-3">
                  Showing linked courses for {[goal?.name, subject?.name].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <section aria-label="Faculty results" className="mt-5" aria-busy={loading}>
            {error ? (
              <ErrorState
                title="Faculty directory unavailable"
                detail={error}
                onRetry={retry}
              />
            ) : loading ? (
              <DirectorySkeleton />
            ) : visibleFaculty.length === 0 ? (
              <EmptyState
                title="No faculty match this view"
                detail="Try a different name, alias, exam or subject."
                action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : null}
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleFaculty.map((faculty) => (
                  <FacultyCard key={faculty.teacher_id} faculty={faculty} />
                ))}
              </ul>
            )}
          </section>

          <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ink-3">
            Faculty identity and aliases are reviewed before publication. Course counts
            reflect the courses currently linked in the JEENEETARD catalogue; they are
            not a claim about a teacher&apos;s complete work elsewhere.
          </p>
        </Container>
      </main>
    </div>
  );
}
