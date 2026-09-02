// SearchStarters.jsx — what the search box offers BEFORE anything is typed.
//
// One renderer, two hosts: /search (UniversalSearch's standalone empty state)
// and the homepage hero's empty state. Written once on purpose — a homepage
// copy of "the same chips, slightly different" is exactly how this codebase
// ended up with three search-result renderers that disagreed with each other.
//
// It shows ONE of two things, never both:
//
//   * the searches this device remembers, most recent first, with a way to
//     forget them (searchHistory.js — device-local, never sent anywhere); or
//   * a short curated list, only while there is no history yet, so a
//     first-time student can see what the box actually understands.
//
// Hide-when-empty, not placeholders: with no history the recent heading and
// the Clear button do not render at all, rather than sitting there empty.
//
// The chips are the student's own words coming back, so a remembered
// Devanagari query carries lang="hi" via langAttrs — spread onto the button
// that already exists, which for a Latin query adds nothing at all.

import { useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { useTheme } from "./theme.jsx";
import { langAttrs } from "./lang.js";
import {
  STARTER_QUERIES,
  clearRecentSearches,
  getRecentSearches,
} from "./searchHistory.js";

/**
 * @param {(query: string) => void} onPick  Run this query. The host owns the
 *        input, so it decides what "run" means — /search writes it into its
 *        own field (which mirrors it to ?q=), the hero writes it into its.
 * @param {string} [className]  Spacing supplied by the host, because the two
 *        hosts sit in very different layouts.
 */
export default function SearchStarters({ onPick, className = "" }) {
  const { t } = useTheme();
  // Read once on mount. Both hosts unmount this the moment a query exists and
  // mount it again when the box is cleared, so there is no stale list to
  // refresh — and re-reading localStorage on every render would be work for
  // nothing.
  const [recent, setRecent] = useState(() => getRecentSearches());

  const hasRecent = recent.length > 0;
  const queries = hasRecent ? recent : STARTER_QUERIES;
  const Icon = hasRecent ? Clock : Search;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 text-xs ${t.muted}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {hasRecent ? "Recent searches" : "Try one of these"}
        </p>
        {hasRecent && (
          <button
            type="button"
            onClick={() => setRecent(clearRecentSearches())}
            aria-label="Clear recent searches"
            className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs ${t.muted} ${t.hover}`}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {queries.map((query) => (
          <button
            key={query}
            type="button"
            {...langAttrs(query)}
            onClick={() => onPick(query)}
            className={`min-h-11 rounded-full border px-4 text-sm ${t.border} ${t.text} ${t.hover}`}
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
