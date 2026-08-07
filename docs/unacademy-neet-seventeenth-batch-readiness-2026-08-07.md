# Unacademy NEET seventeenth-batch readiness — 2026-08-07

Status: **PREPARED ONLY — OWNER APPROVAL REQUIRED**. No production write and no
`release` push occurred.

## Proposed owner decision

Decision ID: `ae4a8549-84d5-4784-91ed-2f56e4208d88`

Approve the reviewed Unacademy NEET seventeenth batch — **Breathing and Exchange
of Gases** — with **Dr. Sachin Kapur** attribution under decision
`ae4a8549-84d5-4784-91ed-2f56e4208d88`, exactly as recorded in this readiness
document. Import create-only after a fresh PITR/baseline check and anonymous
dry-run, then verify the protected original-82 JEE fingerprint. Stop on source
mutation, reuse, drift, or any blocker; no `release` push.

This decision covers the playlist-specific teacher evidence and the reviewed
lecture-only manifest. It does not authorize a schema migration or any update or
delete of existing catalogue rows.

## Fresh source and production preflight

The official Unacademy NEET channel was refreshed through the YouTube Data API
on 7 August 2026. It still exposes 736 playlists; five titles mention breathing,
and this package selects the exact previously deferred Live Daily 2.0 source:
`PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe`.

Anonymous production evidence captured `2026-08-07T06:25:14.075Z`:

| Evidence | Result |
|---|---:|
| Playlists / videos / memberships / chapters | 409 / 4,699 / 4,705 / 263 |
| Chapter-class rows | 92 |
| Teachers / playlist-teacher links | 34 / 164 |
| Quality reviews | 35 (last exact guarded postflight immediately before this pass) |
| Exact source-playlist collisions | 0 |
| Retained production-video collisions | 0 |
| Protected original JEE boundary | 82 / 1,304 / `30eee4a4a6842e5beeb7c97083d7f812` |
| Rolling JEE boundary | 212 / 2,848 / `9eea2b44f0b19c08cc0907c57e091342` |

The existing Biology chapter is `105 — Breathing and Exchange of Gases`, scoped
to class-11. The verified normalized teacher is `38 — Dr. Sachin Kapur`
(`sachin-kapur`). No chapter or teacher creation is required.

## Reviewed course

The source currently contains ten rows. Retain positions 1–6, the complete
numbered L1–L6 lecture sequence. Exclude positions 7–10: three chapter quizzes
and one broad Human Physiology mega quiz. The excluded rows credit Pradeep Sir or
Seep Ma'am and therefore do not create additional faculty attribution.

All six retained lectures:

- are in official YouTube source order;
- have non-zero durations (54–61 minutes);
- are embeddable;
- explicitly name Sachin Sir; and
- map to the single existing class-11 chapter.

This chapter already has courses from other channels, including PW, Aakash, and
Allen. The proposed import is an additional distinct Unacademy source, not a
claim that the chapter lacked coverage. The source playlist ID and all six
retained video IDs are absent from production.

Projected create-only delta: **+1 playlist / +6 videos / +6 memberships / +0
chapters, with 0 reuse**. Projected totals: **410 / 4,705 / 4,711 / 263**.

## Immutable evidence

Source-snapshot SHA-256:

- Breathing and Exchange of Gases: `949828a53683731df930b75a821d49fc60983829bc7a45a9416c282e2407d088`

File SHA-256 values:

- Candidate review: `34f9fd33196c651fdfa1c36d4520ce3ec5209cf8d6f3d5b033bdfa661a00a4dc`
- Manifest: `50d044c69dd4574f85bc391dc2d2c4ef2995e9808f9d7d8a74eb67d68663ab19`

These hashes must be regenerated if the official source playlist changes. A
future production run must refresh the playlist, reproduce the source hash,
record a fresh PITR restore point and exact baseline, run the anonymous dry-run,
then import once with `--confirm-production`. This preparation deliberately
stops before that write gate.
