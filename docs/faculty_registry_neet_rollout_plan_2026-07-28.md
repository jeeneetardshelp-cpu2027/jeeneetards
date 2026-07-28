# NEET faculty registry rollout plan — 28 July 2026

## Status

Prepared release plan only. It does not authorize a clone, production write, or
release push.

The existing restore clone predates production NEET course IDs 91–135 and
cannot provide a valid rehearsal. Execution remains blocked until a fresh
restore clone contains the current 128-course production catalogue.

## Hash-pinned artifacts

Apply only these exact files, in this order:

| Order | Artifact | SHA-256 | Courses | New links |
| ---: | --- | --- | ---: | ---: |
| 1 | `src/migrations/faculty_registry_neet_batch1_prepared.sql` | `c59c374c469ff58cafe2ec485ce6605b8ee4f728da9e7a5c30f669557dab77da` | 16 | 16 |
| 2 | `src/migrations/faculty_registry_neet_batch23_prepared.sql` | `510c3c203709262616aff20614fa27809055697b396ef4b13df10b245947ed5f` | 26 | 26 |
| 3 | `src/migrations/faculty_registry_neet_batch4_course91_prepared.sql` | `b60cc52e5eb51d11c9102c73076e498ad564def2f98f53dda0212a5bd6192848` | 1 | 2 |

The order matters because batch 2–3 creates the reviewed Samapti Sinha identity
for course 122. The course-91 package then reuses that identity and creates only
Tarun Kumar plus their two ordered course links.

## Expected cumulative delta

Starting from the recorded production baseline:

| Measure | Before | Delta | Expected after |
| --- | ---: | ---: | ---: |
| `teachers` | 4 | +21 | 25 |
| `teacher_aliases` | 8 | +33 | 41 |
| `playlist_teachers` | 83 | +44 | 127 |
| Courses with normalized faculty | 83 | +43 | 126 |
| Unlinked NEET courses | 45 | -43 | 2 |

Catalogue content must not change:

- playlists: 128;
- JEE courses: 83;
- NEET courses: 45;
- JEE memberships: 1,307;
- JEE fingerprint: `d7aae3ce7635401ebeffe97e627048bc`.

The two intentionally unlinked NEET courses are 118 and 119.

## Clone rehearsal gates

### Gate F1 — restore sanity

1. Create a fresh isolated restore clone from the current production project.
2. Record source restore point, clone ref, start/end time, and manual steps.
3. Read-only verify the exact baseline above.
4. Verify all reviewed course IDs and legacy teacher strings match their review
   documents.
5. Stop on any mismatch.

### Gate F2 — apply batch 1

1. Recalculate and compare the artifact SHA-256.
2. Run the SQL transaction once.
3. Run it a second time to prove idempotency.
4. Verify exactly two reviewed teachers, three aliases, and 16 course links.
5. Verify no JEE or legacy catalogue row changed.
6. Stop and report before the next artifact.

### Gate F3 — apply batches 2–3

1. Recalculate and compare the artifact SHA-256.
2. Run once, then repeat for idempotency.
3. Verify 18 additional teachers, 28 additional aliases, and 26 course links.
4. Verify no link exists for courses 91, 118, or 119.
5. Recheck the JEE fingerprint and anonymous faculty browse.
6. Stop and report before the next artifact.

### Gate F4 — apply course 91

1. Recalculate and compare the artifact SHA-256.
2. Run once, then repeat for idempotency.
3. Verify course 91 has exactly two links ordered:
   Tarun Kumar, then Samapti Sinha.
4. Verify its legacy combined teacher label is unchanged.
5. Verify no links exist for courses 118–119.
6. Recheck the JEE fingerprint and stop.

### Gate F5 — decisive clone QA

- Confirm the cumulative totals above.
- Anonymous NEET faculty facet shows only reviewed identities.
- Every reviewed faculty profile returns only its mapped courses.
- Course 91 appears on both faculty profiles.
- JEE faculty counts, profiles, filters, course pages, and representative
  first/last playback remain unchanged.
- Course 118 and 119 continue to show truthful combined legacy text without a
  normalized faculty facet.
- No console errors or unexpected Supabase requests.

## Production gate

Production remains a separate approval:

1. owner reviews the complete clone report;
2. record a fresh exact PITR restore-point timestamp within retention;
3. verify production still matches the rehearsed baseline;
4. obtain explicit approval naming one hash-pinned artifact;
5. apply one artifact only;
6. verify its exact delta and JEE fingerprint, then stop for review.

Never chain all three production artifacts under a general “continue”
instruction. Never include courses 118–119 without new exact-video identity
evidence and a separate reviewed package.
