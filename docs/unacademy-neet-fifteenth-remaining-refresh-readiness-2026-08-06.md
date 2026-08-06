# Unacademy NEET fifteenth-batch remainder refresh — 6 August 2026

## Status

Review-only continuation package prepared after decision
`5b4b1d41-b7dc-4f12-80cf-b490e72edd96` imported course 423 and then correctly
stopped on the Fluid Mechanics source-snapshot mismatch. This continuation made
no production write, schema change, restore, clone, deployment, or `release`
push.

## Fresh production boundary

Captured at `2026-08-06T12:23:09.429Z`:

- 404 playlists / 4,666 videos / 4,672 memberships / 263 chapters;
- zero source-ID collisions for the two remaining playlists;
- zero retained-video collisions across the 17 remaining lectures;
- protected JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`.

## Source mutation review

Both official playlists added exactly one space between the hyphen and
`Playlist` in the playlist title. Every playlist owner, source position, video
ID, video title, duration, embedding status, retained row, exclusion, chapter,
class, and teacher remains unchanged.

| Order | Course | Previous snapshot | Refreshed snapshot | Retained / excluded |
| ---: | --- | --- | --- | ---: |
| 1 | Fluid Mechanics | `d3d1be7d7eae2571d5dbfece4921e6c50bac95d500ccd6a55459d017a5cdc478` | `b7a1b79c07792331919693f1b38a1ef899715cd46b5615721a4fd28b7bcca0e3` | 11 / 1 quiz |
| 2 | Kinematics 1D | `29891a8f3814b43df38c3869887fc8279b66d5f9fcdf2724016f8fee8165a487` | `313d749d524f3099b7cdcfe9406c838635ace992240f79b1dbcf1d82eb19fa5e` | 6 / 3 quizzes |

The reviewed manifests remain byte-identical:

- Fluid Mechanics: `0a35ba41c0be551d48b4f521ffa5c324e283062e3c83222cd45a678ad4e839b4`;
- Kinematics 1D: `682356a8ecec18d73db0a65fa08adaccd0dce4dde376e45840ac3d08b4e82622`.

The refreshed review artifact is
`docs/reviews/unacademy-neet-fifteenth-remaining-refresh-2026-08-06.json`,
SHA-256 `5b2b668ee827ab0fc4d36fcbaef1de5398e0554f51b5152fcf9ec3a98e51ddc0`.

## Required execution gate

After a matching owner decision, run Fluid Mechanics and then Kinematics 1D,
one at a time. Before each write, refresh PITR, exact quiet-window counts, the
exact official source, source/video reuse, and the anonymous mapped dry-run.
Require the refreshed source snapshot above, import create-only, and verify the
protected original-82 JEE fingerprint after each. Stop on any further source
mutation, reuse, drift, dry-run finding, or JEE mismatch. Faculty links and
quality review remain later, separately hash-gated transitions. No `release`
push is authorized.

## Proposed owner decision

`Approve the refreshed Unacademy NEET fifteenth-batch remainder — Fluid
Mechanics and Kinematics 1D — under decision
1412ca96-56dc-47ef-8bc0-18ce97f7dfb6, exactly as recorded in
unacademy-neet-fifteenth-remaining-refresh-readiness-2026-08-06.md. Accept the
reviewed playlist-title whitespace-only mutations and refreshed source hashes.
Import create-only, one at a time in the listed order, with fresh PITR,
quiet-window baseline, source refresh, zero-reuse, and anonymous dry-run gates
before each, followed by protected original-82 JEE fingerprint verification.
Stop on any further source mutation, reuse, drift, or blocker; no release push.`
