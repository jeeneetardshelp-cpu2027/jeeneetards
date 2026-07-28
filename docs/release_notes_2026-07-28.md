# Release notes - 28 July 2026

## NEET catalogue checkpoint

The reviewed NEET readiness registry is complete. All 18 approved candidates
were imported through the create-only mapped workflow:

- 18 courses;
- 195 videos;
- 195 playlist memberships;
- zero import-created chapters.

Production now contains 122 courses and 1,697 memberships:

- JEE: 83 courses and 1,307 memberships;
- NEET: 39 courses;
- Biology: 20 courses.

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

Biomolecules - BIOLOGY RAFTAAR was imported as course 125 after five
consecutive source descriptions directly credited Diksha Sharma ma’am and the
sixth practice session carried no conflicting attribution. The create-only
import added 6 videos and memberships, reused the existing Biomolecules
chapter, and left the protected JEE catalogue unchanged.

Plant Growth and Development - BIOLOGY RAFTAAR was imported as course 129.
All three source descriptions directly credit Yashika ma’am. The create-only
import added 3 videos and memberships, reused the existing Plant Growth and
Development chapter, and left the protected JEE catalogue unchanged.

Cell Cycle and Cell Division - BIOLOGY RAFTAAR was imported as course 126.
All four source descriptions directly credit Yashika ma’am. The create-only
import added 4 videos and memberships, reused the existing Cell Cycle and Cell
Division chapter, and left the protected JEE catalogue unchanged.

Photosynthesis in Higher Plants - BIOLOGY RAFTAAR was imported as course 127.
All six source descriptions directly credit Yashika ma’am. The create-only
import added 6 videos and memberships, reused the existing Photosynthesis in
Higher Plants chapter, and left the protected JEE catalogue unchanged.

Respiration in Plants - BIOLOGY RAFTAAR was imported as course 128. All four
source descriptions directly credit Yashika ma’am. The create-only import
added 4 videos and memberships, reused the existing Respiration in Plants
chapter, and left the protected JEE catalogue unchanged.

## Integrity and rollback evidence

Seven-day PITR was active before the latest write. The recorded rollback point
for course 129 is `28 Jul 2026 11:13:23 UTC+05:30`; no restore was started.

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
