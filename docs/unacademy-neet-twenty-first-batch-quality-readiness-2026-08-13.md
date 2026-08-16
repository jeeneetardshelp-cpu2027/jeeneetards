# Unacademy NEET twenty-first-batch quality-review readiness - 13 August 2026

## Status

**APPLIED SUCCESSFULLY TO PRODUCTION ON 16 AUGUST 2026.** The exact corrected
artifact committed only after fresh PITR confirmation, an exact production
preflight, and an SQL-editor clipboard hash roundtrip. Independent postflight
verification passed. No `release` push occurred.

## Successful production execution evidence

- Exact approved SHA-256 reverified locally and after the SQL-editor clipboard
  roundtrip:
  `82d7f70e203ecba2a254d232c362ed3ef5ad181778778f89e42832721dfdbc9a`.
- PITR was active with seven-day retention; the fresh rollback point was
  `16 Aug 2026, 00:07:13 IST`.
- Exact read-only preflight at `2026-08-16T04:49:35.410505Z` matched catalogue
  421 / 4,746 / 4,752 / 263, 92 chapter-class rows, faculty totals 37 / 60 / 38
  / 38 / 37 / 176, and 45 quality reviews. Both targets were pending with the
  exact verified teacher links and zero review rows.
- The transaction returned two rows: course 439 `Kinetic Theory of Gases` and
  course 440 `Electromagnetic Waves`, both title-approved, faculty-identified,
  and quality-ready with no missing fields.
- Independent postflight at `2026-08-16T04:50:23.812346Z` confirmed catalogue,
  chapter-class, and faculty totals unchanged; quality reviews increased only
  from 45 to 47. Each target has exactly one review row, its unchanged source
  title, the expected teacher ID, and `source_title_changed = false`.
- Protected JEE remained exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Superseded attempt evidence

- Exact SHA-256 reverified locally and after the SQL-editor clipboard roundtrip:
  `f2c594264c01e03c8828a430bb81f206053b915eac51b9b0f7417da0de755736`.
- PITR was active with seven-day retention; the dashboard showed a latest
  available restore point of `13 Aug 2026, 10:13:57 IST`.
- Fresh read-only preflight at `2026-08-13T04:59:58.332227Z` matched the
  required catalogue, faculty, target-course, review, and protected-JEE state
  exactly.
- An interrupted browser action was independently audited before retrying; at
  `2026-08-13T06:06:10.769225Z`, production still had 45 quality reviews and
  both target courses remained pending with zero target review rows.
- The hash-verified retry stopped in the first preflight block with PostgreSQL
  error `42883`: `public.catalog_management_capabilities()` does not exist.
  This was a capability mismatch, so the artifact was not weakened or retried.
- Independent no-write postflight at `2026-08-13T06:07:31.484574Z` confirmed
  catalogue 421 / 4,746 / 4,752 / 263, faculty totals 37 / 60 / 38 / 38 / 37 /
  176, and 45 quality reviews, all unchanged. Courses 439 and 440 remain
  `pending / pending`, with null source titles and zero quality-review rows.
- Protected JEE remained exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`.
- Read-only capability evidence at `2026-08-13T06:41:25.654995Z` confirmed
  `public.catalog_manage_capability()` exists and advertises version 11, while
  `public.catalog_management_capabilities()` does not exist. Production still
  had 45 quality reviews and zero target review rows.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twenty_first_batch_quality_review_2026-08-13.sql`
- SHA-256: `82d7f70e203ecba2a254d232c362ed3ef5ad181778778f89e42832721dfdbc9a`
- Evidence decision: `9443dd70-a2c6-4747-9a5e-a9022f7012cf`

The superseded attempted artifact had SHA-256
`f2c594264c01e03c8828a430bb81f206053b915eac51b9b0f7417da0de755736`.
The only executable change is
`catalog_management_capabilities()` -> `catalog_manage_capability()`.

This hash should be approved only after the faculty-link gate is applied and
verified. Approval wording for that later point:

> Approve applying Unacademy NEET twenty-first-batch quality-review artifact
> SHA-256 `82d7f70e203ecba2a254d232c362ed3ef5ad181778778f89e42832721dfdbc9a`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

## Intended transition

The atomic transaction requires the expected post-faculty baseline, then:

- captures each unchanged source title;
- approves the existing canonical titles `Kinetic Theory of Gases` and
  `Electromagnetic Waves`;
- marks faculty credit identified using only the exact normalized teacher link;
- writes one audit review row per course; and
- requires both courses to finish quality-ready with no missing fields.

Expected quality-review total is 47. Catalogue, faculty-registry, course-teacher,
chapter, lesson, scope, and protected-JEE data must remain otherwise unchanged.
The transaction aborts on capability drift, baseline drift, source mutation,
lesson/chapter/scope mismatch, teacher-link mismatch, an existing target review,
or protected-JEE mismatch.
