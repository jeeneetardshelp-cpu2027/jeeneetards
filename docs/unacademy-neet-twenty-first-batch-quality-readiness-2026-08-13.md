# Unacademy NEET twenty-first-batch quality-review readiness - 13 August 2026

## Status

**OWNER APPROVAL REQUIRED - NOT APPLIED.** This later gate is prepared only.
It must not run before the separately approved faculty-link artifact succeeds
and its exact postflight is verified. No production write or `release` push
occurred during preparation.

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
