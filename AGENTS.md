# AGENTS.md — jeeneetard.com

**CLAUDE.md is this same document under another name.** Every agent reads one or
the other, so they must not disagree: if you change one, change both.

## What this project is

A free, independent directory of curriculum-organised YouTube courses for
JEE / NEET / CBSE students. Students browse exam → class → subject → chapter,
compare courses, and watch lessons through YouTube's privacy-enhanced embed.
Around that sits a community layer: course ratings and reviews, a closed-beta
forum, student polls, a reviewed study-material library, a faculty
directory, previous-year papers, and a gentle study streak.

Content is embedded, never hosted — we store YouTube ids and descriptive
catalogue data only. Live at jeeneetard.com.

## Working style (I'm new to coding)

- Explain steps in plain language. Ask before anything risky or destructive.
- Go step by step; after each major step, run the app and pause for me to confirm.
- Don't delete my original source files.
- When I correct you, add a short rule to this file so the mistake doesn't repeat.
- Voice on the site is plain, honest and student-facing. No hype. **Never invent
  data the backend doesn't return** — a section with no data hides itself rather
  than showing a placeholder.
- Users are 14–18. Mobile matters: 44px touch targets, no horizontal overflow,
  and both light and dark themes.

## Tech stack

- React 19 + Vite 8, **JavaScript — not TypeScript**.
- Tailwind CSS v4 through the `@tailwindcss/vite` plugin plus
  `@import "tailwindcss";` in `src/index.css`. Not the old PostCSS /
  `tailwindcss init` flow.
- React Router 8, imported from `react-router` (`react-router-dom` was removed
  in v8).
- Icons: lucide-react. Backend: Supabase (Postgres + Auth + RLS) via
  `@supabase/supabase-js`.
- Tests: vitest 4 + @testing-library, jsdom.
- Deployed on Vercel (Netlify config kept as a fallback). `middleware.js` is
  Vercel Edge Middleware: it rewrites `<head>` and renders crawler-visible body
  content for SPA routes, and fails through to the normal shell on any error.

## The screens (`src/App.jsx` is the authority — read it, don't trust a list)

- `/` — `Home.jsx` with `HomeSections.jsx` and `PrepToday.jsx`: the "where am I"
  band (streak, today's goal, exam countdown, continue watching), hero search,
  exam grid.
- `/explore/…` — `Explore.jsx`: the guided goal → (board) → class → subject →
  chapter cascade. The path *is* the state. **Its last step redirects into
  `/browse`; it does not render results.**
- `/browse` — `Dashboard.jsx`, routed under the alias `BrowsePage`. The
  catalogue: `FilterPanel.jsx` plus `PlaylistBrowse.jsx` results. The filename
  is a leftover; this is the browse page, not a dashboard.
- `/course/:playlistId[/chapter/:chapterId]` — `CourseVideoPage.jsx`: the watch
  page. The player and lesson rail come from `MinimalUI.jsx`'s `VideoView`;
  notes, study materials, rating, report, share and chapter panels sit under it.
- `/search` — `SearchPage.jsx` wrapping `UniversalSearch.jsx`.
- `/compare` · `/faculty` · `/faculty/:slug` · `/materials` ·
  `/materials/jee-main/previous-year-papers` · `/tests` · `/tests/:examId`.
- `/forum…` and `/polls…` — routed before release on purpose so a shared link
  explains itself; gated by `RELEASE_FEATURES`.
- `/chapter/:id` — a compatibility redirect to `/browse?ch=…`, nothing more.
- `/terms` · `/privacy` · `/methodology` · `/signin` · `/reset` · `*` NotFound.
- `/admin` — `AdminPanel.jsx`, deliberately outside the student layout.

`ChapterHub`, `CourseCard`, `ChapterResults` and `useChapterCourses` were
deleted. Don't bring them back — `src/noSecondResultSystem.test.js` fails if you
do.

## Theming

`theme.jsx` owns `ThemeContext` / `useTheme` (MinimalUI.jsx only re-exports them
for compatibility). `useTheme().t` returns Tailwind class strings backed by CSS
custom properties that swap on `html[data-theme]` — see the `@theme` block in
`src/index.css`. **Never use Tailwind's `dark:` variant.** Dark is the product
default; light is a first-class theme and is remembered.

Two styling vocabularies coexist on purpose:

- **Legacy `useTheme().t` token strings** — Browse, the watch page, Explore,
  Compare, Faculty, Search, admin.
- **`ui.jsx` primitives + token classes** (`bg-surface`, `text-ink`, …) — Home,
  HomeSections, PrepToday, Tests, ExamTests, FacultyDirectory.

Match the file you are in. Moving a page from one system to the other is its own
task, never a side effect of another change.

Brand accent: navy `#142A4F`, teal `#0F6F78` (`src/brandColors.js`; the teal is
dark enough for white text at WCAG AA). Use accents sparingly.

## Architecture rules — decided, don't quietly relitigate

1. **ONE result system.** `/browse` is the only interactive surface that renders
   course and lecture results. `/explore`'s last step and `/chapter/:id` both
   redirect into it. Chapter SEO pages must stay **edge-rendered shells**
   (`middleware.js` + `ogInject.js`) that hand off into `/browse` — never a
   second interactive results UI.
2. **ONE search surface.** `universal_search` is the only search. The homepage
   hero and `/search` call the same hook (`useUniversalSearch.js`). No page runs
   its own `ilike` queries against raw columns.
3. **`src/searchDestinations.js` owns where a search result lands.** A new result
   group needs a case there, or its rows become dead ends.
4. **`AppShell.jsx` is the only student-surface file allowed to contain
   `<header>`.** It also owns the one container/width system.
5. **`src/releaseCapabilities.js` is the release contract.** A feature is on only
   when the database capability is deployed *and* the flag is true. Never flip a
   flag because the React code or the SQL file exists.

## Database — read this before writing any SQL

**Schema truth is the ordered Supabase CLI migration chain in
`supabase/migrations/`.** Not the loose `.sql` files, not this document.

- `20260831140005_production_baseline.sql` **is** the live production schema
  (66 tables, 181 functions, 98 RLS policies). Read it to learn the real schema.
- `20260901120000_study_days.sql` is applied too.
- New schema ships as a **new timestamped file** in `supabase/migrations/`,
  applied with `npx supabase db push`.
- `db push` applies **every** pending migration at once — there is no per-file
  selection. Run `npx supabase migration list` first and know exactly what will
  run. A migration you stage must be safe and complete on its own.
- The Supabase **SQL Editor is read-only** — audits and verification, never
  schema writes. Anything applied outside the chain recreates the drift this
  directory exists to end.
- Workflow, current pending list, and what is deliberately excluded:
  [`supabase/README.md`](supabase/README.md). Don't duplicate it here.
- A parsed, grouped view of the baseline — tables by cluster with their RLS
  posture, plus every RPC: [`docs/schema_reference.md`](docs/schema_reference.md).
  It is generated from the baseline; regenerate it, don't hand-edit it.
- The `.sql` files at the repo root, in `src/migrations/` and in `docs/sql/` are
  **history**. Several still say "NOT applied to production" and are simply
  wrong. Never infer live status from them.
- **Never run a write against the production database** without my explicit
  approval for that exact operation.

## Facts worth not rediscovering

- Ratings auto-average: a trigger keeps `playlists.average_rating` and
  `ratings_count` fresh, so sorting by rating is instant. Never recompute AVG in
  the app.
- RLS is enabled on all 66 tables. Public browsing works signed out; only
  ratings, reports, forum and poll writes need an account.
- Progress, notes and the streak are device-local (localStorage) first. Signed-in
  students also get a best-effort server copy (`video_progress`, `study_days`).
  Sign-out wipes the local copy on purpose — shared school machines.

## Secrets

- `.env` (git-ignored) holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  The anon key is safe in the frontend; RLS is the real boundary.
- **Every `VITE_*` value is inlined into the public bundle.** Never put a server
  or service-role key behind a `VITE_` prefix. `VITE_YOUTUBE_API_KEY` was removed
  on 2026-08-10 for exactly that reason — admin YouTube calls now go through
  `api/youtube.js`, which holds the server-only `YOUTUBE_API_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Local scripts only; never in the
  frontend deployment.

## Commands

- `npm run dev` · `npm run build` · `npm run lint`
- `npm test` — the whole suite. For one change, run only what you touched:
  `npx vitest run <paths…>`.
- `npm run verify:frontend-release` before a deploy.
- `npm run verify:production-capabilities` — read-only check that the release
  flags match what production actually serves.
