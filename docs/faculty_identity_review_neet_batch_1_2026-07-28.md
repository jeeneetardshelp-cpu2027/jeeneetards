# Faculty identity review — NEET batch 1 — 28 July 2026

## Status

Source-reviewed and prepared only. No clone or production write is authorized
by this document.

## Read-only production inventory

The refreshed anonymous catalogue inventory contains 128 courses: 83 JEE and
45 NEET. The NEET courses use 24 distinct legacy `playlists.teacher` strings.
The two largest single-person groups are:

| Legacy value | Reviewed display name | Courses | IDs |
| --- | --- | ---: | --- |
| `Diksha Sharma Ma'am` | Diksha Sharma | 8 | 105, 106, 125, 130–134 |
| `Yashika Singh Ma'am` | Yashika Singh | 8 | 107, 123, 124, 126–129, 135 |

These 16 records are all Biology courses from the official Competition Wallah
YouTube channel and carry the NEET learning goal.

## Evidence

Primary playlist descriptions on the official PW/Competition Wallah channel
directly credit `Diksha Sharma ma'am` across the reviewed Diksha playlists and
`Yashika ma'am` across the reviewed Yashika playlists. The import evidence and
per-playlist checks are recorded in:

- `docs/pw-neetwallah-coverage-audit-2026-07-27.md`;
- `docs/raftaar-biology-import-readiness-2026-07-28.md`;
- `docs/backup_restore_readiness.md`.

The official PW NEET faculty page identifies the latter faculty member as
`Yashika Singh Ma'am`:

`https://www.pw.live/neet`

No face, thumbnail, initials, fuzzy match, or third-party roster is used.

## Proposed normalized records

| Slug | Display name | Verified aliases | Context |
| --- | --- | --- | --- |
| `diksha-sharma` | Diksha Sharma | `Diksha Sharma Ma'am` | Competition Wallah, Biology, NEET |
| `yashika-singh` | Yashika Singh | `Yashika Singh Ma'am`, `Yashika Ma'am` | Competition Wallah, Biology, NEET |

The short Yashika alias is supported by the direct playlist descriptions and
the full identity is supported by the official PW faculty page. No shorter
alias is proposed for Diksha.

## Prepared artifact

`src/migrations/faculty_registry_neet_batch1_prepared.sql`

The artifact is additive and idempotent. It:

- creates two reviewed teacher identities and three verified aliases;
- adds institute, Biology-subject, and NEET-goal context;
- links only the exact 16 reviewed courses;
- refuses a baseline other than exactly 45 NEET courses and the reviewed
  eight/eight split;
- refuses conflicting existing normalized links;
- never changes `playlists.teacher`;
- contains no `UPDATE`, `DELETE`, `ALTER`, `DROP`, or destructive DDL;
- verifies the protected JEE fingerprint remains
  `d7aae3ce7635401ebeffe97e627048bc`.

## Rehearsal limitation

The existing isolated restore clone contains only the first two rehearsal NEET
courses and predates course IDs 105–135. It cannot prove this 16-course package
without first reproducing those missing production records. The artifact must
remain unexecuted until the owner chooses one of these separately gated paths:

1. create a fresh restore clone and run the normal clone rehearsal; or
2. approve another explicitly scoped rehearsal method with equivalent rollback
   and integrity evidence.

Production execution is not authorized.
