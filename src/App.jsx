// =====================================================================
//  App.jsx  —  routing + the site-wide theme wrapper
//
//  The screens themselves live in your original files. This file only
//  decides WHICH screen shows for WHICH url, and hands each one the
//  props it already expected.
//
//  Routes (all addressed by real Supabase ids):
//    /                                        -> Home / browse
//    /chapter/:chapterId                      -> redirect to /browse?ch=
//    /course/:playlistId/chapter/:chapterId   -> Video View
//    /terms                                   -> Terms & Disclaimer
//    /privacy                                 -> Privacy Policy
// =====================================================================

import { lazy, Suspense, useEffect } from "react";
import {
  Routes, Route, Outlet, Navigate,
  useNavigate, useParams, useLocation, useNavigationType,
} from "react-router-dom";

import { ThemeProvider, useTheme } from "./theme.jsx";
import Home from "./Home.jsx";
import Footer from "./Footer.jsx";
import LegalPage from "./LegalPage.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import FeatureUnavailable from "./FeatureUnavailable.jsx";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";

const Explore = lazy(() => import("./Explore.jsx"));
const FacultyProfile = lazy(() => import("./FacultyProfile.jsx"));
const Compare = lazy(() => import("./Compare.jsx"));
const SearchPage = lazy(() => import("./SearchPage.jsx"));
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const AdminPanel = lazy(() => import("./AdminPanel.jsx"));
const CourseVideoPage = lazy(() => import("./CourseVideoPage.jsx"));

// ---------------------------------------------------------------------
//  Footer bridge
//  Footer.jsx speaks in page names — onNavigate("dashboard") — because it
//  predates the router. We translate those names into real urls here, so
//  Footer.jsx itself needs no changes.
// ---------------------------------------------------------------------
function SiteFooter() {
  const navigate = useNavigate();
  const go = (page) => {
    if (page === "legal") navigate("/terms");
    else if (page === "privacy") navigate("/privacy");
    else navigate("/");
  };
  return <Footer onNavigate={go} />;
}

function RouteFallback() {
  const { t } = useTheme();
  return (
    <main role="status" aria-label="Loading page" className={`min-h-[60vh] ${t.page} p-6`}>
      <div className="mx-auto w-full max-w-5xl animate-pulse">
        <div className={`h-5 w-40 rounded ${t.input}`} />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`h-48 rounded-2xl border ${t.border} ${t.card}`} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Deferred({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

// Every route change starts at the top of the page, not halfway down.
function ScrollToTop() {
  // Named for continuity, but it no longer just jumps to the top. A student who
  // scrolls the catalogue, opens a course and presses Back must land where they
  // were; the previous version scrolled to 0 on EVERY navigation, which is what
  // made scroll restoration fail the audit.
  // Keyed by path+query, not the router key: a full page reload mints a new
  // router key, so a key-based entry would never be found after one.
  const { pathname, search } = useLocation();
  const key = pathname + search;
  const navType = useNavigationType();

  // Remember where this entry was when we leave it.
  useEffect(() => {
    const save = () => {
      try { sessionStorage.setItem('scroll:' + key, String(window.scrollY)); } catch {}
    };
    // pagehide covers a real unload (link to another document, reload, tab
    // close). The cleanup below covers SPA route changes. Without the former,
    // nothing is ever saved when the document is destroyed.
    window.addEventListener('pagehide', save);
    return () => { window.removeEventListener('pagehide', save); save(); };
  }, [key]);

  useEffect(() => {
    let saved = NaN;
    try { saved = Number(sessionStorage.getItem('scroll:' + key)); } catch {}

    // A saved position is restored on POP (Back/Forward). After a full document
    // reload the FIRST navigation is not reported as POP, so gating on navType
    // alone silently scrolled such visits to 0 — that was the reload bug. What
    // actually matters is "is there a saved position for exactly this URL?"
    const hasSaved = Number.isFinite(saved) && saved > 0;
    const isReloadEntry =
      typeof performance !== 'undefined' &&
      performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload';

    if (!hasSaved || !(navType === 'POP' || isReloadEntry)) {
      window.scrollTo(0, 0);
      return;
    }

    // WAIT FOR HEIGHT, DON'T GUESS AT A DELAY. The old version retried on a
    // fixed 12x60ms timer: too short for a cold reload (bundle parse + query)
    // and pointless work when the content was already there. Results arrive
    // asynchronously, so we watch the document until it is actually tall
    // enough to hold the offset, then restore once.
    let done = false;
    const target = saved;
    const tall = () =>
      document.documentElement.scrollHeight >= target + window.innerHeight;

    const tryRestore = () => {
      if (done) return false;
      if (!tall()) return false;
      window.scrollTo(0, target);
      done = true;
      return true;
    };

    if (tryRestore()) return;

    // ResizeObserver fires as the result cards mount and the page grows —
    // event-driven, so it costs nothing while waiting and fires the instant
    // the height is sufficient.
    const ro = new ResizeObserver(() => { if (tryRestore()) cleanup(); });
    ro.observe(document.documentElement);

    // A cap so a page that never grows tall enough (genuinely short results)
    // does not observe forever. This bounds the WAIT, it does not schedule the
    // restore — the restore still happens the moment the height allows.
    const giveUp = setTimeout(() => {
      if (!done) { window.scrollTo(0, Math.min(target, document.documentElement.scrollHeight)); }
      cleanup();
    }, 3000);

    function cleanup() { ro.disconnect(); clearTimeout(giveUp); }
    return cleanup;
  }, [key, navType]);

  return null;
}

// The shared shell: page content, then the footer on EVERY page.
function Layout() {
  const { t } = useTheme();
  return (
    <div data-student-surface="true" className={`flex min-h-screen flex-col ${t.page} ${t.text}`}>
      <div className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------
//  1. EXPLORE  — the full browse feed (sidebar + grid). Dashboard is
//     self-contained: it reads its filters from the URL and fetches itself.
// ---------------------------------------------------------------------
function BrowsePage() {
  return <Dashboard />;
}

// ---------------------------------------------------------------------
//  2. LEGACY CHAPTER ROUTE  —  /chapter/:chapterId
//
//  This used to be a third result surface: its own RPC (get_chapter_courses),
//  its own card grid and its own loading/error/empty states, so the same
//  chapter could look different depending on how you reached it.
//
//  It is now purely a COMPATIBILITY REDIRECT. Old bookmarks and shared links
//  keep working; they land in the one result system. `replace` is deliberate —
//  the redirect must not become a history entry the Back button can get stuck
//  bouncing off.
//
//  Callers that already know more (a subject, a goal, a slug) should build the
//  richer canonical URL themselves rather than routing through here; this only
//  has an id, so ?ch= is the most it can honestly say.
// ---------------------------------------------------------------------
function LegacyChapterRedirect() {
  const { chapterId } = useParams();
  const id = Number(chapterId);
  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/browse" replace />;
  return <Navigate to={`/browse?ch=${id}`} replace />;
}

// ---------------------------------------------------------------------
//  4 + 5. LEGAL PAGES  — both already accept an onBack prop
// ---------------------------------------------------------------------
function TermsPage() {
  return <LegalPage />;
}

function PrivacyPage() {
  return <PrivacyPolicy />;
}

function ComparisonRoute() {
  if (RELEASE_CAPABILITIES.comparison) return <Compare />;
  return (
    <FeatureUnavailable
      title="Course comparison is coming soon"
      detail="The comparison database is still being verified. Course selection is hidden until every comparison value can be shown accurately."
    />
  );
}

function UniversalSearchRoute() {
  if (RELEASE_CAPABILITIES.universalSearch) return <SearchPage />;
  return (
    <FeatureUnavailable
      title="Full-library search is coming soon"
      detail="For now, use Browse courses to filter by exam, class, subject, chapter, channel and language."
    />
  );
}

function FacultyRoute() {
  if (RELEASE_CAPABILITIES.facultyRegistry) return <FacultyProfile />;
  return (
    <FeatureUnavailable
      title="Faculty profiles are coming soon"
      detail="Faculty names and aliases are still under editorial review, so the site will not guess which teacher a name belongs to."
    />
  );
}

// ---------------------------------------------------------------------
//  THE APP
//  ThemeProvider sits above everything, so the light/dark toggle in one
//  screen is remembered when you move to another.
// ---------------------------------------------------------------------
export default function App() {
  return (
    <ThemeProvider>
      <AppErrorBoundary>
      <ScrollToTop />
      <Routes>
        {/* Admin sits OUTSIDE the student layout — no site footer. */}
        <Route path="/admin" element={<Deferred><AdminPanel /></Deferred>} />

        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          {/* Guided path-based cascade — every level renders <Explore/>. */}
          {/* Segments after :goal are positional and shift by one for the
              School Boards goal, which inserts a Board stage:
                /explore/jee/class-11/physics/kinematics
                /explore/school/cbse/class-10/physics/motion
              Explore reads them accordingly. */}
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:goal" element={<Explore />} />
          <Route path="/explore/:goal/:s1" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2/:s3" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2/:s3/:s4" element={<Explore />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/faculty/:slug" element={<FacultyRoute />} />
          <Route path="/compare" element={<ComparisonRoute />} />
          <Route path="/search" element={<UniversalSearchRoute />} />
          {/* Both screens are addressed by real database ids. */}
          <Route path="/chapter/:chapterId" element={<LegacyChapterRedirect />} />
          {/* A course opened from the catalogue has no chapter context, so the
              chapterless route is a real destination — not a 404 reached via an
              invented chapter id. */}
          <Route path="/course/:playlistId" element={<CourseVideoPage />} />
          <Route
            path="/course/:playlistId/chapter/:chapterId"
            element={<CourseVideoPage />}
          />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* anything else -> home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
