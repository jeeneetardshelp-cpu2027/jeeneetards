# Unacademy NEET twenty-first-batch faculty-link readiness - 13 August 2026

## Status

**APPLIED SUCCESSFULLY TO PRODUCTION ON 13 AUGUST 2026.** The exact approved
artifact committed after fresh PITR and exact-baseline verification. No quality
state changed and no `release` push occurred.

## Production execution evidence

- Exact SHA-256 reverified immediately before execution:
  `51631e50339e5c687f6cf77bb359ec33f05ce839df78c5fa520f5ef6403e8a1e`.
- PITR was active with seven-day retention; fresh rollback point:
  `13 Aug 2026, 09:29:55 IST`.
- Independent preflight at `2026-08-13T04:38:12.371Z` matched all catalogue,
  registry, course, ordered-lesson, identity, review-state, and protected-JEE
  guards exactly.
- One initial SQL-editor submission was rejected at parse time because the UI
  retained trailing text from an older query. Independent post-abort evidence at
  `2026-08-13T04:39:37.117Z` proved that no row changed.
- A fresh editor buffer was copied back and matched the approved SHA-256 after
  newline normalization before the successful execution.
- The committed transaction returned exactly course 439 -> verified teacher 40
  `shubham-kumar` and course 440 -> verified teacher 41 `samip-velani`, both as
  instructor position 1.
- Independent postflight at `2026-08-13T04:42:43.730Z` confirmed registry totals
  37 teachers / 60 aliases / 38 institute links / 38 subject links / 37 goal
  links / 176 course-teacher links, with catalogue and 45 quality reviews
  unchanged.
- Both courses remain `pending / pending`, with null source titles and zero
  quality-review rows.
- Protected JEE remained exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twenty_first_batch_faculty_links_2026-08-13.sql`
- SHA-256: `51631e50339e5c687f6cf77bb359ec33f05ce839df78c5fa520f5ef6403e8a1e`
- Evidence decision: `9443dd70-a2c6-4747-9a5e-a9022f7012cf`

Approval wording:

> Approve applying Unacademy NEET twenty-first-batch faculty-link artifact
> SHA-256 `51631e50339e5c687f6cf77bb359ec33f05ce839df78c5fa520f5ef6403e8a1e`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

## Fresh read-only baseline

At `2026-08-13T04:14:51.774Z`, production contained:

- catalogue 421 playlists / 4,746 videos / 4,752 memberships / 263 chapters;
- 92 chapter-class rows;
- faculty registry 35 teachers / 56 aliases / 36 institute links / 36 subject
  links / 35 learning-goal links / 174 course-teacher links;
- 45 quality reviews; and
- protected original JEE 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

Courses 439 and 440 matched the reviewed sources, lesson order, chapters,
classes, NEET-only scope, and pending review state. Neither normalized teacher,
any target alias, any target course-teacher link, nor any target quality-review
row existed.

## Additive scope

The atomic transaction creates only:

- verified teachers `Shubham Kumar` and `Samip Velani`;
- four aliases: full names plus reviewed source labels `Shubham` and `Samip`;
- two Unacademy NEET institute, Physics subject, and NEET goal context links;
- course 439 -> `shubham-kumar`; and
- course 440 -> `samip-velani`.

Expected registry totals after a separately approved execution are 37 teachers /
60 aliases / 38 institute links / 38 subject links / 37 learning-goal links /
176 course-teacher links. Catalogue counts and 45 quality reviews must remain
unchanged. Quality transition remains a later, separately approved gate.

The artifact aborts on any exact-baseline, source, title, lesson, chapter,
class, goal, identity, reuse, review-state, or protected-JEE mismatch.
