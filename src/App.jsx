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
  useParams, useLocation, useNavigationType,
} from "react-router";
// Cookieless, aggregate page-view counting served by the site's own host —
// no cookies, no cross-site tracking, no individual profiles (see the
// privacy policy's "Purposes and sharing" section, which describes it).
import { Analytics } from "@vercel/analytics/react";
// Same privacy characteristics as Analytics above, but measures aggregate
// page-load performance (Core Web Vitals) instead of page views.
import { SpeedInsights } from "@vercel/speed-insights/react";

import { ThemeProvider } from "./theme.jsx";
import Home from "./Home.jsx";
import Footer from "./Footer.jsx";
import LegalPage from "./LegalPage.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import MethodologyPage from "./MethodologyPage.jsx";
import PasswordReset from "./PasswordReset.jsx";
import SignInPage from "./SignInPage.jsx";
import FeatureUnavailable from "./FeatureUnavailable.jsx";
import NotFound from "./NotFound.jsx";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import RouteMetadata from "./PageMetadata.jsx";
import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";

const Explore = lazy(() => import("./Explore.jsx"));
const FacultyDirectory = lazy(() => import("./FacultyDirectory.jsx"));
const FacultyProfile = lazy(() => import("./FacultyProfile.jsx"));
const Compare = lazy(() => import("./Compare.jsx"));
const SearchPage = lazy(() => import("./SearchPage.jsx"));
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const AdminPanel = lazy(() => import("./AdminPanel.jsx"));
const CourseVideoPage = lazy(() => import("./CourseVideoPage.jsx"));
const TestsPage = lazy(() => import("./TestsPage.jsx"));
const ExamTestsPage = lazy(() => import("./ExamTestsPage.jsx"));
const StudyMaterialsPage = lazy(() => import("./StudyMaterialsPage.jsx"));
const JeeMainPapersPage = lazy(() => import("./JeeMainPapersPage.jsx"));
const ForumFeatureUnavailable = lazy(() => import("./forum/ForumFeatureUnavailable.jsx"));
const ForumFeedPage = lazy(() => import("./forum/ForumFeedPage.jsx"));
const ForumPostPage = lazy(() => import("./forum/ForumPostPage.jsx"));
const ForumSubmitPage = lazy(() => import("./forum/ForumSubmitPage.jsx"));
const ForumUsernamePage = lazy(() => import("./forum/ForumUsernamePage.jsx"));

function RouteFallback() {
  return (
    <main
      role="status"
      aria-label="Loading page"
      className="min-h-[60vh] bg-canvas px-4 py-10 sm:px-6"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="h-6 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-xl border border-hairline bg-surface"
              style={{ animationDelay: `${index * 90}ms` }}
            />
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
      try { sessionStorage.setItem('scroll:' + key, String(window.scrollY)); } catch {
        // Storage can be disabled by browser privacy settings.
      }
    };
    // pagehide covers a real unload (link to another document, reload, tab
    // close). The cleanup below covers SPA route changes. Without the former,
    // nothing is ever saved when the document is destroyed.
    window.addEventListener('pagehide', save);
    return () => { window.removeEventListener('pagehide', save); save(); };
  }, [key]);

  useEffect(() => {
    let saved = NaN;
    try { saved = Number(sessionStorage.getItem('scroll:' + key)); } catch {
      // Treat unavailable storage as if no position had been saved.
    }

    // A saved position is restored on POP (Back/Forward). After a full document
    // reload the FIRST navigation is not reported as POP, so gating on navType
    // alone silently scrolled such visits to 0 — that was the reload bug. What
    // actually matters is "is there a saved position for exactly this URL?"
    const hasSaved = Number.isFinite(saved) && saved > 0;
    const isReloadEntry =
      typeof performance !== 'undefined' &&
      performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload';

    // behavior:"instant" is REQUIRED on every scroll in this file, not
    // cosmetic. index.css sets `html { scroll-behavior: smooth }`, which an
    // un-optioned window.scrollTo() obeys — so a route change animated the
    // whole page instead of jumping, and the student watched the new page fly
    // past. Worse on Back: the restore below also animated while `done` was
    // set synchronously, tearing down the ResizeObserver mid-flight so a
    // still-growing grid never got re-corrected. Smooth stays on for real
    // user-initiated anchor scrolls, which is what the CSS rule is for.
    if (!hasSaved || !(navType === 'POP' || isReloadEntry)) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
      window.scrollTo({ top: target, left: 0, behavior: "instant" });
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
      if (!done) { window.scrollTo({ top: Math.min(target, document.documentElement.scrollHeight), left: 0, behavior: "instant" }); }
      cleanup();
    }, 3000);

    function cleanup() { ro.disconnect(); clearTimeout(giveUp); }
    return cleanup;
  }, [key, navType]);

  return null;
}

// The shared shell: page content, then the footer on EVERY page.
//
// The `key` on the content wrapper is what produces the page transition: a
// route change remounts the wrapper, which restarts the short fade-up in
// `.route-enter`. Keyed by pathname only — a query-string change (a filter,
// a search term) must NOT re-animate the page under the student's hands.
function Layout() {
  const { pathname } = useLocation();
  return (
    <div
      data-student-surface="true"
      className="flex min-h-screen flex-col bg-canvas text-ink"
    >
      <div key={pathname} className="route-enter flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <Footer />
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
      detail="The comparison database is still under review. Course selection is hidden until every comparison value can be shown accurately."
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

function FacultyDirectoryRoute() {
  if (RELEASE_CAPABILITIES.facultyRegistry) return <FacultyDirectory />;
  return (
    <FeatureUnavailable
      title="Faculty directory is coming soon"
      detail="Faculty identities and course links are still under editorial review."
    />
  );
}

function StudyMaterialsRoute() {
  if (RELEASE_CAPABILITIES.studyMaterials) return <StudyMaterialsPage />;
  return (
    <FeatureUnavailable
      title="Study material is coming soon"
      detail="Short notes, formula sheets, lecture notes and previous-year papers are being checked before they are published."
    />
  );
}

function JeeMainPapersRoute() {
  if (RELEASE_CAPABILITIES.studyMaterials) return <JeeMainPapersPage />;
  return (
    <FeatureUnavailable
      title="JEE Main papers are coming soon"
      detail="Official previous-year papers are being checked before they are published."
    />
  );
}

function ForumFeedRoute() {
  return RELEASE_FEATURES.forum
    ? <ForumFeedPage />
    : <ForumFeatureUnavailable released={false} />;
}

function ForumPostRoute() {
  return RELEASE_FEATURES.forum
    ? <ForumPostPage />
    : <ForumFeatureUnavailable released={false} />;
}

function ForumSubmitRoute() {
  return RELEASE_FEATURES.forum
    ? <ForumSubmitPage />
    : <ForumFeatureUnavailable released={false} />;
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
      <RouteMetadata />
      <ScrollToTop />
      {/* Report the PATH only. By default the script sends location.href, so
          Vercel received every student's raw /search?q=... text and, on the
          recovery route, the access_token in the URL fragment. The Privacy
          Policy promises minors aggregate, cookieless page views with no
          individual profiles; stripping the query and hash here is what makes
          that literally true. */}
      <Analytics
        beforeSend={(event) => {
          try {
            const u = new URL(event.url);
            return { ...event, url: u.origin + u.pathname };
          } catch {
            // Never let a malformed URL drop the pageview entirely.
            return event;
          }
        }}
      />
      <SpeedInsights />
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
          <Route path="/faculty" element={<FacultyDirectoryRoute />} />
          <Route path="/faculty/:slug" element={<FacultyRoute />} />
          <Route path="/compare" element={<ComparisonRoute />} />
          <Route path="/search" element={<UniversalSearchRoute />} />
          <Route path="/materials" element={<StudyMaterialsRoute />} />
          <Route
            path="/materials/jee-main/previous-year-papers"
            element={<JeeMainPapersRoute />}
          />
          {/* The forum is deliberately routeable before release so its edge
              contract and review builds cannot silently 404. The feature flag
              keeps it out of public navigation until the complete UI ships. */}
          <Route path="/forum" element={<ForumFeedRoute />} />
          <Route path="/forum/post/:postId" element={<ForumPostRoute />} />
          <Route path="/forum/submit" element={<ForumSubmitRoute />} />
          {/* Username setup stays available while the forum flag and mode are
              off, so approved beta testers can prepare without opening any
              discussion read or write surface. */}
          <Route path="/forum/username" element={<ForumUsernamePage />} />
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
          {/* A directory of outbound links to free test platforms — no DB
              call, so it needs no release-capability gate. */}
          <Route path="/tests" element={<TestsPage />} />
          {/* One page per exam, so each can own its title, description and
              canonical. An unknown :examId renders NotFound, and the edge
              middleware gives that URL a real HTTP 404 to match. */}
          <Route path="/tests/:examId" element={<ExamTestsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/reset" element={<PasswordReset />} />
          <Route path="/signin" element={<SignInPage />} />
          {/* Anything else is honestly a 404 — silently redirecting to Home
              made every mistyped or stale link a soft-404 for crawlers and a
              mystery for students. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
