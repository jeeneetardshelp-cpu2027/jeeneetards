# Release notes - 28 July 2026

## NEET catalogue checkpoint

The reviewed NEET readiness registry is complete. All 31 approved candidates
were imported through the create-only mapped workflow:

- 31 courses;
- 256 videos;
- 256 playlist memberships;
- zero import-created chapters.

Production now contains 128 courses and 1,721 memberships:

- JEE: 83 courses and 1,307 memberships;
- NEET: 45 courses;
- Biology: 26 courses.

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

Breathing and Exchange of Gases - BIOLOGY RAFTAAR was imported as course 130.
All four source descriptions directly credit Diksha Sharma Ma'am. The
create-only import added 4 videos and memberships, reused the existing
Breathing and Exchange of Gases chapter, and left the protected JEE catalogue
unchanged.

Locomotion and Movement - BIOLOGY RAFTAAR was imported as course 131. All
three source descriptions directly credit Diksha Sharma Ma'am. The create-only
import added 3 videos and memberships, reused the existing Locomotion and
Movement chapter, and left the protected JEE catalogue unchanged.

Excretory Products and its Elimination - BIOLOGY RAFTAAR was imported as
course 132. All four source descriptions directly credit Diksha Sharma Ma'am.
The create-only import added 4 videos and memberships, reused the canonical
`Excretory Products and Their Elimination` chapter, and left the protected JEE
catalogue unchanged.

Body Fluids and Circulation - BIOLOGY RAFTAAR was imported as course 133. All
three source descriptions directly credit Diksha Sharma Ma'am. The create-only
import added 3 videos and memberships, reused the existing Body Fluids and
Circulation chapter, and left the protected JEE catalogue unchanged.

Structural Organization in Animals - BIOLOGY RAFTAAR was imported as course
134. All six source descriptions directly credit Diksha Sharma Ma'am. The
create-only import added 6 videos and memberships, reused the canonical
`Structural Organisation in Animals` chapter, and left the protected JEE
catalogue unchanged.

Plant Kingdom - BIOLOGY RAFTAAR was imported as course 135. The first three
consecutive source descriptions directly credit Yashika ma'am, the fourth
continuation has no conflicting attribution, and the established PW faculty
identity is Yashika Singh Ma'am. The create-only import added 4 videos and
memberships, reused the existing Plant Kingdom chapter, and left the protected
JEE catalogue unchanged.

## Integrity and rollback evidence

Seven-day PITR was active before the latest write. The recorded rollback point
for course 135 is `28 Jul 2026 11:37:24 UTC+05:30`; no restore was started.

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

- Home advertises 83 JEE and 45 NEET courses.
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

Morphology of Plants - BIOLOGY RAFTAAR remains deferred because none of its
five current YouTube descriptions or tags identifies the teacher. The videos
are otherwise public and embeddable, but faculty identity is not inferred from
the shared series.

The refreshed RAFTAAR closure audit leaves six unimported playlists in total.
Living World and Animal Kingdom, like Morphology, have no teacher attribution
in their current descriptions or tags. Digestion and Absorption, Mineral
Nutrition, and Transport in Plants have direct teacher evidence but their
canonical Biology chapters do not exist in production. The official NEET UG
2026 syllabus does not enumerate those three as standalone Biology chapters,
so no production taxonomy rows were created merely to accommodate legacy
playlist titles.

The remaining ten checked-in legacy Crash Course and Mind Map manifests were
also reconciled against their current YouTube sources. Their usable counts
match the retained mappings, except that Class 12 Physics has 30 usable videos
from 31 advertised entries and a matching 30-row manifest. None has genuine
teacher attribution in its current descriptions or tags, so these files remain
mapping drafts rather than production-approved imports.

The PW NEET Wallah inventory refresh still contains exactly 218 public
playlists, matching the reviewed baseline. No newly published playlist requires
triage at this checkpoint.

## Deployment boundary

This checkpoint does not authorize a `release` push, production migration, or
additional content import. Future candidates must repeat the documented
pre-write gate: exact owner approval, fresh PITR restore point, JEE fingerprint,
anonymous dry-run, create-only import, and immediate postflight verification.

## Post-batch hardening checkpoint

The final read-only catalogue and ingestion audits completed after the Biology
batch. Production remains at 128 courses and 1,721 memberships: 83 JEE courses
with 1,307 memberships and 45 NEET courses. Metadata, teacher, title, and
fully-contained duplicate checks all report zero issues.

Local validation passed 79 test files / 805 tests, strict lint, and the
production build. The generated sitemap contains 128 course routes plus five
static routes. The production dependency audit reports zero vulnerabilities.
The full audit still reports seven high-severity findings confined to the
ESLint development dependency tree; the available automatic remediation is a
breaking ESLint 10 upgrade, so no force-fix was applied.

The JEE integrity fingerprint remains
`d7aae3ce7635401ebeffe97e627048bc`.

Dedicated anonymous runtime QA then separated database-object presence from
release readiness. Universal search returned grouped Kinematics chapter,
playlist, and lecture results. Chapter-scoped comparison selected two real
Kinematics courses and rendered their verified side-by-side metadata. These
two capabilities are now enabled in the frontend release map.

Faculty and Boards remain disabled. The faculty RPC exists but an anonymous
`ABJ` search returns no public registry rows, while board classification exists
without any classified courses. The production capability verifier now
requires meaningful release-ready data, so its full contract passes without
mistaking empty database foundations for student-ready features.
