# Unacademy NEET twenty-first-batch quality-review readiness - 13 August 2026

## Status

**OWNER-APPROVED BUT STOPPED FAIL-CLOSED - NOT APPLIED.** The exact artifact was
submitted to production on 13 August 2026 only after the separately approved
faculty-link artifact, fresh PITR confirmation, and exact-baseline verification.
Its capability guard failed before any mutation because production does not
expose `public.catalog_management_capabilities()`. The transaction was not
modified or retried, and no `release` push occurred.

## Production execution evidence

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

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twenty_first_batch_quality_review_2026-08-13.sql`
- SHA-256: `f2c594264c01e03c8828a430bb81f206053b915eac51b9b0f7417da0de755736`
- Evidence decision: `9443dd70-a2c6-4747-9a5e-a9022f7012cf`

This hash should be approved only after the faculty-link gate is applied and
verified. Approval wording for that later point:

> Approve applying Unacademy NEET twenty-first-batch quality-review artifact
> SHA-256 `f2c594264c01e03c8828a430bb81f206053b915eac51b9b0f7417da0de755736`
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
