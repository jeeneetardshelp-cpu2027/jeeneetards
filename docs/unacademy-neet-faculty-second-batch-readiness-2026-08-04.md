# Unacademy NEET second-batch faculty registry readiness — 4 August 2026

## Status

Reprepared and locally rehearsed only. The first approved artifact stopped at
its exact-baseline guard after an unrelated English lesson was added
concurrently; its transaction rolled back and created no faculty rows. No
quality-review transition, schema migration, clone, restore, or `release` push
was performed. This replacement artifact must not be run without separate
owner approval of its exact hash.

## Reviewed scope

Owner evidence decision `4555712a-b4ea-446c-8f57-04d2257562f9` identifies the
named instructors in the three official Unacademy NEET playlists imported as
courses 374–376:

- course 374, Rotational Motion — Mahendra Singh, Physics, class-11;
- course 375, Current Electricity — Anu Gupta, Physics, class-12;
- course 376, Electrochemistry — Anoop Vashishtha, Chemistry, class-12.

The package creates three verified teacher identities, associates them with
the existing official Unacademy NEET channel, reviewed subject, and NEET
learning goal, and links each teacher to exactly one reviewed course. It leaves
`title_review_status` and `faculty_credit_status` at `pending`; canonical
quality review is a separate later gate.

## Fresh read-only production snapshot

- catalogue: 358 playlists / 4,223 videos / 4,229 memberships / 250 chapters;
- chapter-class scopes: 92;
- faculty registry: 29 teachers / 45 aliases / 30 institute links / 30 subject
  links / 29 learning-goal links / 133 course links;
- courses 374–376 retain their exact reviewed source IDs, channel 147, subject,
  class, NEET goal, and lesson counts 14 / 11 / 9;
- all three remain `pending` / `pending`;
- no matching teacher, normalized alias, or course-teacher link exists;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.

The artifact pins every value above and aborts before inserting anything on
any mismatch.

## Alias normalization decision

The verified evidence supplies six raw name forms, but only five distinct
normalized aliases. `Anu Gupta` and `Anu Gupta Sir` both normalize to
`anu gupta` under the production honorific-removal rule. The conflict-safe
insert therefore records one canonical Anu Gupta alias rather than inventing an
unsupported nickname. Mahendra Singh and Anoop Vashishtha each retain their
distinct full-name and `Sir`-form normalized aliases.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_second_batch_faculty_2026-08-04.sql`
- SHA-256: `970b515f9092717fd0c03feccd426b5ecd2925c0874048cd2b0c9bfaef16c7c7`
- target if separately approved: production project `kezelafqhgqrprpadmlf`;
- expected additive delta: +3 teachers, +5 normalized aliases, +3 institute
  links, +3 subject links, +3 learning-goal links, +3 course links;
- expected catalogue and protected-JEE delta: zero;
- expected postflight faculty totals: 32 teachers / 50 aliases / 33 institute
  links / 33 subject links / 32 learning-goal links / 136 course links.

The transaction contains inserts only, uses conflict-safe junction inserts,
checks exact identities and postconditions, and re-verifies the protected JEE
fingerprint before committing.

## Local validation

- targeted production-shaped PGlite rehearsal: 5/5 tests passed;
- full regression suite: 146 files / 1,470 tests passed;
- full ESLint: passed with zero warnings;
- production build: passed (358 courses, 29 faculty, 48 deep Explore routes,
  and 12 static routes);
- production dependency audit: zero vulnerabilities.

No automatic `npm audit fix` was run in this SQL-only gate.

## Required approval phrase

`Approve applying revised Unacademy NEET second-batch faculty registry artifact SHA-256 970b515f9092717fd0c03feccd426b5ecd2925c0874048cd2b0c9bfaef16c7c7 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
