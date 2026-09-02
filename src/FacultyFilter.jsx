// FacultyFilter.jsx — "Taught by" filter, with counts from the database and
// the selection persisted in the URL (?teacher=<id>), so a filtered view is
// shareable and survives a refresh.
//
// No alias logic here: options come from get_faculty_facets(), suggestions from
// search_teachers(). See useFaculty.js.
//
// A selected chip uses the accent-soft token pair — the same "on" treatment as
// AppShell's active nav item and the forum topic chips. It used to be a literal
// slate-800 pill, which in the dark default sat almost exactly on the surface
// colour, so "selected" was invisible; the count inside it was recoloured by
// the index.css bridge to --ink-3 and fell to ~2.6:1 against that pill.

import { useEffect, useState } from "react";
import { Search, X, BadgeCheck } from "lucide-react";
import { useFacultyFacets, useTeacherSearch } from "./useFaculty.js";
import { useDebouncedValue } from "./useBrowse.js";
import { useTheme } from "./theme.jsx";

// Read/write the teacher selection on a URLSearchParams pair.
export function readTeacherFilter(params) {
  const raw = params.get("teacher");
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

export function FacultyFilter({ params, setParams, scope = {}, onAvailabilityChange = null }) {
  const { t, dark } = useTheme();
  const { facets, loading, error, unavailable } = useFacultyFacets(scope);
  const selected = readTeacherFilter(params);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const { results: suggestions, loading: searching } = useTeacherSearch(debounced);
  const inScope = new Set(facets.map((f) => Number(f.teacher_id)));
  const scopedSuggestions = suggestions.filter((s) => inScope.has(Number(s.teacher_id)));

  useEffect(() => {
    onAvailabilityChange?.(
      loading ? "loading" : unavailable ? "unavailable" : error ? "error" : "available",
    );
  }, [loading, unavailable, error, onAvailabilityChange]);

  const choose = (teacherId) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (teacherId == null || teacherId === selected) next.delete("teacher");
      else next.set("teacher", String(teacherId));
      // Changing the faculty filter re-scopes the result set, so any page
      // offset from before is meaningless — dropping it is the rule every
      // other filter already follows (filterChips.js, PlaylistBrowse.jsx:317).
      // Without it, choosing a teacher from page 2+ keeps ?page=2, the scoped
      // query requests an out-of-range row window, and a teacher who has
      // courses renders the false "No courses match this view" empty state.
      next.delete("page");
      return next;
    });
    setQuery("");
  };

  // Feature-gate: if the faculty tables are not deployed, show nothing at all.
  if (unavailable) return null;

  // A failed facet query must not look like "no faculty here".
  if (error) {
    return <p className={`mt-3 text-sm ${t.muted}`}>{error}</p>;
  }
  if (loading) {
    // The resolved unscoped filter can wrap to several chip rows on a phone.
    // Reserving only one 32px bar moved the entire course grid by ~210px when
    // the facets arrived (CLS 0.132 in the mobile Lighthouse trace). A
    // mid-height placeholder bounds the shift in both directions: a large
    // filter grows far less, while a sparse/empty scope never collapses from a
    // full multi-row skeleton.
    return (
      <div
        aria-label="Loading faculty filters"
        className={`mt-3 h-32 w-full max-w-xl animate-pulse rounded-lg ${t.input}`}
      />
    );
  }
  if (facets.length === 0 && !selected) return null;

  const selectedFacet = facets.find((f) => Number(f.teacher_id) === selected);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-medium ${t.muted}`}>Taught by</span>

        {facets.slice(0, 6).map((f) => {
          const active = Number(f.teacher_id) === selected;
          return (
            <button
              key={f.teacher_id}
              onClick={() => choose(f.teacher_id)}
              aria-pressed={active}
              className={`flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs transition ${
                active
                  ? "border-accent-line bg-accent-soft font-medium text-accent"
                  : `${t.border} ${t.card} ${t.faint} ${t.cardHover}`
              }`}
            >
              {f.verified && <BadgeCheck className="h-3 w-3" aria-label="Verified" />}
              {f.display_name}
              <span className={active ? "text-accent" : t.muted}>({f.course_count})</span>
            </button>
          );
        })}

        {/* A teacher chosen from search may not be among the top facets. This
            chip is always the selected one, so it carries the same accent
            "on" treatment as an active facet chip above. */}
        {selected && !facets.slice(0, 6).some((f) => Number(f.teacher_id) === selected) && (
          <button
            onClick={() => choose(selected)}
            className="flex min-h-11 items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-3 text-xs font-medium text-accent"
          >
            {selectedFacet?.display_name ?? `Teacher #${selected}`}
            <X className="h-3 w-3" />
          </button>
        )}

        {selected && (
          <button onClick={() => choose(null)} className={`min-h-11 px-2 text-xs ${t.muted} underline`}>
            Clear
          </button>
        )}
      </div>

      {facets.length > 6 && (
        <div className="relative mt-2 max-w-xs">
          <Search className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search faculty — name, initials, alias"
            aria-label="Search faculty"
            className={`min-h-11 w-full rounded-lg border ${t.border} ${t.input} ${t.text} pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-teal-500`}
          />
          {debounced.trim() && (
            <ul className={`absolute z-20 mt-1 w-full overflow-hidden rounded-lg border ${t.border} ${t.card} shadow-sm`}>
              {searching && <li className={`px-3 py-2 text-xs ${t.muted}`}>Searching…</li>}
              {!searching && scopedSuggestions.length === 0 && (
                <li className={`px-3 py-2 text-xs ${t.muted}`}>No faculty match “{debounced.trim()}”.</li>
              )}
              {scopedSuggestions.some((s) => s.is_ambiguous) && (
                <li className={`${dark ? "bg-amber-950/40 text-amber-100" : "bg-amber-50 text-amber-900"} px-3 py-2 text-xs`}>
                  Several faculty match equally. Use institute and subject to choose.
                </li>
              )}
              {scopedSuggestions.map((s) => (
                <li key={s.teacher_id}>
                  <button
                    onClick={() => choose(s.teacher_id)}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${t.hover}`}
                  >
                    <span className="flex items-center gap-1">
                      {s.verified && <BadgeCheck className={`h-3 w-3 ${t.muted}`} />}
                      {s.display_name}
                      {/* why it matched, e.g. matched on the alias "ABJ Sir" */}
                      {s.matched_on && s.matched_on !== s.display_name && (
                        <span className={t.muted}>· {s.matched_on}</span>
                      )}
                      {(s.institutes || s.subjects) && (
                        <span className={`block text-[11px] ${t.muted}`}>
                          {[s.institutes, s.subjects].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className={t.muted}>{s.course_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default FacultyFilter;
