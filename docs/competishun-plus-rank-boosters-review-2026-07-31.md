# Competishun+ Rank Boosters split review — 2026-07-31

Source playlist: `PLO1SoY_zaltU` (`Rank Boosters`), owned by Competishun+
channel `UC6ieIswHA9WInRsa2r88hRw`.

Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8` — Competishun+
brand/channel attribution, with no personal teacher assigned.

## Channel coverage refresh

- Public channel playlists enumerated: 78.
- Playlists with no video missing from the production catalogue: 61.
- The `2021`, `2022`, and `2023` collection playlists contain AIR/student
  testimonial clips, not curriculum lectures, and are intentionally excluded.
- The short JEE 2024/2025/2027/2028, JoSAA, and KVPY collections are
  announcements, counselling, strategy, or reaction videos rather than chapter
  lectures.
- `Revision in Reels` remains excluded because its 17 videos are short reels,
  not full lectures.

## Reviewed split

The source playlist mixes three subjects, while a catalogue course has one
subject. It therefore cannot truthfully be imported as one v12 course.

### Mathematics — 3 videos

| Source position | Video | Chapter |
|---:|---|---|
| 1 | `5zTL_g5RmB0` | Applications of Derivatives |
| 5 | `6u7ATY1pTL4` | Trigonometry |
| 8 | `LMRb53fU0H8` | Sequences and Series |

Manifest:
`docs/manifests/competishun-plus-rank-boosters-mathematics-reviewed.json`

### Physics — 4 videos

| Source position | Video | Chapter |
|---:|---|---|
| 3 | `Hmbch7zot8c` | Work, Energy and Power |
| 4 | `Lf4PQl4ffr8` | Work, Energy and Power |
| 7 | `YPnPX59h89E` | Newton's Laws of Motion (NLM) |
| 12 | `XDJoI4apZw0` | Ray Optics and Optical Instruments |

The rope-and-bead lecture explicitly covers tension, normal acceleration, and
energy conservation; `Work, Energy and Power` is the principal chapter.

Manifest:
`docs/manifests/competishun-plus-rank-boosters-physics-reviewed.json`

### Chemistry — 5 videos

| Source position | Video | Chapter |
|---:|---|---|
| 2 | `h2Xm0S2WQOU` | Chemical Equilibrium |
| 6 | `Zj68NfCS-MM` | Chemical Bonding and Molecular Structure |
| 9 | `PaS0OpRkR6g` | Some Basic Principles of Organic Chemistry |
| 10 | `zIJdg0KnHx8` | Atomic Structure |
| 11 | `9PRMeoPIMXI` | Redox Reactions |

Manifest:
`docs/manifests/competishun-plus-rank-boosters-chemistry-reviewed.json`

## Dry-run result

Each subject manifest was run independently against production with the
anonymous key, category/goal `JEE`, classes `11th,12th,Dropper`, content type
`practice`, language `hinglish`, difficulty `advanced`, audience focus
`Dropper`, and the reviewed Competishun+ attribution decision.

All three returned:

- `1 ok`
- `0 review`
- `0 blocked`
- no Supabase writes

Every one of the 12 live source rows is accounted for once as an assignment and
as an explicit cross-subject exclusion in the other manifests.

## Production boundary

No production write was performed in this review gate.

Because `playlists.youtube_playlist_id` is unique and this one YouTube playlist
must become three subject-scoped catalogue courses, the split courses must use
the already-established create-only split convention: preserve the real source
playlist in `source_title`/evidence while leaving `youtube_playlist_id` null.
This is the same model used for the existing Parabola/Ellipse/Hyperbola split.
It must be applied as three additive transactions, one course at a time; it
cannot be run as three ordinary v12 imports claiming the same source ID.

Fresh pre-write baseline:

- playlists: 288
- videos: 3,071
- memberships: 3,077
- chapters: 241
- protected original JEE: 83 courses / 1,350 memberships
- protected fingerprint: `6829fcb6eae22479db7b82b7b3da654d`
- rolling JEE: 163 courses / 1,877 memberships
- rolling fingerprint: `e01c1ccb77087528656871f9f32fa030`

Expected additive deltas are `+3/+3`, then `+4/+4`, then `+5/+5` for
videos/memberships, with no chapter creation and no reuse.
