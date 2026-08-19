# Unacademy NEET fifteenth-batch remainder refresh — 6 August 2026

## Status

Owner decision `1412ca96-56dc-47ef-8bc0-18ce97f7dfb6` was executed after
decision `5b4b1d41-b7dc-4f12-80cf-b490e72edd96` imported course 423 and then
correctly stopped on the Fluid Mechanics source-snapshot mismatch. The two
remaining courses were imported create-only, one at a time. This continuation
made no schema change, restore, clone, deployment, or `release` push.

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

## Guarded production execution

The signed-in production dashboard confirmed active seven-day PITR before each
write, with latest restore point `6 August 2026, 17:53:00 IST`. Each exact
source refresh matched the approved whitespace-only snapshot above; each
target source ID and retained video set had zero production reuse; and both
anonymous mapped dry-runs returned 1 ok / 0 review / 0 blocked.

| Order | Course | Course ID | Exact preflight | Delta | Verification |
| ---: | --- | ---: | --- | --- | --- |
| 1 | Fluid Mechanics | `424` | 404 / 4,666 / 4,672 / 263; protected JEE exact | +1 playlist / +11 videos / +11 memberships / +0 chapters; 0 reused | chapter 26; NEET-only; class-11; positions 1-11 |
| 2 | Kinematics 1D | `425` | 405 / 4,677 / 4,683 / 263; protected JEE exact | +1 playlist / +6 videos / +6 memberships / +0 chapters; 0 reused | chapter 1; NEET-only; class-11; positions 1-6 |

Final production totals are 406 playlists / 4,683 videos / 4,689 memberships /
263 chapters. The continuation delta is +2 playlists / +17 videos / +17
memberships / +0 chapters, with zero video reuse. After each write, protected
JEE remained exactly 82 courses / 1,304 memberships /
`30eee4a4a6842e5beeb7c97083d7f812`; rolling JEE remained 212 courses / 2,848
memberships / `9eea2b44f0b19c08cc0907c57e091342`.

Faculty links and quality review remain later, separately hash-gated
transitions. No `release` push was performed.

## Historical owner decision

`Approve the refreshed Unacademy NEET fifteenth-batch remainder — Fluid
Mechanics and Kinematics 1D — under decision
1412ca96-56dc-47ef-8bc0-18ce97f7dfb6, exactly as recorded in
unacademy-neet-fifteenth-remaining-refresh-readiness-2026-08-06.md. Accept the
reviewed playlist-title whitespace-only mutations and refreshed source hashes.
Import create-only, one at a time in the listed order, with fresh PITR,
quiet-window baseline, source refresh, zero-reuse, and anonymous dry-run gates
before each, followed by protected original-82 JEE fingerprint verification.
Stop on any further source mutation, reuse, drift, or blocker; no release push.`
