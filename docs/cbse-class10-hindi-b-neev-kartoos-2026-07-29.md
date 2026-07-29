# NEEV Competishun Hindi B pilot — कारतूस

Date: 2026-07-29
Environment: production (`kezelafqhgqrprpadmlf`)
Source playlist: `PLgWXZcKGZpCqC4yx7WIjnNXw7I38jghuG`

## Scope and baseline

This was Course 1 of the owner-approved two-course NEEV pilot. All other
production writes remained paused. Course 2 was not processed.

- `main` and `origin/main` were synchronized at
  `697865b38ebe3c62db3b1e0716d2ed469d195a84`.
- Fresh catalogue baseline: 155 playlists, 1,986 videos, 1,990 memberships,
  and 218 chapters.
- The source playlist and NEEV course attribution were absent.
- Hindi B subject ID 12 and the exact `कारतूस` chapter (ID 254) already
  existed.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Source review and dry-run

- The official NEEV Competishun playlist contained exactly 16 usable videos.
- All 16 videos were public and embeddable.
- Every source video was assigned to the single `कारतूस` chapter.
- YouTube source order was preserved exactly: S-1 through S-6, followed by
  Q-1 through Q-9. The two distinct Q-7 video IDs were retained in their
  source positions.
- The multi-chapter manifest validator correctly rejected the first no-write
  attempt because a one-chapter source must use `--chapter`.
- The supported `--chapter=कारतूस` anonymous production dry-run then passed:
  one playlist, 16 usable videos, 1 OK, 0 review, 0 blocked, and no writes.
- Reviewed channel-attribution decision:
  `48b263a2-6942-441b-826e-edadad057f58`.
- Attribution is the NEEV Competishun brand/channel
  (`@NEEVCompetishun`, `UCKR9slCGzU9lIRyRlpybVew`); no personal teacher
  identity or faculty-registry record was invented.

## Import and postflight

The create-only import created course ID 163:

- +1 playlist
- +16 videos
- +16 memberships
- 0 reused videos
- 0 chapters created

Final catalogue totals:

- 156 playlists
- 2,002 videos
- 2,006 memberships
- 218 chapters

The course is scoped to `school` / `cbse` / `10th` / Hindi B, uses the
existing chapter ID 254 for all 16 lessons, and retains the exact source video
order. All 16 lessons are marked embeddable.

The JEE catalogue remained exactly 83 courses and 1,307 memberships with
fingerprint `d7aae3ce7635401ebeffe97e627048bc`.

## Anonymous runtime QA

- School Boards → CBSE → Class 10 → Hindi B → `कारतूस` displayed the NEEV
  course with 16 lectures and NEEV Competishun channel attribution.
- Course 163 displayed all 16 lessons in the reviewed source order.
- The first official YouTube embed loaded and its play control worked.
- No browser console errors were recorded.

Course 1 is complete. Course 2 remains untouched pending the next owner gate.
