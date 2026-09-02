// TeacherPicker.jsx — ambiguity-safe admin faculty selection.
//
// It never resolves names in JavaScript and never chooses the first match.
// The database returns all candidates plus context; a curator explicitly
// selects the correct person. Creating or merging identities is intentionally
// outside this picker and remains part of the reviewed proposal workflow.

import { useEffect, useState } from "react";
import { BadgeCheck, Search, UserRound, X } from "lucide-react";
import { useAdminTeacherSearch, useFacultyImportCapability } from "./useFaculty.js";
import { useDebouncedValue } from "./useBrowse.js";

function Context({ row }) {
  const parts = [row.institutes, row.subjects, row.goals].filter(Boolean);
  return parts.length ? (
    <span className="mt-0.5 block text-xs text-ink-2">{parts.join(" · ")}</span>
  ) : (
    <span className="mt-0.5 block text-xs text-ink-3">No context recorded yet</span>
  );
}

export default function TeacherPicker({
  value = [], onChange, label = "Faculty",
  replace = true, onReplaceChange = null,
  onCapabilityChange = null,
}) {
  const capability = useFacultyImportCapability();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const searchEnabled = capability.supported && (onReplaceChange == null || replace);
  const search = useAdminTeacherSearch(debounced, 10, searchEnabled);

  useEffect(() => {
    onCapabilityChange?.(capability.supported);
  }, [capability.supported, onCapabilityChange]);

  const add = (row) => {
    if (value.some((item) => Number(item.teacher_id) === Number(row.teacher_id))) return;
    onChange([...value, row]);
    setQuery("");
  };
  const remove = (teacherId) =>
    onChange(value.filter((item) => Number(item.teacher_id) !== Number(teacherId)));

  if (capability.loading) {
    return <div className="h-20 animate-pulse rounded-xl bg-surface-2" aria-label="Checking faculty support" />;
  }

  if (capability.unavailable) {
    return (
      <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-2 p-3">
        <p className="text-xs font-medium text-ink">Faculty registry not installed yet</p>
        <p className="mt-1 text-xs text-ink-2">
          The legacy teacher field remains available. No identity will be guessed from that text.
        </p>
      </div>
    );
  }

  if (capability.error) {
    return (
      // Amber stays literal: the palette has no warning token, and fg + bg are
      // set together here, so the notice reads the same in both themes.
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p>{capability.error}</p>
        <button type="button" onClick={capability.retry} className="mt-2 min-h-11 font-medium underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <fieldset className="rounded-xl border border-hairline p-4">
      <legend className="px-1 text-sm font-medium text-ink">{label}</legend>

      {onReplaceChange && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => onReplaceChange(e.target.checked)}
            className="h-4 w-4"
          />
          Replace linked faculty during this import
        </label>
      )}

      {onReplaceChange && !replace ? (
        <p className="text-xs text-ink-2">Existing faculty links will be preserved.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-2">
            Choose records explicitly. An empty selection clears links only when replacement is enabled.
          </p>

          {value.length > 0 && (
            <ol className="mb-3 space-y-2" aria-label="Selected faculty in teaching order">
              {value.map((row, index) => (
                <li key={row.teacher_id} className="flex min-h-11 items-center gap-3 rounded-lg bg-surface-2 px-3">
                  <span className="text-xs font-medium text-ink-3">{index + 1}</span>
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    {row.display_name}
                    {index > 0 && <span className="ml-2 text-xs text-ink-3">Co-instructor</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(row.teacher_id)}
                    aria-label={`Remove ${row.display_name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, initials or alias"
              aria-label="Search faculty registry"
              className="min-h-11 w-full rounded-xl border border-hairline bg-surface-2 text-ink pl-9 pr-3 text-sm outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-line"
            />
          </div>

          {debounced.trim().length >= 2 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-hairline">
              {search.loading && <p className="p-3 text-xs text-ink-2">Searching faculty…</p>}
              {search.error && <p className="p-3 text-xs text-danger">{search.error}</p>}
              {!search.loading && !search.error && search.results.length === 0 && (
                <p className="p-3 text-xs text-ink-2">
                  No registry match. Keep the legacy name for proposal review; do not create an identity from a guess.
                </p>
              )}
              {search.results.some((row) => row.is_ambiguous) && (
                // Amber pair again — deliberately theme-independent, see above.
                <p className="border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Several faculty match equally. Check institute and subject before choosing.
                </p>
              )}
              {search.results.map((row) => {
                const selected = value.some((item) => Number(item.teacher_id) === Number(row.teacher_id));
                return (
                  <button
                    key={row.teacher_id}
                    type="button"
                    onClick={() => add(row)}
                    disabled={selected}
                    className="flex min-h-14 w-full items-start gap-3 border-b border-hairline px-3 py-2 text-left last:border-b-0 hover:bg-surface-2 disabled:opacity-50"
                  >
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {row.display_name}
                        {row.verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Verified" />}
                      </span>
                      {row.matched_on && row.matched_on !== row.display_name && (
                        <span className="block text-xs text-ink-2">
                          Matched “{row.matched_on}”{row.alias_status === "proposed" ? " · unverified alias" : ""}
                        </span>
                      )}
                      <Context row={row} />
                    </span>
                    <span className="text-xs text-ink-3">{row.course_count ?? 0} courses</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
