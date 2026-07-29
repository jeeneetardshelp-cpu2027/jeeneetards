// NotFound.jsx — the honest 404.
//
// Unknown URLs used to silently redirect to Home, which (a) told a student
// nothing about why their shared link "worked" but showed the homepage, and
// (b) made every mistyped URL look like a real 200 page to crawlers (a
// "soft 404"). This page says what happened and offers the real ways back
// in. Its metadata (noindex, nofollow) comes from pageMetadata.js's
// unmatched-route fallback.

import { Link } from "react-router";
import { Page } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";

export default function NotFound() {
  const { t } = useTheme();

  return (
    <Page crumbs={[{ label: "Page not found" }]} width="reading">
      <div className={`rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
        <h1 className={`text-xl font-semibold ${t.text}`}>Page not found</h1>
        <p className={`mx-auto mt-2 max-w-xl text-sm ${t.muted}`}>
          This link doesn't match anything in the library. The course may have
          moved, or the address has a typo.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/explore"
            className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover} inline-flex items-center justify-center`}
          >
            Find a course
          </Link>
          <Link
            to="/browse"
            className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover} inline-flex items-center justify-center`}
          >
            Browse courses
          </Link>
          <Link
            to="/search"
            className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover} inline-flex items-center justify-center`}
          >
            Search the library
          </Link>
        </div>
      </div>
    </Page>
  );
}
