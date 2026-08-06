# Forum v1 release-candidate review

Date: 2026-08-06

Status: **release-candidate verification passed; public release remains off pending an explicit flag-flip review**

## Release boundary

- `RELEASE_FEATURES.forum` remained `false` for every check.
- No forum navigation, footer, or sitemap release link was enabled.
- No production database or production Auth setting was changed by Codex.
- Staging finished in forum mode `off`.

## Defects closed during the release-candidate pass

1. The approved report-dismissal RPC was live and JWT-proven but not yet wired
   through the browser API and moderation queue. The admin can now dismiss a
   stale or otherwise resolved report without changing discussion content.
2. Controlled input updates inside the shared `Drawer` recreated its `onClose`
   callback, tore down the focus-trap effect, and moved keyboard focus back to
   Close. `Drawer` now keeps the latest callback in a ref; the report-reason
   regression test proves focus stays on the selected radio.
3. The composer now warns before submission that forum content is public and
   may be indexed, links to the Privacy Policy, and tells students not to share
   personal information. The Privacy Policy now covers forum contributions and
   moderator-only report records.
4. The public-notice Privacy Policy link was only 15 px tall in the first 360 px
   browser pass. It now meets the 44 px mobile target.

## Browser evidence

The consolidated verifier exercised the feed, thread, submit composer, and
moderation queue at 360 x 800 in both light and dark themes. All 16 checks
passed, covering:

- page overflow and 44 px targets;
- keyboard search, sorting, collapse, report-dialog, composer, and dismissal
  journeys, including focus return and a visible focus ring;
- browser accessibility-tree snapshots for landmarks, accessible names,
  groups, dialog state, radio state, and collapsed/expanded state;
- hostile `<script>` and `<img onerror>` Markdown remaining inert visible text;
- long formulas scrolling inside their own blocks;
- no unowned `Reveal` blocks and no browser console/page errors.

Evidence: `../outputs/forum-rc/forum-release-candidate-browser.json`

SHA-256: `fc0a196e8c771f0c648ef216a60d4c38c3502aa09ef289a6d09baad304251e30`

Eight screenshots are alongside that file: four surfaces in both themes. They
were visually inspected after the automated checks passed.

The five earlier specialized browser verifiers were also rerun from a clean
start. Their 39 checks all passed for Markdown rendering, signed-out reads,
auth/draft preservation, voting, and moderation.

## Repository verification

- `npm.cmd test -- --maxWorkers=4`: 243 files, 1,946 tests passed.
- `npm.cmd run lint`: clean with zero warnings.
- `npm.cmd exec vite build`: production-mode Vite build succeeded.

The direct Vite command intentionally skipped the repository prebuild so the
owner's unrelated `public/sitemap.xml` work was not regenerated or overwritten.

## Genuine staging journey

Project: `essmxonestbrgmgrtywn` (`app_environment = 'staging'`)

Command:

```text
npm.cmd run verify:forum-jwt-staging -- --confirm-forum-v1-jwt-staging
```

All 29 checks passed over real Supabase Auth password sessions and PostgREST
HTTP RPC calls. The run covered anonymous fail-closed behavior, admin mode
changes, authenticated publishing and ownership, commenting, voting,
three-reporter auto-hide, actionable moderation context, dismissal without
content side effects, read-only enforcement, public reads, off-mode shutdown,
and a zero-drift metric recount.

Evidence: `../outputs/forum-v1/forum-v1-jwt-111aeb31.json`

SHA-256: `70e28359df3b41e25e59d40ed841c26abb367f3f46b17226e3a1d55ee3fb5974`

Teardown assertions:

- cleanup attempted: true
- cleanup completed: true
- cleanup errors: 0
- fixture profiles: 0
- posts: 0
- reports: 0
- fixture moderation logs: 0
- fixture rate events: 0
- fatal error: null

## Remaining release action

This pass verifies the release candidate; it does not authorize publication.
Keep `RELEASE_FEATURES.forum = false` until the owner reviews this delta and
explicitly approves the separate release flag change.
