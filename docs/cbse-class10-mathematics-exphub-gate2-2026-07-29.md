# ExpHub CBSE Class 10 Mathematics import evidence

Course B was owner-approved and completed on production on 29 July 2026.
All other production writers remained paused. The import was additive and
create-only. No chapter or schema changes were made.

## Fresh baseline

- Catalogue: 150 playlists, 1,911 videos, 1,915 memberships, 169 chapters.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.
- Source playlist `PLxBrTGIVCrU6jrCpF1DO41wzK5skEiw48` was absent.
- Source channel: `Exphub 9th &10th`
  (`UC4rZpoEdeFLF4x9walsyoSw`, reviewed handle `@exphub10th`).
- Subject `Mathematics` was reused as ID 3; no chapters were created.

## Mandatory review decisions and dry-run

The manifest was checked programmatically before the write. The required
chapter decisions were exactly:

- `Area Related to Circles` -> `Areas Related to Circles`;
- `Polynomial` -> `Polynomials`;
- `Surface Area and Volume` -> `Surface Areas and Volumes`;
- `Arithmetic Progression` -> `Arithmetic Progressions`.

`Science vs Maths` and the `15 Most Repeated Previous Year Questions` video
were explicitly excluded as non-chapter content. The final manifest contains
12 assignments and 2 exclusions. Attribution uses the ExpHub brand/channel;
no personal teacher identity or faculty-registry record was invented.

Reviewed evidence decision:
`61fc0a7d-22ae-4df6-8449-6ef24fb2cb7a`.

Manifest SHA-256:
`8cd0af867671b0351acc09e753305590958c8064358656c55c1d6474b856dd49`.

The anonymous production dry-run passed with one playlist, zero review
findings, and zero blockers. It made no Supabase writes.

## Import and postflight

The mapped v12 import created course `158`, 12 videos, and 12 memberships.
It reused all chapters and created zero chapters.

- Final catalogue: 151 playlists, 1,923 videos, 1,927 memberships, 169 chapters.
- Course scope: exactly `school`, `cbse`, class `10th`, Mathematics subject `3`.
- Course attribution: ExpHub / `Exphub 9th &10th`, channel ID 71.
- JEE remained exactly 83 courses and 1,307 memberships.
- JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc`.

Anonymous production browse under School Boards -> CBSE -> Class 10 ->
Mathematics showed the 14 approved Class 10 chapters, with no JEE-only chapter
bleed. The corrected `Areas Related to Circles` chapter showed two courses.
Course `158` opened at that chapter and loaded the official
`youtube-nocookie.com` embed for `yjxwVo6MdVU`. No console errors were recorded.

Focused ingestion-safety validation passed: 27 tests.
