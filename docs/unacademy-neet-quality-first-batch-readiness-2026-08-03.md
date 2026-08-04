# Unacademy NEET first-batch quality-review readiness — 4 August 2026

## Status

Applied to production on 4 August 2026 after exact-hash owner approval, a fresh
signed-in PITR check, and a fresh read-only preflight matching every pinned
guard. The transaction committed the three reviewed quality transitions and no
catalogue, faculty-registry, chapter, video, or membership delta.

## Reviewed scope

Owner evidence decision `6579f542-da9b-499f-bd46-3aa796ea4f27` identifies the
instructors visible in the official Unacademy NEET source playlists:

- course 341, Chemical Bonding — Ashwani Tyagi, verified teacher id 32;
- course 342, Evolution — Pradeep Singh, verified teacher id 33;
- course 343, Principles of Inheritance and Variation — Pradeep Singh,
  verified teacher id 33.

The additive faculty-registry package was applied successfully before this
package was prepared. These three courses already have their exact reviewed
teacher links, but intentionally remain `title_review_status = 'pending'` and
`faculty_credit_status = 'pending'`.

This package performs the separate canonical quality-review transition. It
calls `review_playlist_quality()` once per course with the existing reviewed
title, exact teacher id, and existing `full-course` / `hinglish` /
`intermediate` metadata. The RPC validates the inputs, replaces the identical
teacher link through the v7 contract, changes the two review statuses to
`approved` / `identified`, and appends one immutable before/after audit row.

## Fresh read-only production snapshot

Observed while preparing the artifact:

- production marker rows: 0;
- catalogue: 353 courses / 4,159 videos / 4,165 memberships / 245 chapters;
- chapter-class scopes: 92;
- faculty registry: 29 teachers / 45 aliases / 30 institute links / 30 subject
  links / 29 learning-goal links / 133 course-teacher links;
- quality-review audits: 0;
- course lesson counts: 15 / 15 / 14, with distinct video ids and chapter
  assignments present;
- course goals/classes: NEET with class-11 / class-12 / class-12;
- course teacher links: 341→32, 342→33, 343→33, all primary instructors;
- each course's exact pre-review missing-field list: `title-review`,
  `faculty-credit` only;
- content-quality capability advertises the v10 review contract;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.

The stale package gate began from 335 courses / 4,018 videos / 4,024
memberships, but a separate create-only JEE Wallah batch completed before the
quality review could be proven. The stop condition fired at 353 / 4,159 / 4,165.
Two subsequent read-only snapshots matched those refreshed totals; the target
courses, faculty links, empty review table, and protected original JEE
fingerprint remained unchanged. This artifact pins the refreshed values and
aborts before any review if the live database moves again.

## Artifact

- SQL: `docs/sql/unacademy_neet_first_batch_quality_review_2026-08-03.sql`
- SHA-256: `6191c696f6ba7e62055390c48d48230417d69410bb2c06f76034e518b19ecc5e`
- target if separately approved: production project `kezelafqhgqrprpadmlf`;
- expected catalogue/faculty delta: zero;
- expected review delta: three playlists change from pending/pending to
  approved/identified, and three quality-review audit rows are appended;
- expected protected JEE delta: zero.

The SQL is one transaction. It uses no direct `INSERT`, `UPDATE`, `DELETE`, or
DDL against production tables; the only write entry point is the canonical
SECURITY DEFINER review RPC. It verifies all three RPC return values are
quality-ready, rechecks exact totals and audit before/after states, and commits
only if the protected JEE fingerprint is still exact.

## Local validation

`src/unacademyNeetQualityProductionPackage.test.js` pins the artifact hash and
review inputs, rejects direct table writes, and runs the complete transaction
against a production-shaped PGlite database. It verifies the successful
three-review outcome and separately proves that a stale exact baseline aborts
without changing either course status or creating an audit row.

Final prepared-package checks:

- targeted package rehearsal: 5/5 tests passed;
- full regression suite: 139 files / 1,399 tests passed;
- ESLint: full repository passed with zero warnings;
- production build: passed (353 courses plus 29 faculty and nine static routes);
  the generated live-only sitemap delta was excluded from this package;
- production dependency audit: zero vulnerabilities;
- high-severity audit gate: passed; one pre-existing moderate PostCSS
  development advisory remains outside this SQL-only package.

No production SQL, content import, schema migration, clone, restore, or
`release` push was performed while preparing or validating this gate.

## Production application — 4 August 2026

- Target: production project `kezelafqhgqrprpadmlf`.
- Fresh signed-in PITR evidence: Pro production, 7-day retention, restore window
  `28 Jul 2026, 01:01:50` through `04 Aug 2026, 01:01:50` in the dashboard's
  `UTC+05:30` timezone. The exact pre-write rollback target was
  `04 Aug 2026, 01:01:50 IST`.
- The SQL editor contained 449 lines. Copying the actual editor contents back
  out and normalising the editor's CRLF line endings reproduced SHA-256
  `6191c696f6ba7e62055390c48d48230417d69410bb2c06f76034e518b19ecc5e`
  exactly before execution.
- The independent preflight matched the pinned baseline: 353 playlists, 4,159
  videos, 4,165 memberships, 245 chapters, 92 chapter-class scopes, 29
  teachers, 45 aliases, 30 institute links, 30 subject links, 29 learning-goal
  links, 133 course-teacher links, and zero quality-review audits. Courses
  341–343 were still `pending` / `pending` with teacher links 32 / 33 / 33.
- The guarded transaction completed successfully. Its result returned all
  three courses as `approved` / `identified`, quality-ready with empty missing
  fields, and exactly one audit row each.
- Independent postflight confirmed the only delta was three quality-review
  audits. Catalogue and faculty totals were unchanged; all three immutable
  before/after audit states and the owner-evidence note matched exactly.
- Protected original JEE remained 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.
- Application gate completed at `2026-08-04T11:03:01+05:30`. No restore,
  content import, schema migration, or `release` push was performed.

## Approval record

`Approve applying refreshed Unacademy NEET first-batch quality-review artifact SHA-256 6191c696f6ba7e62055390c48d48230417d69410bb2c06f76034e518b19ecc5e to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
