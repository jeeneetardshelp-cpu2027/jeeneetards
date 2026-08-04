# Unacademy NEET sixth/seventh-batch quality review readiness (2026-08-05)

Status: **PREPARED AND REHEARSED ONLY — NOT APPLIED TO PRODUCTION**

## Immutable artifact

- SQL: `docs/sql/unacademy_neet_sixth_seventh_batch_quality_review_2026-08-05.sql`
- SHA-256: `60973382abb0743c676bb41318a7c33df967d69447bde98cf9dacfbff4a1ade4`
- Owner evidence decisions:
  - sixth batch: `1d0ea7b9-8cac-4f3b-968d-82b4307f264a`
  - seventh batch: `cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`

Do not run a file with any other hash. A separate owner approval naming this
exact SHA-256 is required before a production write.

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

## If separately approved later

1. Confirm seven-day PITR and record a fresh restore timestamp.
2. Use a quiet production-write window and a fresh SQL Editor connection.
3. Recompute the file hash and require the exact value above.
4. Run the whole file once. Stop on any mismatch; do not weaken a guard.
5. Independently verify the five rows, five audit records, unchanged totals, and
   protected JEE fingerprint before recording the rollout.
