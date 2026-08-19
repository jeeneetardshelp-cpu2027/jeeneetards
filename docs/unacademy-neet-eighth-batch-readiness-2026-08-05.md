# Unacademy NEET eighth-batch production record - 5 August 2026

## Outcome

The three owner-approved create-only imports under decision
`809b153c-b5ff-48e0-a869-02faa49b0e8f` completed successfully, one at a time.
They became courses `405`, `406`, and `407`. No source playlist or retained
video was reused, no chapter was created, and no existing course was updated or
deleted. No migration, restore, clone, or `release` push occurred.

The official YouTube Data API was refreshed immediately before execution. The
three reviewed manifests bind each exact playlist and retained video list to
the owner decision: Redox Reactions to verified Anoop Vashishtha, and Cell
Organelles plus Molecular Basis of Inheritance to verified Pradeep Singh. The
review accepts `Pradeep Sir` and `Pradeep S` as playlist-specific labels for
Pradeep Singh. Cell Organelles is deliberately mapped to the existing chapter
`Cell: The Unit of Life`, not `Cell Cycle and Cell Division`.

## Guarded execution

| Order | Course | PITR checkpoint (IST) | Exact preflight | Dry-run | Delta | Verification |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `405` Redox Reactions | 05 Aug 2026 00:57:02 | 385 / 4514 / 4520 / 247; 0 source and 0 video collision | 7 usable; 1 ok, 0 review, 0 blocked | +1 / +7 / +7 / +0; 0 reused | 9/9 checks; chapter 95; avg 57m34s |
| 2 | `406` Cell Organelles | 05 Aug 2026 01:07:02 | 386 / 4521 / 4527 / 247; 0 source and 0 video collision | 9 usable; 1 ok, 0 review, 0 blocked | +1 / +9 / +9 / +0; 0 reused | 9/9 checks; chapter 107; avg 48m32s |
| 3 | `407` Molecular Basis of Inheritance | 05 Aug 2026 01:07:02 | 387 / 4530 / 4536 / 247; 0 source and 0 video collision | 9 usable; 1 ok, 0 review, 0 blocked | +1 / +9 / +9 / +0; 0 reused | 9/9 checks; chapter 128; avg 48m17s |

The signed-in production dashboard showed active seven-day PITR at every gate.
The same restore timestamp for the last two gates reflects the dashboard's
two-minute recovery-point cadence; the page and baseline were freshly checked
before each course.

## Final production verification

- final catalogue: 388 playlists / 4,539 videos / 4,545 memberships / 247 chapters;
- batch delta: +3 playlists / +25 videos / +25 memberships / +0 chapters;
- all 25 retained video IDs are unique and embeddable, with complete durations;
- every course carries exactly the `neet` goal and its reviewed class;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812` after every write;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The reviewed single-chapter importer validates the decision-bound evidence
before writing and preserves it in the committed manifests. It writes the
legacy playlist teacher label but does not create normalized
`playlist_teachers` rows. Courses 405-407 therefore await a separately
hash-reviewed faculty-link and quality-review gate.

The exact source titles, source positions, video IDs, durations, embedding
state, source snapshot hashes, taxonomy IDs, class scopes, teachers, and zero
collision evidence are pinned in
`docs/reviews/unacademy-neet-eighth-candidate-batch-2026-08-05.json`, SHA-256
`5528688daa52efd989ef030b0c935d49f4d462eab134c0cedef98478430cbbea`.

## Immutable manifests

| Course | Manifest | SHA-256 |
| --- | --- | --- |
| Redox Reactions | `docs/manifests/unacademy-neet-redox-reactions-class-11-reviewed.json` | `0e1714afa4cc276c97a814eb32d06dd2deb8523fd43598b89622439b103a9847` |
| Cell Organelles | `docs/manifests/unacademy-neet-cell-organelles-class-11-reviewed.json` | `ae8327c5681f172568c870020dbd088071b4d90ec37e8064b6706f7f87660313` |
| Molecular Basis of Inheritance | `docs/manifests/unacademy-neet-molecular-basis-class-12-reviewed.json` | `2674164b6bd4f9299a21dd3668c502c620a44da4c48d856be10dd1c45553e8c0` |

## Approval record

`Approve the reviewed Unacademy NEET eighth batch - Redox Reactions (Anoop
Vashishtha), Cell Organelles mapped to Cell: The Unit of Life (Pradeep Singh),
and Molecular Basis of Inheritance (Pradeep Singh) - under decision
809b153c-b5ff-48e0-a869-02faa49b0e8f. Bind the exact playlist-specific teacher
evidence, then import create-only, one at a time, with a fresh PITR/baseline
check and anonymous dry-run before each, and protected JEE fingerprint
verification after each. Stop on reuse, drift, or any blocker; no release push.`
