# NEEV Competishun Science — Life Process

Date: 2026-07-29
Environment: production (`kezelafqhgqrprpadmlf`)
Source playlist: `PLgWXZcKGZpCpqUjbWqaH0Ai31LlRtYqTF`

## Scope and baseline

This was Course 3 of the owner-approved NEEV gap-filling batch. It ran alone,
one course at a time.

- `main`, `origin/main`, and the worktree were synchronized and clean at
  `19800817d3baa67835ca0587e12ac511bf43626e`.
- Fresh catalogue baseline: 158 playlists, 2,010 videos, 2,014 memberships,
  and 218 chapters.
- The source playlist was absent.
- Science subject ID 10 and the exact `Life Processes` chapter (ID 207)
  already existed.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Source review and dry-run

- The official NEEV Competishun playlist contained exactly 10 usable,
  embeddable videos.
- All 10 source videos were assigned to the single `Life Processes` chapter;
  `draft:manifest` was not used.
- The production dry-run produced one playlist with 10 usable videos, 0
  blocked results, and no writes.
- The source playlist places its L-3 lecture before L-2. The dry-run correctly
  reported this title-number inversion; the import preserved the authoritative
  YouTube playlist order exactly as approved.
- The other review result was the expected channel-attribution evidence.
- Reviewed channel-attribution decision:
  `9c9e2d18-6e03-4e50-93d2-3d1c456033b1`.
- Attribution is the NEEV Competishun brand/channel
  (`@NEEVCompetishun`, `UCKR9slCGzU9lIRyRlpybVew`); no personal teacher was
  invented.
- The production baseline was rechecked immediately before the write and was
  unchanged.

## Import and postflight

The create-only import created course ID 166:

- +1 playlist
- +10 videos
- +10 memberships
- 0 reused videos
- 0 chapters created

Final catalogue totals:

- 159 playlists
- 2,020 videos
- 2,024 memberships
- 218 chapters

The course is scoped to `school` / `cbse` / `10th` / Science and uses chapter
ID 207 for all 10 lessons. The exact retained source order is:

1. `IZhCrSF7fCE`
2. `BlrLXNmm2Fo`
3. `AKqNE-9zcto`
4. `Qn5PvsWFnUI`
5. `ew5gXCQPaH4`
6. `hoXnU5DG6bM`
7. `AqNRvylvUqU`
8. `jsRI0xE6CBw`
9. `QvMRRuf52CQ`
10. `azFZrJGtoB8`

The protected JEE catalogue remained exactly 83 courses and 1,307 memberships
with fingerprint `d7aae3ce7635401ebeffe97e627048bc`.

## Anonymous runtime QA

- School Boards → CBSE → Class 10 → Science → Life Processes displayed the
  NEEV course with 10 lectures and NEEV Competishun channel attribution.
- Course 166 displayed all 10 lessons under `Life Processes` in exact source
  order, including the source playlist's L-3-before-L-2 ordering.
- The official YouTube player loaded for the first lesson.
- No browser console errors were recorded.

Course 3 is complete. The approved three-course NEEV gap-filling batch is
complete.
