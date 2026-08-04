# Unacademy NEET second-batch quality-review readiness — 4 August 2026

## Status

Replacement prepared and rehearsed only. The separately approved original hash
`3393f13716d9263b08818248f7fe77410248f3a4cc5e0552ad2c1205b81f0366`
was submitted once on 4 August 2026 after a fresh PITR check, but its exact-
baseline guard detected four concurrent course imports and raised before any
write. Courses 374–376 and the quality audit remained unchanged. The revised
SQL must not be applied until the owner separately approves its exact SHA-256
and a fresh PITR plus exact-baseline preflight succeeds. No `release` push is
part of this gate. No production write has been performed with the revised
artifact.

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

- catalogue: 362 playlists / 4,257 videos / 4,263 memberships / 250 chapters;
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
The four-count increase is fully explained by independently imported Class 10
Social Science courses 377–380, which added 34 videos and memberships without
touching the reviewed Unacademy targets or protected JEE catalogue.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_second_batch_quality_review_2026-08-04.sql`
- SHA-256: `957e06a2425bdad078ac2685f349fc3038393993acf6a766b9cd3982a1c98ebf`
- target if separately approved: production project `kezelafqhgqrprpadmlf`;
- expected row effect: three guarded `source_title` captures, three canonical
  quality-review transitions, and three appended audit rows;
- expected catalogue, lesson, membership, chapter, faculty-registry, and
  protected-JEE deltas: zero;
- expected quality-audit total: 3→6;
- expected target state: `approved / identified`, no missing quality fields.

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
- full regression suite: 147 files / 1,484 tests passed;
- full ESLint: passed with zero warnings;
- production build: passed (367 courses, 32 faculty, 48 deep Explore routes,
  and 12 static routes);
- production dependency audit: zero vulnerabilities.

No automatic dependency fix or remote production action was run.

## Separate production approval

After reviewing the committed artifact, approve with the exact phrase reported
in the handoff. Production execution must then begin with a fresh PITR restore
point and repeat the exact read-only baseline. Stop without writing on any
mismatch.
