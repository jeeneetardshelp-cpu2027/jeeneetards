# JEENEETARD

[![CI](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/workflows/ci.yml/badge.svg)](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/workflows/ci.yml)

JEENEETARD is an independent, free educational directory for finding
curriculum-organised YouTube courses and lectures. Students can browse by exam,
class, subject and chapter, then watch lessons through YouTube's official
privacy-enhanced player.

The application stores YouTube identifiers and descriptive catalogue data. It
does not host the videos and is not affiliated with YouTube, Google, an
institute or a coaching provider.

## Current release

The production frontend is intentionally a **browse-only MVP**. Existing code
does not make a feature production-ready; the matching database capability,
security controls and release evidence must also be present.

| Capability | Current state |
| --- | --- |
| Anonymous catalogue browsing | Enabled |
| Curriculum navigation | Enabled |
| YouTube privacy-enhanced playback | Enabled |
| Device-local watch progress | Enabled |
| Universal search | Disabled |
| Course comparison | Disabled |
| Faculty profiles and filtering | Disabled |
| School-board classification | Disabled |
| Public student accounts | Disabled |
| Rating submission | Disabled |
| Content reporting | Disabled |

The source of truth is
[`src/releaseCapabilities.js`](src/releaseCapabilities.js). Do not enable a
flag merely because its React component or SQL file exists.

## Technology

- React 19 and Vite 8
- JavaScript with Vitest and Testing Library
- Tailwind CSS 4 through `@tailwindcss/vite`
- React Router
- Supabase (Postgres, Auth, RLS and RPCs)
- YouTube privacy-enhanced embeds
- Vercel or Netlify deployment configuration

CI runs on Node.js 24.

## Safe local setup

Requirements:

- Node.js 24
- Git
- A Supabase project URL and browser-safe anon/publishable key

From PowerShell:

```powershell
git clone https://github.com/jeeneetardshelp-cpu2027/jeeneetards.git
cd jeeneetards
Copy-Item .env.example .env
npm ci
npm run dev
```

Edit the new `.env` before starting the app:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The browser YouTube key is needed only for the admin playlist importer. The
server YouTube key and Supabase service-role key are needed only by specific
local administrative scripts.

Vite prints the local URL, normally `http://localhost:5173`. Public catalogue
browsing must work without signing in.

## Credential rules

These are release-blocking rules:

1. Every `VITE_` value is bundled into public browser JavaScript. Never put a
   service-role key, server key or other secret in a `VITE_` variable.
2. `VITE_SUPABASE_ANON_KEY` must be an anon/publishable key protected by
   Supabase Row Level Security.
3. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Keep it local, never add it to
   Git, and never configure it in the frontend deployment.
4. `VITE_YOUTUBE_API_KEY` is a public browser key restricted by HTTP referrer.
   `YOUTUBE_API_KEY` is a separate server/script key restricted by IP.
5. Real `.env` and `.env.staging` files are ignored. Only the example files
   belong in Git.
6. Do not paste credentials into issues, pull requests, screenshots or chat.
   Rotate a key immediately if exposure is suspected.

GitHub CI uses clearly labelled fake public placeholders. It does not receive
the local `.env` file or any privileged credential.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Check JavaScript, React hooks and accessibility rules |
| `npm test` | Run the complete automated test suite once |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Preview the built bundle locally |
| `npm run verify:frontend-release` | Check secrets, metadata, headers, SPA routing and legal placeholders |
| `npm run verify:production-capabilities` | Read-only check that production API capabilities match the frontend flags |
| `npm run audit:production-catalog` | Read-only anonymous inventory of live catalogue metadata and coverage |
| `npm run ui:audit` | Run the responsive browser audit and fail on objective layout/accessibility regressions |
| `npm run pack:review` | Build a review archive outside the repository |

For a normal frontend change, run:

```powershell
npm run lint
npm test
npm run build
npm run verify:frontend-release
```

GitHub Actions repeats `npm ci`, static checks, tests, build and the frontend
release verifier for every push to `main` and every pull request.

The production catalogue audit uses only the browser-safe anonymous key and
performs `SELECT` queries only; it has no write path and never imports the
service-role key. It also reports exact video overlap between playlists so a
duplicate course can be reviewed before removal. Its sanitized JSON report is written outside the repository at
`../outputs/catalog-production-inventory.json`.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Routing, shared layout and capability-gated routes |
| `src/Home.jsx` | Student landing page and guided entry points |
| `src/Explore.jsx` | Curriculum exploration flow |
| `src/Dashboard.jsx` | Canonical browse and filter page |
| `src/PlaylistBrowse.jsx` | Course and lecture results |
| `src/CourseVideoPage.jsx` | Course detail and lesson playback |
| `src/releaseCapabilities.js` | Current production capability contract |
| `src/migrations/` | Migration source files; not an instruction to run them |
| `production/` | Production packages, evidence, hashes and runbooks |
| `docs/` | Security, deployment, staging and scale evidence |
| `public/` | Favicon, social preview, robots policy and early theme script |
| `.github/workflows/ci.yml` | Automated test/build/release gate |

Theme colours come from `ThemeContext`/`useTheme`; components do not use
Tailwind's `dark:` variant. Brand accents are navy `#142A4F` and teal
`#0F6F78`.

## Database and production safety

Most development does not require a database migration. Treat everything in
`src/migrations/` and `production/` as potentially production-changing.

Before any production database operation:

1. Obtain explicit owner approval for that exact operation.
2. Confirm the target project in the Supabase header; never rely only on a tab
   title or remembered URL.
3. Verify a recent restorable backup.
4. Pass the relevant disposable-staging gate.
5. Follow the matching preflight, hash, migration, postflight and rollback
   instructions in the applicable runbook.
6. Stop immediately if preflight or postflight evidence differs from the
   documented expectation.
7. Update `releaseCapabilities.js` only after the production capability is
   deployed and verified.

Do not run staging fixtures or destructive verification helpers against
production. `.env.staging.example` documents the separate disposable-staging
credentials and opt-in marker.

## Deployment

Read [`docs/frontend_deployment.md`](docs/frontend_deployment.md) before a
public deployment. The repository contains SPA rewrites and security headers
for both Vercel and Netlify.

The deployment platform needs only the real browser-safe values required by the
frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_YOUTUBE_API_KEY` when the admin importer is used

Never configure `SUPABASE_SERVICE_ROLE_KEY` or the server
`YOUTUBE_API_KEY` in the frontend deployment.

Before promotion, confirm the GitHub Actions run is green and run the
read-only production capability check against the intended production project.

## Further operational documentation

- [Release checkpoint — 25 July 2026](docs/release_notes_2026-07-25.md)
- [Backup and restore readiness](docs/backup_restore_readiness.md)
- [Checklist for future Codex tasks](docs/codex_task_safety_checklist.md)
- [Mass-ingestion preflight](docs/mass_ingestion_preflight.md)
- [Frontend deployment gate](docs/frontend_deployment.md)
- [Catalogue scale gate](docs/catalog_scale_gate.md)
- [Import and migration hardening](docs/import_hardening.md)
- [Faculty release gate](docs/faculty_v7_release_gate.md)
- [Content-report production runbook](docs/content_reports_production_runbook.md)
- [Production migration runbook](production/README.md)
- [Catalogue navigation production runbook](production/catalog_navigation_v9/README.md)

## License

No open-source license has been selected. Until the owner makes and documents a
license decision, the repository is not licensed for copying, redistribution
or external reuse.
