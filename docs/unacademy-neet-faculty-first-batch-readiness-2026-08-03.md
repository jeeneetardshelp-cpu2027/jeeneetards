# Unacademy NEET first-batch faculty registry readiness — 3 August 2026

## Status

Applied successfully to production on 3 August 2026. The final approved
artifact and its complete transaction passed every preflight and postflight
guard. No further write is authorized by this record.

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

The first approved artifact, SHA-256
`386a0af11d1526aba43d83ccba84e7b409901b21ff3ebb0f6241bae5bede683f`, was not
applied: its exact guard correctly stopped when the three course titles were
later normalized. A fresh read-only check found every count, source playlist,
teacher value, taxonomy link, lesson count, and protected JEE value unchanged;
only the titles are now `Chemical Bonding`, `Evolution`, and `Principles of
Inheritance and Variation`. The revised artifact below pins those current
titles. The earlier hash is superseded and must not be run.

The next approved artifact, SHA-256
`63ae41e5bd6774a36169931dfa50e2867745b6b7a670a5dd81d053c90ca421ee`, also
made no persistent production change. PITR was freshly confirmed with 7-day
retention and a latest restore point of 3 August 2026, 19:38:41 IST; every
baseline guard matched. Its postflight then detected an alias expectation
mismatch and raised before commit, rolling the complete transaction back. A
read-only post-check reconfirmed all catalogue/faculty totals and the protected
JEE fingerprint unchanged.

The cause was isolated to the rehearsal normalizer: production's
`normalize_person_name` removes Latin honorifics, so `Ashwani Sir` normalizes to
`ashwani` and `Pradeep Sir` to `pradeep`, while that rehearsal had modeled only
lowercase/trim. This revision pins those actual normalized values and makes the
atomic rehearsal use the production normalization rule. The two earlier hashes
are superseded and must not be run.

## Artifact

- SQL: `docs/sql/unacademy_neet_first_batch_faculty_2026-08-03.sql`
- SHA-256: `ad02e44f160000889d1836dd8e26f234337d3eef60d4febf44d59238bd4f5796`
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

## Production outcome

Immediately before execution, the signed-in PITR dashboard showed active
seven-day retention and latest restore availability at 3 August 2026,
22:58:47 IST. A fresh service-role read-only preflight matched every exact
artifact guard.

The transaction then committed with the expected additive-only delta:

- teachers: 27 -> 29 (Ashwani Tyagi id 32; Pradeep Singh id 33);
- aliases: 41 -> 45, including the production-normalized short aliases
  `ashwani` and `pradeep`;
- institute links: 28 -> 30, both primary links to Unacademy NEET id 147;
- subject links: 28 -> 30 (Chemistry for Ashwani Tyagi; Biology for Pradeep
  Singh);
- learning-goal links: 27 -> 29, both linked to NEET id 2;
- course-teacher links: 130 -> 133 for courses 341, 342, and 343.

Catalogue totals remained exactly 334 courses / 3,955 videos / 3,961
memberships / 245 chapters / 92 chapter-class rows. Protected original JEE
remained 83 courses / 1,307 memberships with fingerprint
`c742fabf93ff8dd33d6ecd5eb4793db0`. All three courses remain
`faculty_credit_status = 'pending'`; moving them to `identified` remains a
separate in-place quality-review gate. No schema migration, content import,
restore, clone, or `release` push occurred during the production gate.

## Applied approval phrase

`Approve applying revised Unacademy NEET first-batch faculty registry artifact SHA-256 ad02e44f160000889d1836dd8e26f234337d3eef60d4febf44d59238bd4f5796 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
