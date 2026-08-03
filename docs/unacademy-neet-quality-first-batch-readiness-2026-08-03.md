# Unacademy NEET first-batch quality-review readiness — 3 August 2026

## Status

Prepared, not applied. Production remains unchanged by this package. Applying
it requires a fresh signed-in PITR check, a fresh read-only preflight matching
every pinned guard, and a separate exact-hash approval from the owner.

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
- catalogue: 335 courses / 4,018 videos / 4,024 memberships / 245 chapters;
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

The catalogue advanced by one course and 63 videos/memberships after the prior
faculty-registry gate. This artifact pins the refreshed values and aborts
before any review if the live database moves again.

## Artifact

- SQL: `docs/sql/unacademy_neet_first_batch_quality_review_2026-08-03.sql`
- SHA-256: `768c880f029a30ede6e7013a148ad904677a43b84ed6f54b1d8da145560ff4ca`
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
- full regression suite: 138 files / 1,371 tests passed;
- ESLint: passed with zero warnings;
- production build: passed (335 courses plus six static sitemap routes); the
  generated live-only sitemap delta was excluded from this package;
- production dependency audit: zero vulnerabilities;
- high-severity audit gate: passed; one pre-existing moderate PostCSS
  development advisory remains outside this SQL-only package.

No production SQL, content import, schema migration, clone, restore, or
`release` push was performed while preparing or validating this gate.

## Required approval phrase

`Approve applying Unacademy NEET first-batch quality-review artifact SHA-256 768c880f029a30ede6e7013a148ad904677a43b84ed6f54b1d8da145560ff4ca to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
