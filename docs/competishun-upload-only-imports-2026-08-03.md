# Competishun+ upload-only imports — 3 August 2026

Two reviewed, source-ID-null courses were imported create-only to production
(`youtube` / `kezelafqhgqrprpadmlf`) after explicit owner approval. They use
Competishun+ brand/channel attribution under decision
`1c06eb34-fbdc-4d3b-a239-39f256f889e8`; no personal teacher was invented.

The immutable reviewed evidence package was
`docs/reviews/competishun-upload-only-candidate-batch-2026-08-03.json`, SHA-256
`62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850`.

## Recovery and initial baseline

Immediately before the writes, the signed-in production PITR dashboard showed
active 7-day retention and latest restore availability at
`03 Aug 2026, 14:08:32 UTC+05:30`.

The anonymous preflight returned exactly:

- 292 playlists;
- 3,088 videos;
- 3,094 memberships;
- 241 chapters;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`;
- rolling JEE: 167 courses / 1,894 memberships / fingerprint
  `4606d06923f3adc1ac1becd6b95ddf0d`.

All five reviewed YouTube videos were freshly rechecked through the official
API. Each remained public, HD, embeddable, and owned by channel
`UC6ieIswHA9WInRsa2r88hRw`. Neither proposed title nor any reviewed video ID
was present in production.

## Gate 1 — Jahn–Teller Distortion

- Guarded artifact:
  `docs/sql/competishun_upload_only_jahn_teller_2026-08-03.sql`.
- Artifact SHA-256:
  `07df677abf4df2f7fc8ebae8317b6921e9f4ca8d15eb11de0044908a67367d20`.
- Fresh dry-run: exact baseline, no title match, no video reuse, protected
  fingerprint exact.
- SQL Editor result: `Success. No rows returned`.
- Course: `303`, `Jahn–Teller Distortion`, source ID `NULL`.
- Videos: `3121` / `NW0wDF6acgQ`, then `3122` / `BJlj2EAGLw8`.
- Memberships: `3174–3175`, positions `1–2`.
- Filing: JEE / Chemistry / Class 12 / Coordination Compounds (`87`).
- Delta: `+1 course / +2 videos / +2 memberships / +0 chapters`.
- Protected fingerprint remained
  `c742fabf93ff8dd33d6ecd5eb4793db0`.
- Rolling JEE became 168 courses / 1,896 memberships / fingerprint
  `583e60e33ec1ed25f3f237a94e98f185`.

## Gate 2 — IOQC 2021–2022 Solutions

- Guarded artifact:
  `docs/sql/competishun_upload_only_ioqc_2021_2022_2026-08-03.sql`.
- Artifact SHA-256:
  `488a11a83369b1c8fd30fe2eefabd8b9344b44782174c8a51a4f3da064e647a2`.
- Fresh dry-run: exact post-Gate-1 baseline, all three source videos live, no
  video reuse, no 2021–2022 course match, both JEE fingerprints exact.
- SQL Editor result: `Success. No rows returned`.
- Course: `304`, `IOQC 2021–2022 Solutions`, source ID `NULL`.
- Videos: `3123` / `lAwzadMpkSE`, `3124` / `0DopkpuIfC0`, and `3125` /
  `xnnuW1XaSEg` in reviewed order.
- Memberships: `3176–3178`, positions `1–3`.
- Filing: Olympiad / Chemistry / Class 11, Class 12, Dropper / IOQC Solutions
  (`295`).
- Delta: `+1 course / +3 videos / +3 memberships / +0 chapters`.
- Protected fingerprint remained
  `c742fabf93ff8dd33d6ecd5eb4793db0`.
- Rolling JEE stayed at 168 courses / 1,896 memberships / fingerprint
  `583e60e33ec1ed25f3f237a94e98f185`.

## Final boundary

The immediate post-batch snapshot was 294 playlists, 3,093 videos, 3,099
memberships, and 241 chapters. The batch created two courses and five
videos/memberships, with no reuse, update, delete, schema migration, restore,
clone, or release push.

While local validation was running, separate catalogue writers began adding
other School and JEE courses. Live totals therefore advanced beyond this
batch's `294 / 3,093 / 3,099 / 241` postflight snapshot. Those later rows are
outside this evidence and are not attributed to this batch. A subsequent
read-only check confirmed courses `303–304` and all five memberships remained
intact, while the protected fingerprint remained exact.
