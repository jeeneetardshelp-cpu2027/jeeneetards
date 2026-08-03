# Unacademy NEET first-batch faculty registry readiness — 3 August 2026

## Status

Prepared and locally validated only. The production package has **not** been
applied. A separate owner approval of the exact SHA-256 is required before any
database write.

## Reviewed evidence

The content-import decision `6579f542-da9b-499f-bd46-3aa796ea4f27` approved
the named-teacher attribution in the official Unacademy NEET playlist and
retained-video titles:

- Ashwani Tyagi — course 341, Chemistry;
- Pradeep Singh — courses 342 and 343, Biology.

The package creates verified registry identities for those two people, records
their full-name and `Sir` aliases, associates both with the existing official
Unacademy NEET channel and the NEET learning goal, associates each with the
reviewed subject, and adds the three course-to-teacher links.

It intentionally leaves `faculty_credit_status = 'pending'`. Changing that
status is a separate in-place quality-review operation and is outside this
create-only package.

## Fresh read-only production preflight

Observed before the package was assembled:

- catalogue: 334 courses / 3,955 videos / 3,961 memberships / 245 chapters;
- chapter-class scopes: 92;
- faculty registry: 27 teachers / 41 aliases / 28 institute links / 28 subject
  links / 27 goal links / 130 course links;
- courses 341–343 exactly matched their reviewed titles, source playlist IDs,
  official channel id 147, subjects, class levels, NEET goal, and lesson counts
  15 / 15 / 14;
- no `Ashwani Tyagi` or `Pradeep Singh` teacher/alias identity existed;
- no faculty link existed for courses 341–343;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.

The catalogue had advanced from the preceding import handoff, so the guarded
artifact pins this refreshed baseline. It will abort before inserting anything
if any pinned count, identity, course fact, reference row, or protected JEE
value differs at execution time.

## Artifact

- SQL: `docs/sql/unacademy_neet_first_batch_faculty_2026-08-03.sql`
- SHA-256: `386a0af11d1526aba43d83ccba84e7b409901b21ff3ebb0f6241bae5bede683f`
- target: production project `kezelafqhgqrprpadmlf`
- expected additive delta: +2 teachers, +4 aliases, +2 institute links,
  +2 subject links, +2 goal links, +3 course links;
- expected catalogue delta: zero;
- expected postflight faculty totals: 29 teachers / 45 aliases / 30 institute
  links / 30 subject links / 29 goal links / 133 course links.

The transaction contains inserts only, uses conflict-safe junction inserts,
checks exact postconditions, rechecks the protected JEE fingerprint, and
commits only after every guard passes. It contains no catalogue content import,
schema migration, release push, or faculty-credit quality-review transition.

## Separate approval phrase

`Approve applying Unacademy NEET first-batch faculty registry artifact SHA-256 386a0af11d1526aba43d83ccba84e7b409901b21ff3ebb0f6241bae5bede683f to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
