# Release notes — 3 August 2026

## Release state at the hardening checkpoint

- Code baseline summarized here:
  `352de7be850e4045d44c3c10136e7f2673830db7`.
- Deployed release baseline observed at the start of this documentation pass:
  `c6ac58b79a508325213929e00b15c23715c99ff8`.
- That release commit contains the complete code-baseline history above. This
  documentation-only record may remain on `main` until a later release.
- Automatic GitHub Actions CI for the code baseline completed successfully in run
  [30792670661](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/runs/30792670661).

No manual CI dispatch, database migration, content import, restore, or clone was
run while preparing this release note.

## Student-facing catalogue

The verified production catalogue contains:

- 292 courses: 167 JEE, 102 NEET, 16 School Boards, and 7 Olympiad;
- 3,088 videos and 3,094 course memberships;
- 241 chapters across 9 subjects.

Anonymous production QA passed for Home, Explore, Browse, search, filters,
course pages, the YouTube player, light/dark themes, and the 390 × 844 mobile
layout. JEE, NEET, and School scopes remained isolated, and the mobile browse
page had no horizontal overflow or browser console errors.

## Quality and trust hardening

The 31 July and 2 August audits are now closed at this checkpoint:

- false advertising and YouTube-player claims were corrected;
- malformed or fabricated progress records are rejected and removable;
- account-linked progress and active contribution features are disclosed;
- review visibility, moderation, account deletion, and rating availability
  guards were strengthened;
- stale and cross-scope chapter options no longer leak into Browse;
- complete institute-attribution guards and clearer lecture-search subtitles
  received separately reviewed SQL artifacts;
- administrator chapter slugs now preserve Devanagari and other Unicode text.

The latest administrator regression run covered anonymous/authenticated guards,
management capabilities, taxonomy updates, and create/edit form behavior. Full
local validation passed 126 test files / 1,171 tests, lint, production build,
frontend-release verification, dependency audit with zero vulnerabilities, and
`git diff --check`.

Two SQL artifacts are prepared but **not applied**:

- `docs/sql/complete_institute_guard_2026-08-02.sql`;
- `docs/sql/search_lecture_subtitle_2026-08-02.sql`.

Their presence in `main` or `release` is not production authorization. Each
requires its own current preflight, owner approval, fresh recovery evidence,
guarded execution, and independent postflight before it can change production.

## Database and recovery checkpoint

Chapter/class scopes v14 was already applied once to production on 2 August
2026 from the reviewed source SHA-256
`6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459`.
Its independent postflight passed with 90 scope rows and no catalogue-count
change. It must not be rerun merely because its SQL remains in the repository.

The pre-write PITR point recorded for that operation was 2 August 2026,
13:31:42 UTC+05:30. This is historical evidence, not authorization or a valid
fresh rollback point for another write. A future production write must record a
new dashboard restore point immediately before execution.

Both isolated NEET restore-rehearsal projects were deliberately deleted after
their evidence was accepted. Creating another billable clone requires a new,
explicitly scoped owner decision; a general `continue` instruction is not
sufficient.

## Performance checkpoint

Indicative production measurements for a filtered Browse route were:

- cold DOM-ready: 1.60 seconds;
- warm DOM-ready: 0.18 seconds, with two course cards visible by 1.80 seconds;
- mobile DOM-ready: 1.08 seconds, with two cards visible by 2.84 seconds.

The first Browse payload is approximately 189 KB gzip for JavaScript and CSS,
or about 237 KB including the preloaded self-hosted font. Requests are bounded,
paged, server-filtered, and protected against stale responses. The main
non-blocking optimization opportunity is a shared cache for small reference
lookups that currently refetch when the route remounts.

These timings were captured through the production browser session without
synthetic network throttling; they are operational indicators, not Lighthouse
benchmarks.

## Next safe phase

Further mass content work should begin as a new, named import batch. For every
manifest: confirm it is not already present, run a fresh anonymous dry-run,
write create-only and one course at a time, verify the approved protected
fingerprint and exact delta, then stop on reuse, drift, or any new blocker.
