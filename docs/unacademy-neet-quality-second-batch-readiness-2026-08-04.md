# Unacademy NEET second-batch quality-review readiness — 4 August 2026

## Status

Applied successfully to production project `kezelafqhgqrprpadmlf` on 4 August
2026 at `09:11:44.110351+00` (`14:41:44.110351` IST), after the owner separately
approved exact SHA-256
`9b504e35ad22f6326fe9ed9f3c01ec23ba201e8f1df16524eb51e02e8376c175`.
The fresh PITR restore point was `04 Aug 2026, 14:18:17 IST`; the exact read-only
preflight passed immediately before the transaction. All postflight guards
passed. No `release` push was made.

## Reviewed scope

Owner evidence decision `4555712a-b4ea-446c-8f57-04d2257562f9` covers the three
official Unacademy NEET courses and their verified instructors:

- course 374: `Rotational Motion`, teacher Mahendra Singh (`id 34`), 14 lessons;
- course 375: `Current Electricity`, teacher Anu Gupta (`id 35`), 11 lessons;
- course 376: `Electrochemistry`, teacher Anoop Vashishtha (`id 36`), 9 lessons.

The canonical review uses `review_playlist_quality()` once per course with
`identified / full-course / hinglish / intermediate`. It preserves the exact
official YouTube playlist title in `source_title` before changing the student-
facing display title. That provenance capture is necessary because these three
imports currently have a null `source_title`.

## Fresh read-only production snapshot

- catalogue: 369 playlists / 4,348 videos / 4,354 memberships / 250 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 136 course links;
- quality-review audit: 3 existing rows, none for courses 374–376;
- application environment marker: zero rows;
- target lesson counts: 14 / 11 / 9, with distinct video membership and no
  missing chapter assignment;
- target state: all three are `pending / pending`, with null `source_title` and
  exact teacher links 374→34, 375→35, 376→36;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0` (exact match).

The transaction pins all these counts and identities. Any concurrent catalogue,
faculty, quality-audit, course, or protected-JEE change aborts before writing.
The growth since the prior artifact is limited to seven additive courses and 91
videos/memberships. It did not touch the reviewed Unacademy targets, faculty
registry, quality audit, or protected JEE catalogue.

## Applied artifact

- SQL: `docs/sql/unacademy_neet_second_batch_quality_review_2026-08-04.sql`
- SHA-256: `9b504e35ad22f6326fe9ed9f3c01ec23ba201e8f1df16524eb51e02e8376c175`
- target: production project `kezelafqhgqrprpadmlf`;
- row effect: three guarded `source_title` captures, three canonical
  quality-review transitions, and three appended audit rows;
- catalogue, lesson, membership, chapter, faculty-registry, and
  protected-JEE deltas: zero;
- quality-audit total: 3→6;
- target state: `approved / identified`, no missing quality fields.

## Safety and rehearsal

The artifact is one transaction. Its preflight validates the production marker,
v10 quality capability, exact global totals, every target course and membership,
verified teacher identities and links, curriculum references, current missing-
field set, and the protected JEE fingerprint. Source-title capture is guarded by
the exact current raw title and null provenance field. Postflight validates the
canonical titles, preserved source titles, audit before/after payloads, unchanged
teacher links and totals, and the protected fingerprint before commit.

Local validation of the replacement completed on the latest checked-out `main`:

- targeted production-shaped PGlite package rehearsal: 5/5 tests passed,
  including atomic success and rollback on baseline drift;
- full regression suite: 147 files / 1,492 tests passed;
- full ESLint: passed with zero warnings;
- production build: passed (369 courses, 32 faculty, 48 deep Explore routes,
  and 12 static routes);
- production dependency audit: zero vulnerabilities.

No automatic dependency fix or release action was run.

## Production application record

The independent postflight confirmed 369 playlists, 4,348 videos, 4,354
memberships, 250 chapters, 92 chapter-class scopes, 32 teachers, 136 course-
teacher links, six quality-review rows, and all three targets ready. The
protected original JEE catalogue remained exactly 83 courses / 1,307
memberships / fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0`.
