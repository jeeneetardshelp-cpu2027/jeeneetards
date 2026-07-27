# RAFTAAR Biology import readiness — 2026-07-28

This is a read-only readiness handoff. It does **not** authorize a production
import.

## Verified candidates

| Order | Playlist | YouTube playlist ID | Chapter | Teacher | Videos | Expected write delta |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | Chemical Coordination & Integration - BIOLOGY RAFTAAR | `PLJyab0VQDBGXzd_SfmT7RyNS3JrN8BXAO` | Chemical Coordination and Integration | Diksha Sharma Ma'am | 4 | +1 course, +4 videos, +4 memberships, 0 chapters |
| 2 | Neural Control and Coordination - BIOLOGY RAFTAAR | `PLJyab0VQDBGWEHG2llBuC96BZ__ehodpJ` | Neural Control and Coordination | Diksha Sharma Ma'am | 6 | +1 course, +6 videos, +6 memberships, 0 chapters |
| 3 | Anatomy of Flowering Plants - BIOLOGY RAFTAAR | `PLJyab0VQDBGXycgtfPfQav8Ya3lFqpdQG` | Anatomy of Flowering Plants | Yashika Singh Ma'am | 4 | +1 course, +4 videos, +4 memberships, 0 chapters |

Combined expected delta: **+3 courses, +14 unique videos, +14 memberships, and
0 chapters**. Anonymous dry-runs found no existing-video overlap.

## Reviewed metadata

- Category and learning goal: `NEET`
- Subject: `Biology`
- Applicable class and primary audience: `11th`
- Content type: `full-course`
- Language: `hinglish`
- Difficulty: `intermediate`
- Import shape: one existing canonical chapter per playlist

All 14 source videos matched the advertised counts and passed duplicate-ID,
duration, embedding, chapter-resolution, and teacher-evidence checks. These are
single-chapter sources; the importer's multi-chapter manifest format is neither
required nor valid for them.

## Read-only production baseline

Recorded at `2026-07-28 00:20:01 +05:30` using anonymous exact-count queries:

| Metric | Current |
| --- | ---: |
| Courses | 97 |
| Unique videos | 1,461 |
| Playlist-video memberships | 1,465 |
| Chapters | 123 |
| JEE courses | 83 |
| JEE memberships | 1,307 |
| NEET courses | 14 |

All three candidate YouTube playlist IDs returned zero existing production
matches. The historical JEE fingerprint was independently reconstructed from
the exact playlist and membership fields and verified as
`d7aae3ce7635401ebeffe97e627048bc` (83 playlists, 1,307 memberships).

Repeat that anonymous, read-only verification with:

```powershell
node src/scripts/verifyJeeIntegrityFingerprint.js
```

The command exits nonzero if the live fingerprint differs from the recorded
value. Matching counts must not be treated as a substitute for this hash.

## Required production gate

Before any write:

1. Obtain owner approval naming these three playlist IDs and the order above.
2. Record the current PITR restore-point timestamp and confirm it is within
   retention.
3. Record fresh production counts and confirm the JEE fingerprint remains
   `d7aae3ce7635401ebeffe97e627048bc`.
4. Repeat the anonymous dry-run for the first playlist immediately before its
   write.
5. Import only one playlist, create-only, then stop for verification before the
   next.

Stop and report without importing if the playlist already exists, a source
count changes, a video becomes unavailable/non-embeddable, teacher evidence
changes, a duplicate appears, a chapter no longer resolves, or the JEE
fingerprint differs.

## Verification after each approved import

- Confirm the exact course/video/membership delta and zero chapter creation.
- Confirm the new course carries only the `neet` learning goal.
- Confirm JEE remains exactly 83 courses and its fingerprint is unchanged.
- Confirm a JEE-scoped view contains no NEET course and the NEET-scoped view
  contains the new course.
- Open the first and last lesson and verify the official YouTube embeds load
  without console errors.
- Confirm the created course records the exact source playlist ID and expected
  lesson count.

No frontend release push is part of this content gate.
