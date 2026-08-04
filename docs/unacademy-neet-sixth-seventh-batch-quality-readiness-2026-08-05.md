# Unacademy NEET sixth/seventh-batch quality review readiness (2026-08-05)

Status: **APPLIED SUCCESSFULLY TO PRODUCTION**

## Immutable artifact

- SQL: `docs/sql/unacademy_neet_sixth_seventh_batch_quality_review_2026-08-05.sql`
- SHA-256: `60973382abb0743c676bb41318a7c33df967d69447bde98cf9dacfbff4a1ade4`
- Owner evidence decisions:
  - sixth batch: `1d0ea7b9-8cac-4f3b-968d-82b4307f264a`
  - seventh batch: `cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`

The owner approved this exact SHA-256 and it was applied once to production on
05 Aug 2026. Do not rerun it: the exact preflight intentionally rejects the
post-transition state.

## Read-only production preflight

The signed-in preflight was run against production before preparation:

- catalogue: 385 playlists / 4,514 videos / 4,520 memberships / 247 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links /
  33 subject links / 32 learning-goal links;
- course-teacher links: 140;
- quality-audit rows: 6, with zero reviews for courses 400–404;
- all five courses are still `pending` / `pending`, have no `source_title`, and
  report exactly `title-review`, `source-title`, and `faculty-credit` missing;
- the five exact instructor links created by the prior approved gate are present;
- protected JEE boundary: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

The canonical v10 capability and review contracts are present. The application
environment table remains empty, which is the established production marker.

## Intended transition

The artifact changes only courses 400–404:

| Course | Canonical title | Preserved source title | Instructor |
|---:|---|---|---|
| 400 | Hydrogen | NEET: Hydrogen \| Class 11 \| Unacademy NEET \| Anoop V. | Anoop Vashishtha (36) |
| 401 | Modern Physics | NEET: Modern Physics \| Class 12 \| Live Daily 2.0 \| Unacademy NEET \| Anu Gupta | Anu Gupta (35) |
| 402 | Biodiversity and Conservation | NEET: Biodiversity & Conservation \| LIVE Daily 2.0 \| Unacademy NEET \| Pradeep Singh | Pradeep Singh (33) |
| 403 | Cell Cycle and Cell Division | NEET: Cell Cycle & Cell Division \| Class 11 \| Live Daily 2.0 \| Unacademy NEET \| Pradeep Sir | Pradeep Singh (33) |
| 404 | Microbes in Human Welfare | NEET: Microbes in Human Welfare \| Class 12 \| Unacademy NEET \| Pradeep Singh | Pradeep Singh (33) |

Each course keeps `full-course` / `hinglish` / `intermediate`, receives an
approved canonical title and identified faculty credit, and gets one immutable
audit row. The two owner decisions are recorded separately in the relevant
audit notes.

Expected postflight:

- catalogue, taxonomy, faculty-registry, and course-teacher-link totals unchanged;
- quality-audit total 6→11;
- all five targets quality-ready with their raw YouTube titles preserved;
- protected JEE boundary and fingerprint unchanged.

## Safety and rehearsal

- One transaction: any failed preflight, transition, or postflight assertion
  rolls everything back.
- Exact baseline guards cover catalogue, taxonomy, faculty, link, audit, target,
  source-ID, membership, class, learning-goal, and verified-teacher state.
- The only direct table update captures the five previously-null source titles.
  Canonical title/status changes use `review_playlist_quality`.
- The production-shaped PGlite test proves the happy path and proves rollback
  when an exact baseline differs.
- No content import, schema migration, deletion, or `release` push is included.

## Production result

- Seven-day PITR was active. The rollback point recorded immediately before the
  write was `05 Aug 2026, 00:07:01 IST`.
- A fresh SQL Editor connection returned the exact guarded baseline:
  385 playlists / 4,514 videos / 4,520 memberships / 247 chapters /
  92 chapter-class scopes / 140 course-teacher links / 6 quality-audit rows.
- Target reviews were zero; all five courses had the expected source IDs,
  lesson counts, class/goal scope, verified instructor link, pending status,
  and missing-field set.
- The SHA-256 was recomputed immediately before execution and matched the
  approved value exactly.
- The transaction committed once. Courses 400–404 now have their canonical
  titles, preserved source titles, `approved` title status, `identified`
  faculty status, and empty missing-field arrays.
- Independent postflight: catalogue and faculty totals unchanged;
  quality-audit total: 6→11; target audit rows: 0→5; duplicate audit rows: 0.
- Each audit captures the exact before/after title, status, metadata, teacher
  IDs, and its relevant owner decision note.
- Protected JEE remained exactly 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.
- No content import, schema migration, deletion, frontend deployment, or
  `release` push occurred.
