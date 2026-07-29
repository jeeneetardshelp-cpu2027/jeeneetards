# CBSE Class 10 English - Gate 2 evidence

Gate 2 was owner-approved and completed on production on 29 July 2026. All
other production writers remained paused. The import was additive and
create-only. No chapter or schema changes were made.

## Fresh baseline

- Catalogue: 151 playlists, 1,923 videos, 1,927 memberships, 185 chapters.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.
- English subject: ID 11.
- Source playlist `PLULAEleqt7dtgPcOuO7XeQPl4axC2QZ8D` was absent.
- Source channel: `Sunlike study`
  (`UC1XRRtnhJbVmmUt35uTPzJQ`, reviewed handle `@Sunlikestudy`).

## Mandatory review decisions and dry-run

All 18 source videos were retained. The six required Footprints story
corrections were applied:

- `4sZl3KPBD_A` -> `The Thief's Story`;
- `NtND5TsNvQ0` -> `The Midnight Visitor`;
- `g68_SHwGC-o` -> `A Question of Trust`;
- `TtZMjKuuF4Q` -> `The Necklace`;
- `V3GnocR2-0o` -> `Bholi`;
- `w9FpgW5I1Io` -> `A Triumph of Surgery`.

Only `oszdnvwDfTQ`, the video literally titled `Footprints Without Feet ...
Chapter 5`, remains mapped to `Footprints Without Feet`. The three Glimpses of
India parts all remain mapped to `Glimpses of India`.

Attribution uses the Sunlike Study brand/channel; no personal teacher identity
or faculty-registry record was invented. Reviewed evidence decision:
`2e06c772-03cf-4d02-a71f-dff432c5298f`.

Manifest SHA-256:
`cd35b64f1a2eea3e2977b84af97a352c2491c19b34f30452da4119bcd3fa0bca`.

The anonymous production dry-run passed with one playlist, zero review
findings, and zero blockers. It made no Supabase writes.

## Import and postflight

The mapped v12 import created course `159`, 18 videos, and 18 memberships.
It reused all chapters and created zero chapters.

- Final catalogue: 152 playlists, 1,941 videos, 1,945 memberships, 185 chapters.
- Course scope: exactly `school`, `cbse`, class `10th`, English subject `11`.
- Course attribution: Sunlike Study / `Sunlike study`, channel ID 73.
- A row-level postflight confirmed all 18 video-to-chapter assignments.
- JEE remained exactly 83 courses and 1,307 memberships.
- JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc`.

Anonymous production browse under School Boards -> CBSE -> Class 10 -> English
showed all 16 chapters separately. Course `159` loaded the official
`youtube-nocookie.com` embed for `The Thief's Story` (`4sZl3KPBD_A`) and the
literal `Footprints Without Feet` chapter (`oszdnvwDfTQ`). No console errors
were recorded.

Focused ingestion-safety validation passed: 27 tests.
