# Unacademy NEET twenty-first-batch faculty-link readiness - 13 August 2026

## Status

**OWNER APPROVAL REQUIRED - NOT APPLIED.** This gate prepared and statically
verified an additive, fail-closed faculty-link artifact only. Production was
queried read-only; no SQL artifact was executed, no quality state changed, and
no `release` push occurred.

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
