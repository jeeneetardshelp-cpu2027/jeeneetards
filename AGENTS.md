# AGENTS.md — Systematic Educational Video Directory

## What this project is
A clean, distraction-free website (a mobile app comes in a later phase) that
helps JEE/NEET students find free educational YouTube videos, organised by
curriculum. Students browse Category → Subject → Chapter, compare courses from
different institutes, and watch lessons through YouTube's official embedded
player. A community layer adds course ratings and per-video comments.

Content is embedded, never hosted: we store only YouTube video IDs and
descriptive info. All videos stay on YouTube.

## Audience & design language
- Users are high-school students. Keep everything simple and obvious.
- Minimal and distraction-free: clean typography, generous whitespace,
  hairline borders (not heavy shadows), and BOTH light and dark mode.
- Brand accent: Competishun navy `#142A4F`, accessible teal `#0F6F78`. Use accents sparingly.

## Tech stack
- React + Vite (JavaScript, not TypeScript).
- Tailwind CSS v4 — via the `@tailwindcss/vite` plugin + `@import "tailwindcss";`
  in the CSS. Do NOT use the old `npx tailwindcss init` / PostCSS flow.
- Routing: React Router 8 via `react-router` (the `react-router-dom` compatibility package was removed in v8).
- Icons: lucide-react.
- Backend: Supabase (Postgres + Auth + Row Level Security) via @supabase/supabase-js.
- Deploy target (later): Vercel or Netlify.

## Theming rule (important)
Theme is handled by `ThemeContext` / `useTheme` in theme.jsx — a light/dark
palette swapped by React state. Do NOT use Tailwind's `dark:` variant.
Components read colours from `useTheme().t`. Brand accent colours are applied
via inline `style`, not Tailwind classes.

## Screens & flow
1. Home / browse — Dashboard.jsx: sidebar (Category → Subject → Chapter) + search. Entry point.
2. Chapter Hub   — MinimalUI.jsx (ChapterHub + CourseCard): courses for a chapter, side by side.
3. Video View    — MinimalUI.jsx (VideoView): player + "Chapter Notes" / "Comments" tabs.
4. Player        — YouTubePlayer.jsx goes inside Video View's player area (handles "embedding disabled").
5. Footer        — Footer.jsx on every page.
6. /terms → LegalPage.jsx.   /privacy → PrivacyPolicy.jsx.

Note: Dashboard.jsx currently uses its own styling; folding it into the theme
system is a later polish pass, not the first goal.

## Source files in this folder
SQL (run in the Supabase SQL Editor, in this order):
- schema.sql           — content tables (channels, categories, subjects, chapters, videos) + RLS + seed.
- community_schema.sql — profiles, playlists, playlist_videos, playlist_ratings, video_comments + auto-average + RLS.
- courses_data.sql     — adds tags + teacher to playlists; get_chapter_courses() RPC.

React / JS:
- Dashboard.jsx, MinimalUI.jsx, YouTubePlayer.jsx, Footer.jsx, LegalPage.jsx, PrivacyPolicy.jsx
- supabaseClient.js    — Supabase client from env vars.
- useChapterCourses.js — fetches courses for a chapter via the RPC.

## Data & security facts
- Ratings auto-average: a trigger keeps `playlists.average_rating` and
  `ratings_count` fresh, so sorting by rating is instant — never recompute AVG in the app.
- RLS: everyone can READ; only signed-in users can write their OWN ratings/comments;
  playlists/videos are admin-curated (written from the Supabase dashboard).
- Public browsing must work WITHOUT login. Only posting a rating/comment needs auth.

## Secrets
- Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (git-ignored).
- The anon key is safe in the frontend. NEVER put the service_role key in the app.

## Commands
- Dev:   `npm run dev`
- Build: `npm run build`

## Working style (I'm new to coding)
- Explain steps in plain language. Ask before anything risky or destructive.
- Go step by step; after each major step, run the app and pause for me to confirm.
- Don't delete my original source files.
- When I correct you, add a short rule to this file so the mistake doesn't repeat.
