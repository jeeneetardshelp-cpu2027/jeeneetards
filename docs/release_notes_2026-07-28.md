# Release notes - 28 July 2026

## NEET catalogue checkpoint

The reviewed NEET readiness registry is complete. All 18 approved candidates
were imported through the create-only mapped workflow:

- 18 courses;
- 195 videos;
- 195 playlist memberships;
- zero import-created chapters.

Production now contains 117 courses and 1,674 memberships:

- JEE: 83 courses and 1,307 memberships;
- NEET: 34 courses;
- Biology: 15 courses.

The final reviewed-evidence candidate was MISSION 30 Zoology, imported as
course 122 with 10 new videos and memberships. Its teacher attribution is
bound to evidence decision `c8cf544a-bd1f-4a2c-9a7e-d8490185a86c`.

An additional direct-source candidate, Biological Classification - BIOLOGY
RAFTAAR, was imported as course 123 after all eight YouTube descriptions
explicitly credited Yashika ma’am. The additive import created 8 videos and 8
memberships, reused the existing Biological Classification chapter, and left
the JEE fingerprint unchanged. The attribution quality gate now recognizes
the Unicode apostrophe commonly emitted by YouTube in `ma’am`.

Cell : The Unit of Life - BIOLOGY RAFTAAR followed as course 124 after all six
source descriptions directly credited Yashika ma’am. The create-only import
added 6 videos and memberships and reused the existing `Cell: The Unit of
Life` chapter. An initial write attempt using a hyphenated chapter spelling
stopped before mutation; the corrected anonymous dry-run explicitly confirmed
chapter reuse before the successful retry.

## Integrity and rollback evidence

Seven-day PITR was active before the final write. The recorded rollback point
for course 122 is `28 Jul 2026 09:41:19 UTC+05:30`; no restore was started.

The protected JEE catalogue remains unchanged:

```text
courses:     83
memberships: 1,307
fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

The production catalogue audit reports zero missing metadata, zero missing
teachers, and zero fully-contained duplicate-course candidates.

## Runtime verification

Local production-backed QA confirmed:

- Home advertises 83 JEE and 32 NEET courses.
- NEET -> Class 11 -> Biology -> Animal Kingdom lists the expected three courses.
- Course 122 opens from browse and teacher search.
- Its first and final mapped lessons load through the official YouTube player.
- Mobile layout at 390 x 844 has no horizontal overflow.
- Dark and light themes both preserve the player and course layout.
- Production-preview NEET, JEE, and course routes make each expected Supabase
  request once and do not request `playlist_boards`.
- Fresh runtime checks produced no console errors.
- Anonymous `/admin` exposes only the sign-in form; management controls remain
  unavailable without an explicitly admin-marked account.

## Deferred content

MISSION 30 Inorganic Chemistry remains deferred because no reviewed source
directly attributes all five exact playlist videos to a teacher. General
faculty evidence and visual face matching are not sufficient.

The PW NEET Wallah inventory refresh still contains exactly 218 public
playlists, matching the reviewed baseline. No newly published playlist requires
triage at this checkpoint.

## Deployment boundary

This checkpoint does not authorize a `release` push, production migration, or
additional content import. Future candidates must repeat the documented
pre-write gate: exact owner approval, fresh PITR restore point, JEE fingerprint,
anonymous dry-run, create-only import, and immediate postflight verification.
