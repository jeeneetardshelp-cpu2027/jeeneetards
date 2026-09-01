// SearchPage.jsx — the /search route: global header + the search itself.
//
// Kept separate from UniversalSearch.jsx so the search can also be dropped
// into a header overlay later without dragging a page shell with it.

import { GlobalHeader, Container, MAIN_CONTENT_ID } from "./AppShell.jsx";
import UniversalSearch from "./UniversalSearch.jsx";
import { useTheme } from "./theme.jsx";

export default function SearchPage() {
  const { t } = useTheme();
  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Search" }]} />
      <main id={MAIN_CONTENT_ID} className="py-6 sm:py-10">
        <Container width="reading">
          <h1 className={`mb-4 text-center text-xl font-semibold ${t.text}`}>
            Search the library
          </h1>
          <UniversalSearch />
        </Container>
      </main>
    </div>
  );
}
