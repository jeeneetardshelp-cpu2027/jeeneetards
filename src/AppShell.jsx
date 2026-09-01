// AppShell.jsx — ONE header, ONE container system, every screen.
//
// Two problems this originally fixed, both found by inspecting the running
// site, and both still enforced by tests:
//
// 1. Three navigation systems. Home, Explore and Dashboard each rendered
//    their own header, so the product read as three separate sites. This is
//    now the ONLY file in the student surface allowed to contain <header>.
//
// 2. Content stranded on large screens. Explore used max-w-4xl (896px). At
//    2560px that is 35% of the viewport with 824px of dead space either side.
//    The container scales in steps instead of stopping dead at one breakpoint:
//      phone    full width, 16px gutters
//      tablet   full width, 24px gutters
//      laptop   up to 1280px
//      desktop  up to 1536px
//      wide     up to 1760px
//
// REDESIGN NOTES
// • The bar is glass and gains its border, shadow and opacity only after the
//   page scrolls, so the hero reads edge-to-edge on arrival.
// • A reading-progress hairline sits on the bottom edge of the bar. It is the
//   only always-on animation in the shell and costs one rAF per scroll frame.
// • The mobile nav is a scrollable segmented rail rather than a four-cell
//   text grid, so "Browse courses" no longer wraps to two lines at 360px.
//   Its label text is unchanged — the audit matches nav items by textContent.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  AtSign, ChevronRight, Flame, LogIn, LogOut, Moon, Search, Sun, X,
} from "lucide-react";
import { useTheme } from "./theme.jsx";
import { useSession } from "./useSession.js";
import { supabase } from "./supabaseClient.js";
import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";
import { clearProgress } from "./progress.js";
import { clearNotes } from "./notes.js";
import { clearStreak, mergeStudyDays, streakStats } from "./streak.js";
import { pullServerStudyDays } from "./streakSync.js";
import { clearRevision } from "./revision.js";
import { prefersReducedMotion } from "./motion.jsx";
import { langAttrs } from "./lang.js";

// Study days are pulled once per user per PAGE LOAD, not per navigation: the
// header remounts on every route change, and re-fetching an unchanging set
// each time would be pure noise. Module-level, like progressSync's throttle
// map. Cleared on sign-out so the same browser signing back in (without a
// full reload) pulls again.
const pulledStudyDaysFor = new Set();

// `width` picks the cap. "reading" stays narrow on purpose (guided steps,
// legal text); "catalogue" is for grids that benefit from more columns.
const WIDTHS = {
  reading: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  catalogue: "mx-auto w-full max-w-[1280px] px-4 sm:px-6 2xl:max-w-[1536px] min-[1900px]:max-w-[1760px]",
};

export function Container({ width = "catalogue", className = "", children }) {
  return <div className={`${WIDTHS[width] ?? WIDTHS.catalogue} ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------
//  The global search shortcut
// ---------------------------------------------------------------------
//
// "/" and Ctrl-K / Cmd-K open search from anywhere. Two things make this safe
// to bind on `window`:
//
//   * A keystroke aimed at a text field is never stolen. Typing "and/or" into
//     the notes panel, a chapter title into the browse filter, or "/" into a
//     forum reply must reach that field. isTypingTarget() below is the guard,
//     and it is exported so its behaviour can be tested directly rather than
//     inferred from a rendered page.
//   * An event another handler already claimed (defaultPrevented) is left
//     alone.
//
// WHERE IT LANDS. A page that hands the shell a search box (Browse's catalogue
// filter, Explore's library box) owns the query the student is most likely to
// want, so the shortcut reveals and focuses THAT box. Otherwise it looks for
// the page's own search field — Home's hero and /search's own input both mark
// themselves with `data-search-input` — and failing that navigates to /search,
// the one search surface.
const SEARCH_INPUT_SELECTOR = "[data-search-input]";

/**
 * True when a keystroke belongs to whatever the student is typing in.
 * Covers <input>, <textarea>, <select> and contenteditable regions, including
 * a click target nested inside a contenteditable.
 */
export function isTypingTarget(target) {
  const el = target && typeof target === "object" && "tagName" in target ? target : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (typeof el.closest === "function" &&
      el.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  const tag = String(el.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/** True when this keystroke is a request to open search. */
export function isSearchShortcut(event) {
  if (!event || event.defaultPrevented) return false;
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) return true;
  return Boolean(
    (event.key === "k" || event.key === "K") &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey
  );
}

/** True once the page has scrolled past `offset`. Passive, rAF-free. */
function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}

/** Reading progress as a 0–1 scaleX on a hairline. */
function ProgressLine() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    if (typeof window.requestAnimationFrame !== "function") return undefined;

    let frame = 0;
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${ratio.toFixed(4)})`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-accent"
      style={{ transform: "scaleX(0)" }}
      ref={ref}
    />
  );
}

// The id the skip link targets. Exported so every page that renders its own
// <main> can carry it explicitly. Import this constant — never retype the
// string, or a rename here silently unhooks the skip link on that page.
export const MAIN_CONTENT_ID = "main-content";

/**
 * Skip to main content — the first focusable element on every page.
 *
 * WHY: on a phone this header stacks up to three rows (brand + controls, the
 * scrollable nav rail, breadcrumbs). Without a skip link a keyboard or screen
 * reader user tabs through the brand, every nav pill and every crumb before
 * reaching the page body — on EVERY route. JEE and NEET both have PwD
 * categories, so that is a real student, not a hypothetical one.
 *
 * WHERE THE TARGET LIVES: the <main> landmark is rendered by each page
 * component (Home, Explore, MinimalUI, TestsPage, …), not by this file. Every
 * one of them now sets id={MAIN_CONTENT_ID} on its own <main>, as does this
 * file's <Page> frame, so the shell owns nothing it has to mutate. An earlier
 * version of this component reached into the page on mount and assigned the id
 * itself; that was always a temporary measure, and it is gone.
 *
 * The click handler still resolves the target at click time and falls back to
 * the first <main> on the page, so a page that has not been given the id yet —
 * or one that swaps its <main> between a loading and a loaded state — still
 * works. Moving focus is not optional: a bare hash jump scrolls the viewport
 * but leaves focus in the header, so the next Tab lands back in the nav — the
 * exact problem the link exists to solve. <main> is not focusable by default,
 * hence tabindex="-1".
 *
 * The visuals (hidden until focused, then a real 44px control in both themes)
 * live in the .skip-link rule in index.css.
 */
function SkipLink() {
  const skipToContent = (event) => {
    const target =
      document.getElementById(MAIN_CONTENT_ID) ?? document.querySelector("main");
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    // scrollIntoView (not focus's own scrolling) because it honours the
    // `scroll-padding-top` in index.css, which keeps the sticky header from
    // covering the first line of content.
    target.scrollIntoView?.();
  };

  return (
    <a href={`#${MAIN_CONTENT_ID}`} className="skip-link" onClick={skipToContent}>
      Skip to main content
    </a>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md text-sm font-bold"
      style={{
        background: "linear-gradient(145deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--deep)))",
        color: "var(--accent-ink)",
        boxShadow: "var(--shadow-accent)",
      }}
    >
      <span className="sheen-layer" />
      <span className="relative">J</span>
    </span>
  );
}

/**
 * The one global header.
 *  crumbs: [{ label, to } | { label, onClick } | { label }]
 *  search: optional node (context search, filter entry point)
 */
export function GlobalHeader({ crumbs = [], search = null, leading = null, width = "catalogue" }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const { session } = useSession();
  const scrolled = useScrolled();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  // Below 640px the top row is brand + controls only: a search box there pushed
  // ~53px past the viewport at 360. It used to be simply hidden, which left
  // /browse's search reachable on a phone ONLY from inside the Filters bottom
  // sheet — two taps and a scroll away from a control that is right there on a
  // laptop. It now folds onto its own full-width line under the top row,
  // revealed by the magnifier beside the theme toggle. One instance of the
  // node, moved by CSS (flex-wrap + basis), so there is no duplicate field for
  // a screen reader to read out twice.
  const [searchRowOpen, setSearchRowOpen] = useState(false);
  const searchBoxRef = useRef(null);
  // A counter rather than a boolean: pressing "/" twice must focus twice, and
  // a boolean that is already true would not re-run the effect.
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (!focusRequest) return;
    // Runs after the row has been revealed, because both state updates land in
    // the same render — a display:none field cannot take focus.
    const field = searchBoxRef.current?.querySelector("input, textarea");
    if (!field) return;
    field.focus();
    if (typeof field.select === "function") field.select();
  }, [focusRequest]);

  const openSearch = useCallback(() => {
    if (searchBoxRef.current?.querySelector("input, textarea")) {
      setSearchRowOpen(true);
      setFocusRequest((n) => n + 1);
      return;
    }
    // No shell search box on this page: Home's hero and /search's own field
    // announce themselves instead.
    const onPage = document.querySelector(SEARCH_INPUT_SELECTOR);
    if (onPage) {
      onPage.focus();
      if (typeof onPage.select === "function") onPage.select();
      return;
    }
    navigate("/search");
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isSearchShortcut(event)) return;
      if (isTypingTarget(event.target)) return;   // they are typing, not navigating
      event.preventDefault();
      openSearch();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);
  // The streak chip's numbers, read once per mount (the header remounts on
  // every route change, so navigation keeps it current) and re-read after
  // the sign-in pull below or a sign-out wipe.
  const [streak, setStreak] = useState(() => streakStats());
  const userId = session?.user?.id ?? null;

  // A signed-in student's study days live on the server too (streakSync /
  // study_days). Sign-out deliberately wipes the local streak for shared
  // machines, so on the next sign-in this pull unions the server copy back
  // into ll_streak_v1 — the streak returns. mergeStudyDays only ever ADDS
  // days, so running after progress this device already made is safe. A
  // quiet no-op until the owner applies the study_days migration.
  useEffect(() => {
    if (!userId || pulledStudyDaysFor.has(userId)) return undefined;
    pulledStudyDaysFor.add(userId);
    let active = true;
    pullServerStudyDays(userId).then((days) => {
      if (!days.length || mergeStudyDays(days) === 0) return;
      if (active) setStreak(streakStats());
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // ONE discovery door. "Find a course" (/explore, a guided wizard that just
  // redirects into /browse), "Browse courses" (/browse) and "Search" (/search)
  // were three adjacent pills that all meant "find a lecture" but behaved
  // differently — and on a narrow phone the 6-pill rail pushed the last items
  // off-screen. Now: Home · Courses · Mock tests · Study material. /explore and
  // /search keep their routes (reachable from the home page and the persistent
  // search icon below) and their footer links; they are only dropped from the
  // top nav. See DESIGN note in the commit / next-priorities memory.
  const nav = [
    { label: "Home", to: "/" },
    { label: "Courses", to: "/browse" },
    { label: "Mock tests", to: "/tests" },
    ...(RELEASE_CAPABILITIES.studyMaterials ? [{ label: "Study material", to: "/materials" }] : []),
    ...(RELEASE_FEATURES.forum ? [{ label: "Forum", to: "/forum" }] : []),
    ...(RELEASE_FEATURES.polls ? [{ label: "Polls", to: "/polls" }] : []),
  ];
  // "Courses" also owns the guided /explore funnel, which only redirects into
  // /browse — so the student is never on a page with no active nav item.
  const isActive = (to) => {
    if (to === "/") return pathname === "/";
    if (to === "/browse") return pathname.startsWith("/browse") || pathname.startsWith("/explore");
    return pathname.startsWith(to);
  };

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      setSignOutError("Could not sign out. Please try again.");
      return;
    }
    // Only after a SUCCESSFUL sign-out: leaving the device-local watch history
    // behind means the next person on a shared machine sees this student's
    // courses in "Continue watching" and their watched ticks on every lesson
    // list. The server copy is untouched, so it returns on next sign-in. Notes
    // are device-local too and carry the same shared-machine risk.
    clearProgress();
    clearNotes();
    // Same shared-machine reasoning: ll_streak_v1 is un-namespaced, so a
    // school-lab browser must not hand the next student someone else's streak.
    clearStreak();
    // Same reasoning: ll_revision_v1 names the chapters a student
    // finished, which is exactly the kind of thing a shared machine must not
    // hand to whoever signs in next.
    clearRevision();
    // The chip above reads the store this just wiped, and the next sign-in
    // (even in this same tab, without a reload) must be allowed to pull the
    // server copy back down.
    setStreak(streakStats());
    pulledStudyDaysFor.clear();
  };

  return (
    <>
      {/* First focusable element on the page — the header is the first thing
          every route renders, so this is the first thing every keyboard user
          reaches. It is out of flow until focused, so it changes no layout. */}
      <SkipLink />
      <header
        className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-500 [transition-timing-function:var(--ease-out-expo)] ${
          scrolled
            ? "glass border-b border-hairline shadow-e2"
            : "border-b border-transparent"
        }`}
        style={scrolled ? undefined : { backgroundColor: "color-mix(in oklab, var(--canvas) 72%, transparent)", backdropFilter: "blur(12px)" }}
      >
        <Container width={width}>
          {/* flex-wrap so the search field can drop onto its own full-width
              line on a phone (see searchRowOpen) without a second instance. */}
          <div className="flex min-h-14 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            {leading}
            <Link
              to="/"
              aria-label="JEENEETARD home"
              className="group/brand flex min-h-11 shrink-0 items-center gap-3 rounded-md px-1"
            >
              <BrandMark />
              <span className="hidden text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink transition-opacity duration-300 group-hover/brand:opacity-80 sm:inline">
                JEENEETARD
              </span>
            </Link>

            {/* The streak, where studying actually happens — a compact flame +
                day count beside the brand, on every page including the watch
                page. Links home, where the full "Your prep today" band lives.
                Hidden at zero: a "0 days" badge is guilt, not information, and
                it keeps the crowded mobile row (brand + three icon buttons)
                free for the students the chip has nothing to say to. */}
            {streak.current >= 1 && (
              <Link
                to="/"
                aria-label={`Study streak: ${streak.current} day${streak.current === 1 ? "" : "s"}`}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm font-semibold tabular-nums text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <Flame className="h-4 w-4 text-accent" aria-hidden="true" />
                {streak.current}
              </Link>
            )}

            <nav aria-label="Primary navigation" className="ml-3 hidden items-center gap-1 lg:flex">
              {nav.map((n) => {
                const active = isActive(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-11 items-center rounded-md px-3.5 text-sm transition-colors duration-300 ${
                      active
                        ? "font-medium text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md border border-hairline bg-surface-2"
                      />
                    )}
                    <span className="relative">{n.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* ONE search node. Inline in the top row from 640px up; below that
                it wraps onto its own full-width line and is shown only once the
                student opens it (or presses "/" or Ctrl/Cmd-K). */}
            <div
              ref={searchBoxRef}
              className={`order-last w-full basis-full pb-2 sm:order-none sm:ml-auto sm:block sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-auto sm:pb-0 sm:max-w-sm ${
                searchRowOpen ? "block" : "hidden"
              }`}
            >
              {search}
            </div>

            {/* The phone's way in to that field. Only offered when this page
                actually passes one, and only below 640px, where it is hidden. */}
            {search && (
              <button
                type="button"
                onClick={() => {
                  if (searchRowOpen) { setSearchRowOpen(false); return; }
                  setSearchRowOpen(true);
                  setFocusRequest((n) => n + 1);
                }}
                aria-expanded={searchRowOpen}
                aria-label={searchRowOpen ? "Hide the search box" : "Show the search box"}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink sm:hidden"
              >
                {searchRowOpen
                  ? <X className="h-5 w-5" aria-hidden="true" />
                  : <Search className="h-5 w-5" aria-hidden="true" />}
              </button>
            )}

            {/* The library search now lives as one persistent icon on EVERY page,
                instead of a nav pill that only reached it from a menu. Sits in the
                controls cluster (right-aligned by the ml-auto box above), visible
                on mobile too where the old pill scrolled off-screen. */}
            {RELEASE_CAPABILITIES.universalSearch && (
              <Link
                to="/search"
                aria-label="Search the library"
                aria-current={pathname.startsWith("/search") ? "page" : undefined}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </Link>
            )}

            {session?.user ? (
              <div className="flex shrink-0 items-center">
                {RELEASE_FEATURES.studentAccounts && pathname !== "/forum/username" && (
                  <Link
                    to="/forum/username"
                    aria-label="Forum username"
                    className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                  >
                    <AtSign className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden lg:inline">Forum username</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  aria-label="Sign out"
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
                </button>
              </div>
            ) : (
              // The front door for an account. Only shown when accounts are a
              // real release feature; carries the current path so signing in
              // returns the student to where they were, not to the homepage.
              // /signin is itself excluded from this, or the return would loop.
              RELEASE_FEATURES.studentAccounts && pathname !== "/signin" && (
                <Link
                  to={`/signin?next=${encodeURIComponent(pathname)}`}
                  aria-label="Sign in"
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Sign in</span>
                </Link>
              )
            )}

            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              aria-pressed={dark}
              className="group/theme relative ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink sm:ml-0"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          {signOutError && (
            <p role="alert" className="pb-2 text-right text-xs text-rose-500">
              {signOutError}
            </p>
          )}

          {/* Mobile / tablet nav: a scrollable segmented rail. Labels are the
              full strings the audit matches on, so nothing wraps or truncates.
              Marked as an intentional horizontal scroller. */}
          <nav
            aria-label="Primary navigation"
            data-allow-horizontal-scroll="true"
            className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto border-t border-hairline px-4 py-2 lg:hidden"
          >
            {nav.map((n) => {
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border px-4 text-sm transition-colors duration-200 ${
                    active
                      ? "border-accent-line bg-accent-soft font-medium text-accent"
                      : "border-hairline text-ink-2"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {crumbs.length > 0 && (
            // Breadcrumbs scroll horizontally on a phone rather than wrapping
            // into a three-line stack or forcing the page wider than the screen.
            <nav
              aria-label="Breadcrumb"
              data-allow-horizontal-scroll="true"
              className="scrollbar-none -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 text-sm sm:mx-0 sm:px-0"
            >
              {/* langAttrs marks a Devanagari crumb — a course or chapter title
                  like "कबीर की साखी" — as lang="hi". The document is lang="en",
                  so without this a screen reader reads those titles with English
                  phonetics. It returns {} for Latin text, so English crumbs are
                  untouched. See src/lang.js. */}
              {crumbs.map((c, i) => (
                <span key={`${c.to ?? c.label}-${i}`} className="flex shrink-0 items-center gap-1">
                  {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" />}
                  {c.onClick ? (
                    <button
                      // A crumb may carry an explicit handler instead of a URL:
                      // the course page returns to the exact filtered results it
                      // came from, which a hardcoded /browse would discard.
                      onClick={() => c.onClick()}
                      {...langAttrs(c.label)}
                      className="flex min-h-11 items-center rounded-md px-1.5 text-ink-2 transition-colors duration-200 hover:text-ink"
                    >
                      {c.label}
                    </button>
                  ) : c.to ? (
                    <Link
                      to={c.to}
                      {...langAttrs(c.label)}
                      className="flex min-h-11 items-center rounded-md px-1.5 text-ink-2 transition-colors duration-200 hover:text-ink"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={i === crumbs.length - 1 ? "page" : undefined}
                      {...langAttrs(c.label)}
                      className={`flex min-h-11 items-center px-1.5 ${
                        i === crumbs.length - 1 ? "font-medium text-ink" : "text-ink-2"
                      }`}
                    >
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </Container>

        <ProgressLine />
      </header>
    </>
  );
}

// Standard page frame: global header + a correctly-capped main.
export function Page({ crumbs, search, width = "catalogue", children }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader crumbs={crumbs} search={search} width={width} />
      {/* The id the header's skip link points at. Pages that render their own
          <main> instead of using <Page> set the same id themselves. */}
      <main id={MAIN_CONTENT_ID} className="py-8 sm:py-12">
        <Container width={width}>{children}</Container>
      </main>
    </div>
  );
}

// Search input styled once, so it looks identical on every screen.
export function HeaderSearch({ value, onChange, placeholder = "Search…", onClear }) {
  return (
    <form
      role="search"
      className="group/hs relative"
      // Results update live as you type; Enter/Go just closes the keyboard.
      onSubmit={(event) => {
        event.preventDefault();
        event.currentTarget.querySelector("input")?.blur();
      }}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3 transition-colors duration-300 group-focus-within/hs:text-accent"
      />
      <input
        // How the "/" and Ctrl/Cmd-K shortcut finds a search field on pages
        // that do not hand one to the shell. See "The global search shortcut"
        // above.
        data-search-input="header"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-11 w-full min-w-0 rounded-md border border-hairline bg-surface-2 py-2 pl-10 pr-11 text-sm text-ink outline-none transition-colors duration-300 placeholder:text-ink-3 focus:border-accent-line focus:bg-surface"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors duration-200 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export default Page;
